import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { z } from "zod";
import { apiConfig } from "./config.mjs";
import { checkDatabase, query, transaction } from "./db.mjs";

const capitalStatuses = [
  "New",
  "Wallet Connected",
  "Interest Submitted",
  "Pending Review",
  "Needs Documents",
  "Dataroom Requested",
  "Dataroom Granted",
  "Accredited Verified",
  "Approved",
  "Rejected",
  "Soft Committed",
  "Funded",
  "Closed",
];

const roleTypes = ["LP", "GP", "advisor", "builder", "founder", "strategic_partner"];
const walletProviders = ["Coinbase Wallet", "MetaMask", "Injected Wallet"];
const connectedWalletProviders = [...walletProviders, "Not connected"];
const accessLevels = ["locked", "requested", "granted", "revoked"];
const complianceReviewStatuses = ["not_started", "pending", "needs_documents", "verified", "rejected", "expired"];
const settlementIntentStatuses = ["draft", "approved", "pending_signature", "submitted", "confirmed", "cancelled", "expired"];
const dataroomCategories = ["Overview", "Pitch Deck", "Financial Model", "Legal / Formation", "USDC Model", "Technical Architecture", "Roadmap", "Diligence Notes", "Partner Updates", "Investment Memo", "Risk Notes"];
const documentVisibilities = ["partner", "admin", "founder", "viewer"];
const productionComplianceGateStatuses = new Set(["Accredited Verified", "Approved", "Soft Committed", "Funded"]);

const capitalInterestSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(240),
  organization: z.string().trim().min(1).max(240),
  walletAddress: z.string().trim().max(80).default(""),
  connectedWalletProvider: z.enum(connectedWalletProviders),
  referralCode: z.string().trim().min(1).max(80),
  projectSlug: z.string().trim().min(1).max(120),
  poolOfInterest: z.string().trim().min(1).max(160),
  intendedAmountUSDC: z.number().nonnegative().max(1_000_000_000),
  roleType: z.enum(roleTypes),
  accreditedSelfAttestation: z.boolean(),
  jurisdiction: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(5000).default(""),
  confirmationAccepted: z.literal(true),
  acknowledgements: z.object({
    indicationOnly: z.literal(true),
    noOfferOrAllocation: z.literal(true),
    eligibilityReview: z.literal(true),
    usdcSettlementRail: z.literal(true),
    referralNoAutomaticCompensation: z.literal(true),
    riskAndIlliquidity: z.literal(true),
    accurateInformation: z.literal(true),
  }),
});

const walletConnectionSchema = z.object({
  referralCode: z.string().trim().min(1).max(80),
  walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  provider: z.enum(walletProviders),
  projectSlug: z.string().trim().max(120).optional(),
});

const statusUpdateSchema = z.object({ status: z.enum(capitalStatuses) });
const dataroomAccessSchema = z.object({ partnerId: z.string().uuid(), projectSlug: z.string().trim().min(1).max(120), level: z.enum(accessLevels) });
const adminNoteSchema = z.object({ interestId: z.string().uuid(), body: z.string().trim().min(1).max(8000) });
const dataroomEventSchema = z.object({ documentId: z.string().uuid().optional(), projectSlug: z.string().trim().min(1).max(120), event: z.enum(["view", "download", "request_access"]) });
const complianceReviewSchema = z.object({
  interestId: z.string().uuid(),
  status: z.enum(complianceReviewStatuses),
  provider: z.string().trim().max(120).optional().default(""),
  externalReference: z.string().trim().max(240).optional().default(""),
  reviewedBy: z.string().trim().max(160).optional().default("MindLaunch Compliance"),
  expiresAt: z.string().datetime().optional(),
});
const approvedWalletSchema = z.object({
  walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  partnerId: z.string().uuid().optional(),
  interestId: z.string().uuid().optional(),
  chainId: z.number().int().positive().default(8453),
});
const settlementIntentSchema = z.object({
  interestId: z.string().uuid(),
  walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive().default(8453),
  usdcAmount: z.number().positive().max(1_000_000_000),
  expiresAt: z.string().datetime().optional(),
});
const settlementIntentStatusSchema = z.object({
  status: z.enum(settlementIntentStatuses),
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});
const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  category: z.enum(dataroomCategories).optional(),
  version: z.string().trim().min(1).max(80).optional(),
  visibility: z.enum(documentVisibilities).optional(),
  status: z.enum(["ready", "coming_soon"]).optional(),
  storageUri: z.union([z.string().trim().url(), z.literal("")]).optional(),
});

const rateBuckets = new Map();

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function money(value) {
  return Number(value ?? 0);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeEqual(left = "", right = "") {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : email;
}

function maskWallet(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function originAllowed(origin) {
  if (!origin) return true;
  return apiConfig.corsOrigins.includes("*") || apiConfig.corsOrigins.includes(origin);
}

function headers(req) {
  const origin = req.headers.origin;
  const corsOrigin = originAllowed(origin) ? (origin ?? apiConfig.corsOrigins[0] ?? "http://localhost:5173") : "null";
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": corsOrigin,
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-mindlaunch-partner-token",
    "vary": "Origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  };
}

function json(req, res, status, body) {
  res.writeHead(status, headers(req));
  res.end(JSON.stringify(body));
}

function requireCors(req) {
  if (!originAllowed(req.headers.origin)) {
    throw Object.assign(new Error("Origin is not allowed for this API."), { status: 403 });
  }
}

function rateLimit(req, scope = "public") {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const windowMs = 60_000;
  const max = scope === "public-write" ? 30 : scope === "admin" ? 120 : 240;
  const bucket = rateBuckets.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt < now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > max) throw Object.assign(new Error("Rate limit exceeded."), { status: 429 });
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 1_000_000) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireAdmin(req) {
  rateLimit(req, "admin");
  if (!apiConfig.CAPITAL_ADMIN_API_TOKEN) {
    throw Object.assign(new Error("CAPITAL_ADMIN_API_TOKEN is required for admin API access."), { status: 503 });
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!constantTimeEqual(token, apiConfig.CAPITAL_ADMIN_API_TOKEN)) {
    throw Object.assign(new Error("Admin API access denied."), { status: 401 });
  }
}

async function getPartnerByCode(code, req, requireToken = false) {
  const partner = await query("SELECT * FROM partners WHERE lower(code) = lower($1)", [code]);
  if (!partner.rowCount) throw Object.assign(new Error("Partner not found."), { status: 404 });
  const row = partner.rows[0];

  if (apiConfig.partnerTokenRequired && (row.portal_token_hash || requireToken)) {
    const token = req.headers["x-mindlaunch-partner-token"];
    if (!token || !constantTimeEqual(hashToken(String(token)), row.portal_token_hash ?? "")) {
      throw Object.assign(new Error("Partner portal access denied."), { status: 401 });
    }
  }

  return row;
}

function mapPartner(row) {
  return { id: row.id, name: row.name, organization: row.organization, email: row.email, code: row.code, role: row.role, accessLevel: row.access_level, joinedAt: dateOnly(row.joined_at) };
}

function mapReferralLink(row) {
  return { id: row.id, partnerId: row.partner_id, code: row.code, url: row.url, visits: row.visits, walletConnects: row.wallet_connects, submittedInterests: row.submitted_interests, createdAt: dateOnly(row.created_at) };
}

function mapProject(row) {
  return { id: row.id, slug: row.slug, name: row.name, shortDescription: row.short_description, category: row.category, stage: row.stage, fundingStatus: row.funding_status, preferredPartnerType: row.preferred_partner_type, dataroomAvailability: row.dataroom_availability, pool: row.pool, priority: row.priority };
}

function mapCapitalInterest(row, masked = false) {
  return {
    id: row.id,
    fullName: masked ? row.organization : row.full_name,
    email: masked ? maskEmail(row.email) : row.email,
    organization: row.organization,
    walletAddress: masked ? maskWallet(row.wallet_address) : row.wallet_address,
    connectedWalletProvider: row.connected_wallet_provider,
    referralCode: row.referral_code,
    projectSlug: row.project_slug,
    poolOfInterest: row.pool_of_interest,
    intendedAmountUSDC: money(row.intended_amount_usdc),
    roleType: row.role_type,
    accreditedSelfAttestation: Boolean(row.accredited_self_attestation),
    jurisdiction: row.jurisdiction,
    notes: masked ? "" : row.notes,
    status: row.status,
    submittedAt: iso(row.submitted_at),
    confirmationAccepted: Boolean(row.confirmation_accepted),
    acknowledgements: row.acknowledgements ?? {},
  };
}

function mapWalletConnection(row) {
  return { id: row.id, referralCode: row.referral_code, walletAddress: row.wallet_address, provider: row.provider, projectSlug: row.project_slug, connectedAt: iso(row.connected_at) };
}

function mapDocument(row, includeStorageUri = false) {
  return { id: row.id, projectSlug: row.project_slug, title: row.title, category: row.category, uploadDate: dateOnly(row.upload_date), version: row.version, visibility: row.visibility, status: row.status, views: row.views, downloads: row.downloads, storageUri: includeStorageUri ? row.storage_uri ?? "" : undefined };
}

function mapAccess(row) {
  return { id: row.id, partnerId: row.partner_id, projectSlug: row.project_slug, level: row.level, grantedBy: row.granted_by ?? undefined, grantedAt: row.granted_at ? dateOnly(row.granted_at) : undefined, requestedAt: row.requested_at ? dateOnly(row.requested_at) : undefined };
}

function mapDataroomEvent(row) {
  return { id: row.id, documentId: row.document_id, projectSlug: row.project_slug, partnerId: row.partner_id, event: row.event, timestamp: iso(row.timestamp) };
}

function mapStatusEvent(row) {
  return { id: row.id, interestId: row.interest_id, fromStatus: row.from_status, toStatus: row.to_status, actor: row.actor, timestamp: iso(row.timestamp) };
}

function mapAdminNote(row) {
  return { id: row.id, interestId: row.interest_id, author: row.author, body: row.body, createdAt: iso(row.created_at), private: true };
}

function mapActivityLog(row) {
  return { id: row.id, actor: row.actor, action: row.action, projectSlug: row.project_slug ?? undefined, referralCode: row.referral_code ?? undefined, createdAt: iso(row.created_at) };
}

function mapComplianceReview(row) {
  return { id: row.id, interestId: row.interest_id, status: row.status, provider: row.provider ?? "", externalReference: row.external_reference ?? "", reviewedBy: row.reviewed_by ?? "", reviewedAt: row.reviewed_at ? iso(row.reviewed_at) : undefined, expiresAt: row.expires_at ? iso(row.expires_at) : undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function mapApprovedWallet(row) {
  return { id: row.id, walletAddress: row.wallet_address, partnerId: row.partner_id ?? undefined, interestId: row.interest_id ?? undefined, chainId: row.chain_id, approvedBy: row.approved_by, approvedAt: iso(row.approved_at), revokedAt: row.revoked_at ? iso(row.revoked_at) : undefined, createdAt: iso(row.created_at) };
}

function mapSettlementIntent(row) {
  return { id: row.id, interestId: row.interest_id, walletAddress: row.wallet_address, chainId: row.chain_id, usdcAmount: money(row.usdc_amount), status: row.status, txHash: row.tx_hash ?? "", createdBy: row.created_by, approvedBy: row.approved_by ?? "", approvedAt: row.approved_at ? iso(row.approved_at) : undefined, expiresAt: row.expires_at ? iso(row.expires_at) : undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

async function publicState(referralCode) {
  const [partners, referralLinks, projects, documents, activityLogs] = await Promise.all([
    referralCode ? query("SELECT id, name, organization, email, code, role, access_level, joined_at FROM partners WHERE lower(code) = lower($1)", [referralCode]) : query("SELECT id, name, organization, email, code, role, access_level, joined_at FROM partners ORDER BY joined_at DESC LIMIT 10"),
    referralCode ? query("SELECT * FROM referral_links WHERE lower(code) = lower($1)", [referralCode]) : query("SELECT * FROM referral_links ORDER BY created_at DESC LIMIT 10"),
    query("SELECT * FROM projects ORDER BY CASE priority WHEN 'active' THEN 1 WHEN 'watchlist' THEN 2 ELSE 3 END, name"),
    query("SELECT * FROM dataroom_documents WHERE visibility <> 'admin' ORDER BY upload_date DESC"),
    query("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 6"),
  ]);

  return { users: [], partners: partners.rows.map(mapPartner), referralLinks: referralLinks.rows.map(mapReferralLink), projects: projects.rows.map(mapProject), capitalInterests: [], walletConnections: [], dataroomDocuments: documents.rows.map((row) => mapDocument(row)), dataroomAccess: [], dataroomEvents: [], statusEvents: [], adminNotes: [], activityLogs: activityLogs.rows.map(mapActivityLog), complianceReviews: [], approvedWallets: [], settlementIntents: [] };
}

async function partnerState(partner) {
  const [referralLinks, projects, interests, walletConnections, access, documents, events, activityLogs] = await Promise.all([
    query("SELECT * FROM referral_links WHERE partner_id = $1", [partner.id]),
    query("SELECT * FROM projects ORDER BY CASE priority WHEN 'active' THEN 1 WHEN 'watchlist' THEN 2 ELSE 3 END, name"),
    query("SELECT * FROM capital_interests WHERE referral_code = $1 ORDER BY submitted_at DESC", [partner.code]),
    query("SELECT * FROM wallet_connections WHERE referral_code = $1 ORDER BY connected_at DESC", [partner.code]),
    query("SELECT * FROM dataroom_access WHERE partner_id = $1", [partner.id]),
    query(`SELECT d.* FROM dataroom_documents d JOIN dataroom_access a ON a.project_slug = d.project_slug WHERE a.partner_id = $1 AND a.level = 'granted' AND d.visibility <> 'admin' ORDER BY d.upload_date DESC`, [partner.id]),
    query("SELECT * FROM dataroom_events WHERE partner_id = $1 ORDER BY timestamp DESC LIMIT 100", [partner.id]),
    query("SELECT * FROM activity_logs WHERE referral_code = $1 ORDER BY created_at DESC LIMIT 25", [partner.code]),
  ]);

  return { users: [], partners: [mapPartner(partner)], referralLinks: referralLinks.rows.map(mapReferralLink), projects: projects.rows.map(mapProject), capitalInterests: interests.rows.map((row) => mapCapitalInterest(row, true)), walletConnections: walletConnections.rows.map(mapWalletConnection).map((item) => ({ ...item, walletAddress: maskWallet(item.walletAddress) })), dataroomDocuments: documents.rows.map((row) => mapDocument(row)), dataroomAccess: access.rows.map(mapAccess), dataroomEvents: events.rows.map(mapDataroomEvent), statusEvents: [], adminNotes: [], activityLogs: activityLogs.rows.map(mapActivityLog), complianceReviews: [], approvedWallets: [], settlementIntents: [] };
}

async function adminState() {
  const [users, partners, referralLinks, projects, interests, walletConnections, documents, access, events, statusEvents, adminNotes, activityLogs, complianceReviews, approvedWallets, settlementIntents] = await Promise.all([
    query("SELECT id, name, email, role, wallet_address FROM users ORDER BY created_at DESC"),
    query("SELECT * FROM partners ORDER BY joined_at DESC"),
    query("SELECT * FROM referral_links ORDER BY created_at DESC"),
    query("SELECT * FROM projects ORDER BY CASE priority WHEN 'active' THEN 1 WHEN 'watchlist' THEN 2 ELSE 3 END, name"),
    query("SELECT * FROM capital_interests ORDER BY submitted_at DESC"),
    query("SELECT * FROM wallet_connections ORDER BY connected_at DESC LIMIT 200"),
    query("SELECT * FROM dataroom_documents ORDER BY upload_date DESC"),
    query("SELECT * FROM dataroom_access ORDER BY updated_at DESC"),
    query("SELECT * FROM dataroom_events ORDER BY timestamp DESC LIMIT 200"),
    query("SELECT * FROM status_events ORDER BY timestamp DESC LIMIT 200"),
    query("SELECT * FROM admin_notes ORDER BY created_at DESC LIMIT 200"),
    query("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200"),
    query("SELECT * FROM compliance_reviews ORDER BY updated_at DESC LIMIT 200"),
    query("SELECT * FROM approved_wallets ORDER BY approved_at DESC LIMIT 200"),
    query("SELECT * FROM settlement_intents ORDER BY updated_at DESC LIMIT 200"),
  ]);

  return { users: users.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role, walletAddress: row.wallet_address ?? undefined })), partners: partners.rows.map(mapPartner), referralLinks: referralLinks.rows.map(mapReferralLink), projects: projects.rows.map(mapProject), capitalInterests: interests.rows.map((row) => mapCapitalInterest(row, false)), walletConnections: walletConnections.rows.map(mapWalletConnection), dataroomDocuments: documents.rows.map((row) => mapDocument(row, true)), dataroomAccess: access.rows.map(mapAccess), dataroomEvents: events.rows.map(mapDataroomEvent), statusEvents: statusEvents.rows.map(mapStatusEvent), adminNotes: adminNotes.rows.map(mapAdminNote), activityLogs: activityLogs.rows.map(mapActivityLog), complianceReviews: complianceReviews.rows.map(mapComplianceReview), approvedWallets: approvedWallets.rows.map(mapApprovedWallet), settlementIntents: settlementIntents.rows.map(mapSettlementIntent) };
}

async function assertStatusTransitionAllowed(client, interest, toStatus) {
  if (!productionComplianceGateStatuses.has(toStatus)) return;

  const compliance = await client.query("SELECT * FROM compliance_reviews WHERE interest_id = $1", [interest.id]);
  const latestReview = compliance.rows[0];
  if (!latestReview || latestReview.status !== "verified") {
    throw Object.assign(new Error(`${toStatus} requires a verified compliance review before the lead can advance.`), { status: 409 });
  }

  if (toStatus === "Accredited Verified") return;

  const activeWallet = await client.query("SELECT 1 FROM approved_wallets WHERE interest_id = $1 AND revoked_at IS NULL LIMIT 1", [interest.id]);
  if (!activeWallet.rowCount) {
    throw Object.assign(new Error(`${toStatus} requires an approved, non-revoked wallet allowlist record.`), { status: 409 });
  }

  if (toStatus === "Funded") {
    const confirmedSettlement = await client.query("SELECT 1 FROM settlement_intents WHERE interest_id = $1 AND status = 'confirmed' AND tx_hash IS NOT NULL LIMIT 1", [interest.id]);
    if (!confirmedSettlement.rowCount) {
      throw Object.assign(new Error("Funded status requires a confirmed settlement intent with a transaction hash."), { status: 409 });
    }
  }
}

async function route(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers(req));
    res.end();
    return;
  }

  requireCors(req);
  rateLimit(req);

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/health") return json(req, res, 200, { ok: true, service: "mindlaunch-capital-gateway-api" });
  if (req.method === "GET" && pathname === "/api/readiness") return json(req, res, 200, { ok: true, database: await checkDatabase() });
  if (req.method === "GET" && pathname === "/api/capital/state") return json(req, res, 200, await publicState(url.searchParams.get("ref") ?? undefined));

  if (req.method === "GET" && pathname === "/api/partner/capital-state") {
    const partner = await getPartnerByCode(url.searchParams.get("partnerCode") ?? "", req, true);
    return json(req, res, 200, await partnerState(partner));
  }

  if (req.method === "GET" && pathname === "/api/admin/capital-state") {
    requireAdmin(req);
    return json(req, res, 200, await adminState());
  }

  if (req.method === "POST" && pathname.startsWith("/api/referral-links/") && pathname.endsWith("/visit")) {
    rateLimit(req, "public-write");
    const code = decodeURIComponent(pathname.split("/")[3]);
    const updated = await transaction(async (client) => {
      const result = await client.query("UPDATE referral_links SET visits = visits + 1 WHERE lower(code) = lower($1) RETURNING *", [code]);
      if (!result.rowCount) throw Object.assign(new Error("Referral link not found."), { status: 404 });
      await client.query("INSERT INTO activity_logs (actor, action, referral_code) VALUES ($1,$2,$3)", ["Visitor", "Opened partner referral link", result.rows[0].code]);
      return result.rows[0];
    });
    return json(req, res, 200, mapReferralLink(updated));
  }

  if (req.method === "POST" && pathname === "/api/wallet-connections") {
    rateLimit(req, "public-write");
    const input = walletConnectionSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      const result = await client.query("INSERT INTO wallet_connections (referral_code, wallet_address, provider, project_slug) VALUES ($1,$2,$3,$4) RETURNING *", [input.referralCode, input.walletAddress, input.provider, input.projectSlug ?? null]);
      await client.query("UPDATE referral_links SET wallet_connects = wallet_connects + 1 WHERE code = $1", [input.referralCode]);
      await client.query("INSERT INTO activity_logs (actor, action, project_slug, referral_code) VALUES ($1,$2,$3,$4)", ["Wallet", `Connected ${input.provider}`, input.projectSlug ?? null, input.referralCode]);
      return result.rows[0];
    });
    return json(req, res, 201, mapWalletConnection(row));
  }

  if (req.method === "POST" && pathname === "/api/capital-interests") {
    rateLimit(req, "public-write");
    const input = capitalInterestSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO capital_interests (full_name, email, organization, wallet_address, connected_wallet_provider, referral_code, project_slug, pool_of_interest, intended_amount_usdc, role_type, accredited_self_attestation, jurisdiction, notes, status, confirmation_accepted, acknowledgements)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Pending Review',$14,$15::jsonb)
         RETURNING *`,
        [input.fullName, input.email, input.organization, input.walletAddress, input.connectedWalletProvider, input.referralCode, input.projectSlug, input.poolOfInterest, input.intendedAmountUSDC, input.roleType, input.accreditedSelfAttestation, input.jurisdiction, input.notes, input.confirmationAccepted, JSON.stringify(input.acknowledgements)],
      );
      await client.query("UPDATE referral_links SET submitted_interests = submitted_interests + 1 WHERE code = $1", [input.referralCode]);
      await client.query("INSERT INTO status_events (interest_id, from_status, to_status, actor) VALUES ($1,$2,$3,$4)", [result.rows[0].id, "New", "Pending Review", "system"]);
      await client.query("INSERT INTO activity_logs (actor, action, project_slug, referral_code) VALUES ($1,$2,$3,$4)", [input.fullName, "Submitted capital interest", input.projectSlug, input.referralCode]);
      return result.rows[0];
    });
    return json(req, res, 201, mapCapitalInterest(row));
  }

  if (req.method === "POST" && pathname === "/api/dataroom/access-requests") {
    const body = z.object({ partnerCode: z.string().min(1).max(80), projectSlug: z.string().min(1).max(120) }).parse(await readJson(req));
    const partner = await getPartnerByCode(body.partnerCode, req, true);
    const row = await transaction(async (client) => {
      const result = await client.query(`INSERT INTO dataroom_access (partner_id, project_slug, level, requested_at) VALUES ($1,$2,'requested',now()) ON CONFLICT (partner_id, project_slug) DO UPDATE SET level = 'requested', requested_at = now(), updated_at = now() RETURNING *`, [partner.id, body.projectSlug]);
      await client.query("INSERT INTO activity_logs (actor, action, project_slug, referral_code) VALUES ($1,$2,$3,$4)", [partner.name, "Requested dataroom access", body.projectSlug, partner.code]);
      return result.rows[0];
    });
    return json(req, res, 201, mapAccess(row));
  }

  if (req.method === "POST" && pathname === "/api/dataroom/events") {
    const partner = await getPartnerByCode(url.searchParams.get("partnerCode") ?? "", req, true);
    const input = dataroomEventSchema.parse(await readJson(req));
    const access = await query("SELECT 1 FROM dataroom_access WHERE partner_id = $1 AND project_slug = $2 AND level = 'granted'", [partner.id, input.projectSlug]);
    if (!access.rowCount && input.event !== "request_access") throw Object.assign(new Error("Dataroom access is not granted for this project."), { status: 403 });
    const id = randomUUID();
    await transaction(async (client) => {
      await client.query("INSERT INTO dataroom_events (id, document_id, project_slug, partner_id, event) VALUES ($1,$2,$3,$4,$5)", [id, input.documentId ?? null, input.projectSlug, partner.id, input.event]);
      if (input.documentId && input.event === "view") await client.query("UPDATE dataroom_documents SET views = views + 1 WHERE id = $1", [input.documentId]);
      if (input.documentId && input.event === "download") await client.query("UPDATE dataroom_documents SET downloads = downloads + 1 WHERE id = $1", [input.documentId]);
    });
    return json(req, res, 201, { id });
  }

  if (req.method === "GET" && pathname.startsWith("/api/dataroom/documents/") && pathname.endsWith("/access")) {
    const partner = await getPartnerByCode(url.searchParams.get("partnerCode") ?? "", req, true);
    const documentId = pathname.split("/")[4];
    const event = z.enum(["view", "download"]).parse(url.searchParams.get("event") ?? "view");
    const row = await transaction(async (client) => {
      const document = await client.query("SELECT * FROM dataroom_documents WHERE id = $1 AND visibility <> 'admin'", [documentId]);
      if (!document.rowCount) throw Object.assign(new Error("Document not found or not available to partner scope."), { status: 404 });
      const doc = document.rows[0];
      const access = await client.query("SELECT 1 FROM dataroom_access WHERE partner_id = $1 AND project_slug = $2 AND level = 'granted'", [partner.id, doc.project_slug]);
      if (!access.rowCount) throw Object.assign(new Error("Dataroom access is not granted for this project."), { status: 403 });
      if (doc.status !== "ready") throw Object.assign(new Error("Document is not ready for distribution."), { status: 409 });
      if (!doc.storage_uri) throw Object.assign(new Error("Document storage URI is not configured. Ask an admin to attach the approved storage object."), { status: 404 });
      await client.query("INSERT INTO dataroom_events (document_id, project_slug, partner_id, event) VALUES ($1,$2,$3,$4)", [doc.id, doc.project_slug, partner.id, event]);
      if (event === "view") await client.query("UPDATE dataroom_documents SET views = views + 1 WHERE id = $1", [doc.id]);
      if (event === "download") await client.query("UPDATE dataroom_documents SET downloads = downloads + 1 WHERE id = $1", [doc.id]);
      return doc;
    });
    return json(req, res, 200, { url: row.storage_uri, document: mapDocument(row), event });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/admin/capital-interests/") && pathname.endsWith("/status")) {
    requireAdmin(req);
    const id = pathname.split("/")[4];
    const input = statusUpdateSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      const existing = await client.query("SELECT * FROM capital_interests WHERE id = $1", [id]);
      if (!existing.rowCount) throw Object.assign(new Error("Capital interest not found."), { status: 404 });
      await assertStatusTransitionAllowed(client, existing.rows[0], input.status);
      const result = await client.query("UPDATE capital_interests SET status = $1 WHERE id = $2 RETURNING *", [input.status, id]);
      await client.query("INSERT INTO status_events (interest_id, from_status, to_status, actor) VALUES ($1,$2,$3,$4)", [id, existing.rows[0].status, input.status, "admin"]);
      await client.query("INSERT INTO activity_logs (actor, action, project_slug, referral_code) VALUES ($1,$2,$3,$4)", ["MindLaunch Admin", `Updated lead status to ${input.status}`, existing.rows[0].project_slug, existing.rows[0].referral_code]);
      return result.rows[0];
    });
    return json(req, res, 200, mapCapitalInterest(row));
  }

  if (req.method === "POST" && pathname === "/api/admin/compliance-reviews") {
    requireAdmin(req);
    const input = complianceReviewSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      const interest = await client.query("SELECT id, project_slug, referral_code FROM capital_interests WHERE id = $1", [input.interestId]);
      if (!interest.rowCount) throw Object.assign(new Error("Capital interest not found."), { status: 404 });
      const result = await client.query(
        `INSERT INTO compliance_reviews (interest_id, status, provider, external_reference, reviewed_by, reviewed_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,CASE WHEN $2 IN ('verified','rejected','expired') THEN now() ELSE NULL END,$6)
         ON CONFLICT (interest_id) DO UPDATE SET status = EXCLUDED.status, provider = EXCLUDED.provider, external_reference = EXCLUDED.external_reference, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = CASE WHEN EXCLUDED.status IN ('verified','rejected','expired') THEN now() ELSE compliance_reviews.reviewed_at END, expires_at = EXCLUDED.expires_at, updated_at = now()
         RETURNING *`,
        [input.interestId, input.status, input.provider || null, input.externalReference || null, input.reviewedBy || null, input.expiresAt ?? null],
      );
      if (input.status === "verified") {
        await client.query("UPDATE capital_interests SET status = 'Accredited Verified' WHERE id = $1 AND status NOT IN ('Approved','Soft Committed','Funded','Closed')", [input.interestId]);
        await client.query("INSERT INTO status_events (interest_id, from_status, to_status, actor) VALUES ($1,$2,$3,$4)", [input.interestId, interest.rows[0].status, "Accredited Verified", "admin"]);
      }
      await client.query("INSERT INTO activity_logs (actor, action, project_slug, referral_code) VALUES ($1,$2,$3,$4)", ["MindLaunch Compliance", `Compliance review marked ${input.status}`, interest.rows[0].project_slug, interest.rows[0].referral_code]);
      return result.rows[0];
    });
    return json(req, res, 200, mapComplianceReview(row));
  }

  if (req.method === "POST" && pathname === "/api/admin/approved-wallets") {
    requireAdmin(req);
    const input = approvedWalletSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      if (input.interestId) {
        const interest = await client.query("SELECT wallet_address FROM capital_interests WHERE id = $1", [input.interestId]);
        if (!interest.rowCount) throw Object.assign(new Error("Capital interest not found."), { status: 404 });
      }
      if (input.partnerId) {
        const partner = await client.query("SELECT id FROM partners WHERE id = $1", [input.partnerId]);
        if (!partner.rowCount) throw Object.assign(new Error("Partner not found."), { status: 404 });
      }
      const result = await client.query(
        `INSERT INTO approved_wallets (wallet_address, partner_id, interest_id, chain_id, approved_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (lower(wallet_address), chain_id) DO UPDATE SET partner_id = EXCLUDED.partner_id, interest_id = EXCLUDED.interest_id, approved_by = EXCLUDED.approved_by, approved_at = now(), revoked_at = NULL
         RETURNING *`,
        [input.walletAddress, input.partnerId ?? null, input.interestId ?? null, input.chainId, "MindLaunch Admin"],
      );
      await client.query("INSERT INTO activity_logs (actor, action) VALUES ($1,$2)", ["MindLaunch Admin", `Approved wallet ${maskWallet(input.walletAddress)} on chain ${input.chainId}`]);
      return result.rows[0];
    });
    return json(req, res, 200, mapApprovedWallet(row));
  }

  if (req.method === "POST" && pathname === "/api/admin/settlement-intents") {
    requireAdmin(req);
    const input = settlementIntentSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      const interest = await client.query("SELECT * FROM capital_interests WHERE id = $1", [input.interestId]);
      if (!interest.rowCount) throw Object.assign(new Error("Capital interest not found."), { status: 404 });
      await assertStatusTransitionAllowed(client, interest.rows[0], "Soft Committed");
      const allowlist = await client.query("SELECT 1 FROM approved_wallets WHERE lower(wallet_address) = lower($1) AND chain_id = $2 AND revoked_at IS NULL LIMIT 1", [input.walletAddress, input.chainId]);
      if (!allowlist.rowCount) throw Object.assign(new Error("Settlement intent requires an approved wallet on the selected chain."), { status: 409 });
      const result = await client.query(
        `INSERT INTO settlement_intents (interest_id, wallet_address, chain_id, usdc_amount, status, created_by, expires_at)
         VALUES ($1,$2,$3,$4,'draft',$5,$6)
         RETURNING *`,
        [input.interestId, input.walletAddress, input.chainId, input.usdcAmount, "MindLaunch Admin", input.expiresAt ?? null],
      );
      await client.query("INSERT INTO activity_logs (actor, action, project_slug, referral_code) VALUES ($1,$2,$3,$4)", ["MindLaunch Admin", "Created settlement intent after compliance approval", interest.rows[0].project_slug, interest.rows[0].referral_code]);
      return result.rows[0];
    });
    return json(req, res, 201, mapSettlementIntent(row));
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/admin/settlement-intents/") && pathname.endsWith("/status")) {
    requireAdmin(req);
    const id = pathname.split("/")[4];
    const input = settlementIntentStatusSchema.parse(await readJson(req));
    if (input.status === "confirmed" && !input.txHash) throw Object.assign(new Error("Confirmed settlement intents require a transaction hash."), { status: 400 });
    const row = await transaction(async (client) => {
      const existing = await client.query("SELECT * FROM settlement_intents WHERE id = $1", [id]);
      if (!existing.rowCount) throw Object.assign(new Error("Settlement intent not found."), { status: 404 });
      const result = await client.query(
        `UPDATE settlement_intents
         SET status = $1, tx_hash = COALESCE($2, tx_hash), approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE approved_by END, approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END
         WHERE id = $4
         RETURNING *`,
        [input.status, input.txHash ?? null, "MindLaunch Admin", id],
      );
      await client.query("INSERT INTO activity_logs (actor, action) VALUES ($1,$2)", ["MindLaunch Admin", `Settlement intent marked ${input.status}`]);
      return result.rows[0];
    });
    return json(req, res, 200, mapSettlementIntent(row));
  }

  if (req.method === "POST" && pathname === "/api/admin/dataroom/access") {
    requireAdmin(req);
    const input = dataroomAccessSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      const result = await client.query(`INSERT INTO dataroom_access (partner_id, project_slug, level, granted_by, granted_at, requested_at) VALUES ($1,$2,$3,$4,CASE WHEN $3 = 'granted' THEN now() ELSE NULL END, CASE WHEN $3 = 'requested' THEN now() ELSE NULL END) ON CONFLICT (partner_id, project_slug) DO UPDATE SET level = EXCLUDED.level, granted_by = CASE WHEN EXCLUDED.level = 'granted' THEN EXCLUDED.granted_by ELSE dataroom_access.granted_by END, granted_at = CASE WHEN EXCLUDED.level = 'granted' THEN now() ELSE dataroom_access.granted_at END, updated_at = now() RETURNING *`, [input.partnerId, input.projectSlug, input.level, "MindLaunch Admin"]);
      await client.query("INSERT INTO activity_logs (actor, action, project_slug) VALUES ($1,$2,$3)", ["MindLaunch Admin", `${input.level === "granted" ? "Granted" : "Revoked"} dataroom access`, input.projectSlug]);
      return result.rows[0];
    });
    return json(req, res, 200, mapAccess(row));
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/admin/dataroom/documents/")) {
    requireAdmin(req);
    const id = pathname.split("/")[5];
    const input = documentMetadataSchema.parse(await readJson(req));
    const row = await transaction(async (client) => {
      const existing = await client.query("SELECT * FROM dataroom_documents WHERE id = $1", [id]);
      if (!existing.rowCount) throw Object.assign(new Error("Dataroom document not found."), { status: 404 });
      const result = await client.query(
        `UPDATE dataroom_documents
         SET title = COALESCE($1, title), category = COALESCE($2, category), version = COALESCE($3, version), visibility = COALESCE($4, visibility), status = COALESCE($5, status), storage_uri = $6
         WHERE id = $7
         RETURNING *`,
        [input.title ?? null, input.category ?? null, input.version ?? null, input.visibility ?? null, input.status ?? null, input.storageUri === undefined ? existing.rows[0].storage_uri : input.storageUri || null, id],
      );
      await client.query("INSERT INTO activity_logs (actor, action, project_slug) VALUES ($1,$2,$3)", ["MindLaunch Admin", "Updated dataroom document metadata", result.rows[0].project_slug]);
      return result.rows[0];
    });
    return json(req, res, 200, mapDocument(row, true));
  }

  if (req.method === "POST" && pathname === "/api/admin/admin-notes") {
    requireAdmin(req);
    const input = adminNoteSchema.parse(await readJson(req));
    const row = await query("INSERT INTO admin_notes (interest_id, author, body, private) VALUES ($1,$2,$3,true) RETURNING *", [input.interestId, "MindLaunch Admin", input.body]);
    return json(req, res, 201, mapAdminNote(row.rows[0]));
  }

  return json(req, res, 404, { error: "Not found." });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    const status = error.status ?? (error instanceof z.ZodError ? 400 : 500);
    json(req, res, status, { error: error.message, details: error instanceof z.ZodError ? error.issues : undefined });
  });
});

server.listen(apiConfig.port, () => {
  console.log(`MindLaunch Capital Gateway API listening on http://127.0.0.1:${apiConfig.port}`);
});
