import { ArrowRight, Bot, Check, CircleDollarSign, Clipboard, Database, Download, Eye, FileText, Filter, FolderLock, KeyRound, Landmark, LockKeyhole, Network, Search, ShieldCheck, Sparkles, UserRoundCheck, Users, WalletCards } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { CAPITAL_STATUSES } from "./capitalData";
import { BASE_USDC_CONFIG, getPartnerByCode, getPartnerLink, getProject, maskEmail, maskWallet, partnerProjectAccess, useCapitalGateway, visiblePartnerDocuments } from "./capitalServices";
import type { CapitalInterest, CapitalRoleType, CapitalStatus, DataroomDocument, Partner, Project } from "./capitalTypes";
import { Metric, PageTitle, SectionHead, Status, WalletButton, type WalletView } from "./components";
import type { WalletAddress } from "./types";
import { formatUSDC, shortenWalletAddress } from "./utils";

const ROLE_OPTIONS: Array<{ value: CapitalRoleType; label: string }> = [
  { value: "LP", label: "LP" },
  { value: "GP", label: "GP" },
  { value: "advisor", label: "Advisor" },
  { value: "builder", label: "Builder" },
  { value: "founder", label: "Founder" },
  { value: "strategic_partner", label: "Strategic partner" },
];

function useCapitalContext() {
  const gateway = useCapitalGateway();
  const [search] = useSearchParams();
  const params = useParams();
  const referralCode = params.partnerCode ?? search.get("ref") ?? "WOLFDEN-ALPHA";
  const partner = getPartnerByCode(gateway.state, referralCode) ?? gateway.state.partners[0];
  const projectSlug = params.projectSlug ?? search.get("project") ?? gateway.state.projects[0]?.slug ?? "";
  const project = getProject(gateway.state, projectSlug) ?? gateway.state.projects[0];
  return { ...gateway, referralCode, partner, project };
}

function CapitalStateBoundary({ children }: { children: ReactNode }) {
  const { isLoading, error, state, saveAccessToken, clearAccessToken } = useCapitalGateway();
  const location = useLocation();
  const needsAdminToken = location.pathname.startsWith("/admin/") && /admin api|CAPITAL_ADMIN_API_TOKEN/i.test(error);
  const needsPartnerToken = location.pathname.startsWith("/partner/") && /partner portal|access denied/i.test(error);
  if (isLoading) return <div className="capital-page"><section className="panel capital-state-panel"><Status tone="cyan">loading</Status><h2>Loading Capital Gateway data</h2><p>MindLaunch is connecting to the backend API.</p></section></div>;
  if (error) return <div className="capital-page"><section className="panel capital-state-panel"><Status tone="warn">api required</Status><h2>Capital Gateway backend is not available</h2><p>{error}</p>{needsAdminToken || needsPartnerToken ? <AccessTokenPanel scope={needsAdminToken ? "admin" : "partner"} onSave={saveAccessToken} onClear={clearAccessToken} /> : <p>Run the API with a configured Postgres DATABASE_URL, then refresh this page.</p>}</section></div>;
  if (!state.projects.length || !state.partners.length) return <div className="capital-page"><section className="panel capital-state-panel"><Status tone="warn">database empty</Status><h2>No Capital Gateway records found</h2><p>Run database migrations and seed the MindLaunch projects before opening this route.</p></section></div>;
  return children;
}

function AccessTokenPanel({ scope, onSave, onClear }: { scope: "partner" | "admin"; onSave: (scope: "partner" | "admin", token: string) => void; onClear: (scope: "partner" | "admin") => void }) {
  const [token, setToken] = useState("");
  return <div className="access-token-panel">
    <strong>{scope === "admin" ? "Admin API token required" : "Partner portal token required"}</strong>
    <p>Enter the server-issued token for this browser session. Production tokens are never bundled into the Vite build.</p>
    <div><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={scope === "admin" ? "CAPITAL_ADMIN_API_TOKEN" : "Partner portal token"} /><button className="button primary" onClick={() => onSave(scope, token)}>Unlock</button><button className="button ghost" onClick={() => onClear(scope)}>Clear</button></div>
  </div>;
}

function providerLabel(wallet: WalletView) {
  return wallet.providerName ?? (wallet.isConnected ? "Injected Wallet" : "Not connected");
}

function LaikaPanel({ project, compact = false }: { project?: Project; compact?: boolean }) {
  const items = [
    "MindLaunch is a post-AI venture studio and private capital platform.",
    project ? `${project.name} is currently routed as ${project.category} at ${project.stage}.` : "Project fit depends on role, jurisdiction, timing, and diligence access.",
    "Compliance review is required before any funding step or document package is released.",
    "USDC is prepared only as a future settlement rail for approved wallets.",
  ];
  return <aside className={compact ? "laika-panel compact" : "laika-panel"}>
    <div className="laika-orb"><Bot /><Sparkles size={14} /></div>
    <span className="mono-label">LAIKA CAPITAL GUIDE</span>
    <h2>Laika helps route capital, founders, and partners across the MindLaunch ecosystem.</h2>
    <div className="laika-steps">{items.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}</div>
    <div className="compliance-mini"><ShieldCheck size={16} />This is an interest and routing workflow, not an investment checkout.</div>
  </aside>;
}

function ComplianceCopy() {
  return <div className="capital-disclaimer">
    <strong>Compliance notice</strong>
    <p>This is not an offer to sell securities. Submitting interest does not guarantee eligibility or allocation. Participation is subject to identity, accreditation, jurisdiction, sanctions, suitability, offering-document, and admin/compliance review. USDC is used only as a potential settlement/payment rail after approval and allowlisting. Referral attribution does not automatically create transaction-based compensation.</p>
    <p>Participants are responsible for accurate information, wallet custody, network selection, tax and legal review, and reviewing final documents before any funding step. MindLaunch may decline, pause, revoke dataroom access, or request additional documentation at any time to protect the platform, projects, partners, and users.</p>
  </div>;
}

function ProjectCards({ projects, referralCode }: { projects: Project[]; referralCode: string }) {
  return <div className="capital-project-grid">{projects.map((project) => <article key={project.slug} className={`capital-project-card ${project.priority}`}>
    <div className="project-card-top"><Status tone={project.priority === "active" ? "ok" : project.priority === "watchlist" ? "cyan" : "muted"}>{project.stage}</Status><span>{project.category}</span></div>
    <h3>{project.name}</h3>
    <p>{project.shortDescription}</p>
    <dl>
      <div><dt>Status</dt><dd>{project.fundingStatus}</dd></div>
      <div><dt>Partner fit</dt><dd>{project.preferredPartnerType}</dd></div>
      <div><dt>Dataroom</dt><dd>{project.dataroomAvailability.replace("_", " ")}</dd></div>
    </dl>
    <div className="project-card-actions">
      <Link className="button ghost" to={`/launch/${project.slug}?ref=${referralCode}`}>Explore with Laika <ArrowRight size={14} /></Link>
      <Link className="button primary" to={`/capital-gateway?project=${project.slug}&ref=${referralCode}#interest`}>Submit Interest</Link>
      <Link className="text-button" to={`/partner/dataroom/${project.slug}`}>Request Dataroom Access <FolderLock size={13} /></Link>
    </div>
  </article>)}</div>;
}

function CapitalInterestForm({ wallet, referralCode, defaultProject }: { wallet: WalletView; referralCode: string; defaultProject: Project }) {
  const { state, submitInterest } = useCapitalGateway();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    organization: "",
    projectSlug: defaultProject.slug,
    poolOfInterest: defaultProject.pool,
    intendedAmountUSDC: "50000",
    roleType: "LP" as CapitalRoleType,
    accreditedSelfAttestation: false,
    jurisdiction: "United States",
    notes: "",
    acknowledgements: {
      indicationOnly: false,
      noOfferOrAllocation: false,
      eligibilityReview: false,
      usdcSettlementRail: false,
      referralNoAutomaticCompensation: false,
      riskAndIlliquidity: false,
      accurateInformation: false,
    },
  });

  const selectedProject = getProject(state, form.projectSlug) ?? defaultProject;
  const setField = (name: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [name]: value, ...(name === "projectSlug" ? { poolOfInterest: getProject(state, String(value))?.pool ?? current.poolOfInterest } : {}) }));
  const setAcknowledgement = (name: keyof typeof form.acknowledgements, value: boolean) => setForm((current) => ({ ...current, acknowledgements: { ...current.acknowledgements, [name]: value } }));
  const acknowledgementAccepted = Object.values(form.acknowledgements).every(Boolean);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await submitInterest({
      ...form,
      walletAddress: wallet.address,
      connectedWalletProvider: providerLabel(wallet),
      referralCode,
      intendedAmountUSDC: Number(form.intendedAmountUSDC) || 0,
      confirmationAccepted: acknowledgementAccepted,
      acknowledgements: form.acknowledgements as CapitalInterest["acknowledgements"],
    });
    setMessage(result.ok ? "Interest submitted. Laika has routed this into pending compliance review." : result.errors.join(" "));
  };

  return <form id="interest" className="capital-form panel" onSubmit={(event) => void submit(event)}>
    <div className="form-head"><SectionHead label="CAPITAL INTEREST" title="Submit capital or partner interest" copy="The workflow records intent, role, source, wallet context, and review status. No funds move here." /><Status tone={wallet.isConnected ? "ok" : "warn"}>{wallet.isConnected ? "wallet connected" : "wallet optional for inquiry"}</Status></div>
    {message ? <div className="toast"><Check size={14} />{message}</div> : null}
    <div className="capital-form-grid">
      <label>Full name<input value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} /></label>
      <label>Email<input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} /></label>
      <label>Organization/company<input value={form.organization} onChange={(event) => setField("organization", event.target.value)} /></label>
      <label>Wallet address<input value={wallet.address || ""} readOnly placeholder="Connect Coinbase Wallet or MetaMask" /></label>
      <label>Connected wallet provider<input value={providerLabel(wallet)} readOnly /></label>
      <label>Referral code<input value={referralCode} readOnly /></label>
      <label>Project of interest<select value={form.projectSlug} onChange={(event) => setField("projectSlug", event.target.value)}>{state.projects.map((project) => <option key={project.slug} value={project.slug}>{project.name}</option>)}</select></label>
      <label>Pool of interest<input value={selectedProject.pool} readOnly /></label>
      <label>Intended amount in USDC<input type="number" min="0" value={form.intendedAmountUSDC} onChange={(event) => setField("intendedAmountUSDC", event.target.value)} /></label>
      <label>Role type<select value={form.roleType} onChange={(event) => setField("roleType", event.target.value as CapitalRoleType)}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
      <label>Jurisdiction<input value={form.jurisdiction} onChange={(event) => setField("jurisdiction", event.target.value)} /></label>
      <label className="check-field"><input type="checkbox" checked={form.accreditedSelfAttestation} onChange={(event) => setField("accreditedSelfAttestation", event.target.checked)} /> Accredited investor self-attestation</label>
      <label className="form-wide">Notes<textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Share fit, timing, desired involvement, or diligence needs." /></label>
      <div className="acknowledgement-grid form-wide">
        <strong>Participant acknowledgements</strong>
        <label className="check-field"><input type="checkbox" checked={form.acknowledgements.indicationOnly} onChange={(event) => setAcknowledgement("indicationOnly", event.target.checked)} /> This submission is only an indication of interest and not a completed investment.</label>
        <label className="check-field"><input type="checkbox" checked={form.acknowledgements.noOfferOrAllocation} onChange={(event) => setAcknowledgement("noOfferOrAllocation", event.target.checked)} /> This page is not an offer to sell securities and does not guarantee eligibility or allocation.</label>
        <label className="check-field"><input type="checkbox" checked={form.acknowledgements.eligibilityReview} onChange={(event) => setAcknowledgement("eligibilityReview", event.target.checked)} /> Participation is subject to verification, approval, offering documents, and applicable law.</label>
        <label className="check-field"><input type="checkbox" checked={form.acknowledgements.usdcSettlementRail} onChange={(event) => setAcknowledgement("usdcSettlementRail", event.target.checked)} /> USDC is only a potential future settlement/payment rail after admin approval and approved-wallet allowlisting.</label>
        <label className="check-field"><input type="checkbox" checked={form.acknowledgements.referralNoAutomaticCompensation} onChange={(event) => setAcknowledgement("referralNoAutomaticCompensation", event.target.checked)} /> Referral attribution does not automatically create transaction-based compensation.</label>
        <label className="check-field"><input type="checkbox" checked={form.acknowledgements.riskAndIlliquidity} onChange={(event) => setAcknowledgement("riskAndIlliquidity", event.target.checked)} /> Private venture participation may be speculative, illiquid, and involve risk of loss.</label>
        <label className="check-field"><input type="checkbox" checked={form.acknowledgements.accurateInformation} onChange={(event) => setAcknowledgement("accurateInformation", event.target.checked)} /> I am responsible for providing accurate identity, wallet, jurisdiction, and eligibility information.</label>
      </div>
    </div>
    <div className="form-actions"><button className="button primary" type="submit" disabled={!acknowledgementAccepted}>Submit Capital Interest</button><span>Review status starts at Pending Review.</span></div>
  </form>;
}

function GatewayHero({ wallet, partner, referralCode, project }: { wallet: WalletView; partner: Partner; referralCode: string; project?: Project }) {
  const { recordWalletConnection } = useCapitalGateway();
  const connect = async (provider: "Coinbase Wallet" | "MetaMask") => {
    await wallet.connect(provider);
    if (wallet.address) await recordWalletConnection({ referralCode, walletAddress: wallet.address, provider, projectSlug: project?.slug });
  };
  return <section className="capital-hero">
    <div className="capital-hero-copy">
      <span className="capital-brandline">MindLaunch Capital Gateway</span>
      <h1>Private capital routing for the MindLaunch ecosystem.</h1>
      <p>Explore post-AI ventures, submit capital or strategic partner interest, and request compliance-gated dataroom access with Laika guiding the next step.</p>
      <div className="hero-actions">
        <button className="button primary" onClick={() => document.getElementById("interest")?.scrollIntoView({ behavior: "smooth" })}>Submit Capital Interest</button>
        <Link className="button ghost" to="/laika/capital">Connect with Laika</Link>
        <button className="button outline" onClick={() => void connect("Coinbase Wallet")}>Coinbase Wallet</button>
        <button className="button outline" onClick={() => void connect("MetaMask")}>MetaMask</button>
      </div>
      <div className="capital-trust-strip">
        <div><span>Referral source</span><strong>{partner.organization}</strong></div>
        <div><span>Partner code</span><strong>{referralCode}</strong></div>
        <div><span>Wallet</span><strong>{wallet.isConnected ? shortenWalletAddress(wallet.address) : "Not connected"}</strong></div>
      </div>
    </div>
    <LaikaPanel project={project} />
  </section>;
}

export function CapitalGatewayPage({ wallet }: { wallet: WalletView }) {
  const { state, metrics, referralCode, partner, project } = useCapitalContext();
  return <CapitalStateBoundary><div className="capital-page">
    <GatewayHero wallet={wallet} partner={partner} referralCode={referralCode} project={project} />
    <section className="capital-metrics">
      <Metric label="Referral visits" value={String(metrics.totalVisits)} detail="tracked partner links" icon={<Network />} />
      <Metric label="Wallet connects" value={String(metrics.walletConnects)} detail="Coinbase, MetaMask, injected" icon={<WalletCards />} />
      <Metric label="Submitted interests" value={String(metrics.submittedInterests)} detail="pending review included" icon={<Users />} />
      <Metric label="Qualified interest" value={formatUSDC(metrics.softCommitted)} detail="non-binding pipeline" icon={<CircleDollarSign />} />
    </section>
    <section className="capital-section">
      <SectionHead label="ECOSYSTEM VENTURES" title="Explore active MindLaunch ventures" copy="Projects are routed by partner fit, compliance readiness, and dataroom availability." action={<Link className="button ghost" to="/partner/dataroom">Open dataroom</Link>} />
      <ProjectCards projects={state.projects} referralCode={referralCode} />
    </section>
    <section className="capital-workflow">
      <CapitalInterestForm wallet={wallet} referralCode={referralCode} defaultProject={project} />
      <PipelinePanel interests={state.capitalInterests.slice(0, 5)} />
    </section>
    <CapitalUsdcReadinessPanel />
    <ComplianceCopy />
  </div></CapitalStateBoundary>;
}

export function InvitePage({ wallet }: { wallet: WalletView }) {
  return <CapitalGatewayPage wallet={wallet} />;
}

export function LaunchProjectPage({ wallet }: { wallet: WalletView }) {
  const { state, referralCode, partner, project } = useCapitalContext();
  return <CapitalStateBoundary><div className="capital-page">
    <GatewayHero wallet={wallet} partner={partner} referralCode={referralCode} project={project} />
    <section className="capital-section launch-focus">
      <div>
        <Status tone="ok">{project.stage}</Status>
        <h2>{project.name}</h2>
        <p>{project.shortDescription}</p>
        <dl>
          <div><dt>Category</dt><dd>{project.category}</dd></div>
          <div><dt>Funding or partner status</dt><dd>{project.fundingStatus}</dd></div>
          <div><dt>Preferred partner type</dt><dd>{project.preferredPartnerType}</dd></div>
          <div><dt>Dataroom availability</dt><dd>{project.dataroomAvailability.replace("_", " ")}</dd></div>
        </dl>
      </div>
      <LaikaPanel project={project} compact />
    </section>
    <section className="capital-workflow">
      <CapitalInterestForm wallet={wallet} referralCode={referralCode} defaultProject={project} />
      <DataroomPreview project={project} documents={state.dataroomDocuments.filter((doc) => doc.projectSlug === project.slug)} />
    </section>
    <ComplianceCopy />
  </div></CapitalStateBoundary>;
}

export function LaikaCapitalPage({ wallet }: { wallet: WalletView }) {
  const { state, referralCode, project } = useCapitalContext();
  return <CapitalStateBoundary><div className="capital-page">
    <PageTitle index="AI" title="Laika Capital Guide" copy="Laika explains MindLaunch, routes partner fit, clarifies documents, and keeps compliance review ahead of any funding step."><WalletButton wallet={wallet} /></PageTitle>
    <div className="laika-command">
      <LaikaPanel project={project} />
      <section className="panel laika-console">
        <SectionHead label="ROUTING PROMPTS" title="Ask Laika where you fit" />
        {["I am an LP reviewing venture exposure.", "I am a builder looking for an AI/Web3 operating role.", "I need project documents after approval.", "Why is compliance review required before USDC settlement?"].map((prompt) => <button key={prompt}><Bot size={16} />{prompt}<ArrowRight size={14} /></button>)}
      </section>
      <ProjectCards projects={state.projects.slice(0, 4)} referralCode={referralCode} />
    </div>
  </div></CapitalStateBoundary>;
}

function PipelinePanel({ interests }: { interests: CapitalInterest[] }) {
  return <section className="pipeline-panel panel">
    <SectionHead label="REVIEW PIPELINE" title="Recent routed interest" copy="Partner views mask sensitive investor data unless explicit permission is granted." />
    <div className="pipeline-list">{interests.map((interest) => <div key={interest.id}>
      <Status tone={interest.status === "Rejected" ? "warn" : interest.status === "Approved" || interest.status === "Soft Committed" ? "ok" : "cyan"}>{interest.status}</Status>
      <strong>{interest.organization}</strong>
      <span>{getProjectName(interest.projectSlug)} / {interest.roleType}</span>
      <b>{formatUSDC(interest.intendedAmountUSDC)}</b>
    </div>)}</div>
  </section>;
}

function getProjectName(slug: string) {
  return slug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function isWalletAddress(value: string): value is WalletAddress {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function PartnerDashboardPage() {
  const { state, metrics, partner } = useCapitalContext();
  const link = getPartnerLink(state, partner.id);
  const [copied, setCopied] = useState(false);
  const leads = state.capitalInterests.filter((interest) => interest.referralCode === partner.code);
  const softCommitted = leads.filter((lead) => ["Soft Committed", "Approved", "Funded"].includes(lead.status)).reduce((sum, lead) => sum + lead.intendedAmountUSDC, 0);
  const copy = async () => {
    await navigator.clipboard?.writeText(`${window.location.origin}${link?.url ?? `/invite/${partner.code}`}`);
    setCopied(true);
  };
  return <CapitalStateBoundary><div className="capital-page">
    <PageTitle index="PR" title="Partner Dashboard" copy="Track referral activity, routed leads, dataroom access, and requested next steps."><button className="button primary" onClick={() => void copy()}><Clipboard size={15} />{copied ? "Copied" : "Copy link"}</button></PageTitle>
    <section className="partner-profile panel">
      <div><span className="mono-label">PARTNER PROFILE</span><h2>{partner.name}</h2><p>{partner.organization} / {partner.role.replace("_", " ")}</p></div>
      <code>{window.location.origin}{link?.url ?? `/invite/${partner.code}`}</code>
    </section>
    <section className="capital-metrics">
      <Metric label="Total link visits" value={String(link?.visits ?? metrics.totalVisits)} icon={<Eye />} />
      <Metric label="Wallet connects" value={String(link?.walletConnects ?? 0)} icon={<WalletCards />} />
      <Metric label="Submitted interests" value={String(leads.length)} icon={<UserRoundCheck />} />
      <Metric label="Qualified interest" value={formatUSDC(softCommitted)} icon={<CircleDollarSign />} />
    </section>
    <section className="partner-layout">
      <PartnerLeadTable leads={leads} />
      <PartnerAccessPanel partner={partner} />
      <RecentActivity />
    </section>
  </div></CapitalStateBoundary>;
}

function PartnerLeadTable({ leads }: { leads: CapitalInterest[] }) {
  return <section className="panel partner-leads">
    <SectionHead label="REFERRED LEADS" title="Lead status pipeline" />
    <div className="capital-table-wrap"><table><thead><tr><th>Lead</th><th>Project</th><th>Role</th><th>Status</th><th>Amount</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td>{lead.organization}<small>{maskEmail(lead.email)} / {maskWallet(lead.walletAddress)}</small></td><td>{getProjectName(lead.projectSlug)}</td><td>{lead.roleType}</td><td><Status tone="cyan">{lead.status}</Status></td><td>{formatUSDC(lead.intendedAmountUSDC)}</td></tr>)}</tbody></table></div>
  </section>;
}

function PartnerAccessPanel({ partner }: { partner: Partner }) {
  const { state } = useCapitalGateway();
  return <section className="panel access-panel">
    <SectionHead label="PROJECT ACCESS" title="Dataroom permissions" />
    {state.projects.map((project) => {
      const level = partnerProjectAccess(state, partner.id, project.slug);
      return <div key={project.slug}><span>{project.name}</span><Status tone={level === "granted" ? "ok" : level === "requested" ? "cyan" : "muted"}>{level}</Status></div>;
    })}
  </section>;
}

function RecentActivity() {
  const { state } = useCapitalGateway();
  return <section className="panel recent-capital-activity">
    <SectionHead label="RECENT ACTIVITY" title="Requested next steps" />
    {state.activityLogs.slice(0, 6).map((log) => <div key={log.id}><i /><div><strong>{log.action}</strong><small>{log.actor} / {log.projectSlug ? getProjectName(log.projectSlug) : log.referralCode}</small></div></div>)}
  </section>;
}

export function PartnerDataroomPage() {
  const { state, partner, project } = useCapitalContext();
  const params = useParams();
  const documents = visiblePartnerDocuments(state, partner, params.projectSlug);
  const visibleProjects = state.projects.filter((item) => partnerProjectAccess(state, partner.id, item.slug) === "granted");
  return <CapitalStateBoundary><div className="capital-page">
    <PageTitle index="DR" title="Partner Dataroom" copy="Approved partners only see projects they have permission to access. Locked projects remain request-only until admin approval." />
    <section className="dataroom-layout">
      <aside className="panel dataroom-projects">
        <SectionHead label="PROJECTS" title="Access scope" />
        {state.projects.map((item) => {
          const level = partnerProjectAccess(state, partner.id, item.slug);
          return <Link key={item.slug} to={`/partner/dataroom/${item.slug}`} className={item.slug === project.slug ? "active" : ""}><span>{item.name}</span><Status tone={level === "granted" ? "ok" : level === "requested" ? "cyan" : "muted"}>{level === "granted" ? "granted" : level === "requested" ? "requested" : "request access"}</Status></Link>;
        })}
      </aside>
      <section className="panel document-panel">
        <SectionHead label="DOCUMENTS" title={params.projectSlug ? project.name : "Granted project documents"} copy={visibleProjects.length ? `${visibleProjects.length} approved project scopes` : "No granted datarooms yet."} />
        <DocumentTable documents={documents} partnerCode={partner.code} projectSlug={project.slug} />
      </section>
    </section>
  </div></CapitalStateBoundary>;
}

function DataroomPreview({ project, documents }: { project: Project; documents: ReturnType<typeof useCapitalGateway>["state"]["dataroomDocuments"] }) {
  return <section className="panel document-panel">
    <SectionHead label="DATAROOM PREVIEW" title={`${project.name} documents`} copy={project.dataroomAvailability === "coming_soon" ? "Document package coming soon." : "Access is compliance-gated by partner and project."} />
    <DocumentTable documents={documents} locked projectSlug={project.slug} />
  </section>;
}

function DocumentTable({ documents, locked = false, partnerCode, projectSlug }: { documents: ReturnType<typeof useCapitalGateway>["state"]["dataroomDocuments"]; locked?: boolean; partnerCode?: string; projectSlug?: string }) {
  const { requestDataroomAccess, openDataroomDocument } = useCapitalGateway();
  const [message, setMessage] = useState("");
  const requestAccess = async () => {
    if (partnerCode && projectSlug) await requestDataroomAccess(partnerCode, projectSlug);
  };
  const open = async (doc: DataroomDocument, event: "view" | "download") => {
    if (!partnerCode) return;
    setMessage("");
    try {
      await openDataroomDocument(partnerCode, doc, event);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Document access failed.");
    }
  };
  if (!documents.length) return <div className="empty-dataroom"><FolderLock /><h3>Request Access</h3><p>This project is locked or has no approved documents available yet.</p>{partnerCode && projectSlug ? <button className="button ghost" onClick={() => void requestAccess()}>Request Access</button> : null}</div>;
  return <div><>{message ? <div className="toast warn"><LockKeyhole size={14} />{message}</div> : null}</><div className="capital-table-wrap"><table><thead><tr><th>Document</th><th>Category</th><th>Project</th><th>Uploaded</th><th>Version</th><th>Visibility</th><th>Activity</th><th>Action</th></tr></thead><tbody>{documents.map((doc) => <tr key={doc.id}><td>{doc.title}</td><td>{doc.category}</td><td>{getProjectName(doc.projectSlug)}</td><td>{doc.uploadDate}</td><td>{doc.version}</td><td>{doc.visibility}</td><td>{doc.views} views / {doc.downloads} downloads</td><td>{locked || doc.status === "coming_soon" ? <button className="button ghost" onClick={() => void requestAccess()} disabled={doc.status === "coming_soon"}>{doc.status === "coming_soon" ? "Coming Soon" : "Request Access"}</button> : <div className="document-actions"><button className="button ghost" onClick={() => void open(doc, "view")}><Eye size={14} />View</button><button className="button ghost" onClick={() => void open(doc, "download")}><Download size={14} />Download</button></div>}</td></tr>)}</tbody></table></div></div>;
}

function AdminShell({ children }: { children: ReactNode }) {
  const links = [
    ["/admin/referrals", "Referrals"],
    ["/admin/capital-interest", "Capital Interest"],
    ["/admin/dataroom", "Dataroom"],
    ["/admin/projects", "Projects"],
    ["/admin/partners", "Partners"],
  ];
  const location = useLocation();
  return <div className="capital-page admin-capital">
    <PageTitle index="AD" title="Capital Gateway Admin" copy="Review referrals, capital interest, dataroom access, partner activity, project status, and pipeline movement." />
    <nav className="admin-tabs">{links.map(([to, label]) => <Link key={to} className={location.pathname === to ? "active" : ""} to={to}>{label}</Link>)}</nav>
    {children}
  </div>;
}

export function AdminReferralsPage() {
  const { state, metrics } = useCapitalGateway();
  return <CapitalStateBoundary><AdminShell>
    <section className="capital-metrics">
      <Metric label="Total referrals" value={String(metrics.totalReferrals)} icon={<Network />} />
      <Metric label="Qualified interest" value={formatUSDC(metrics.softCommitted)} icon={<CircleDollarSign />} />
      <Metric label="Top partner links" value={state.referralLinks[0]?.code ?? "-"} icon={<KeyRound />} />
      <Metric label="Document events" value={String(state.dataroomEvents.length)} icon={<Database />} />
    </section>
    <section className="panel"><SectionHead label="TOP PARTNER LINKS" title="Referral performance" /><div className="capital-table-wrap"><table><thead><tr><th>Partner</th><th>Code</th><th>Visits</th><th>Wallet connects</th><th>Submitted interests</th></tr></thead><tbody>{state.referralLinks.map((link) => <tr key={link.id}><td>{state.partners.find((p) => p.id === link.partnerId)?.organization}</td><td>{link.code}</td><td>{link.visits}</td><td>{link.walletConnects}</td><td>{link.submittedInterests}</td></tr>)}</tbody></table></div></section>
  </AdminShell></CapitalStateBoundary>;
}

export function AdminCapitalInterestPage() {
  const { state, updateLeadStatus, addAdminNote, upsertComplianceReview, approveWallet, createSettlementIntent } = useCapitalGateway();
  const [status, setStatus] = useState<CapitalStatus | "all">("all");
  const [project, setProject] = useState("all");
  const [note, setNote] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const leads = state.capitalInterests.filter((lead) => (status === "all" || lead.status === status) && (project === "all" || lead.projectSlug === project));
  const runAdminAction = async (action: () => Promise<void>) => {
    setAdminMessage("");
    try {
      await action();
      setAdminMessage("Admin action recorded.");
    } catch (caught) {
      setAdminMessage(caught instanceof Error ? caught.message : "Admin action failed.");
    }
  };
  return <CapitalStateBoundary><AdminShell>
    <div className="admin-filters"><label><Filter size={14} />Status<select value={status} onChange={(event) => setStatus(event.target.value as CapitalStatus | "all")}><option value="all">All</option>{CAPITAL_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><Search size={14} />Project<select value={project} onChange={(event) => setProject(event.target.value)}><option value="all">All</option>{state.projects.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label></div>
    {adminMessage ? <div className="toast warn"><ShieldCheck size={14} />{adminMessage}</div> : null}
    <section className="panel"><SectionHead label="RECENT SUBMISSIONS" title="Capital interest review" /><div className="capital-table-wrap"><table><thead><tr><th>Lead</th><th>Project</th><th>Role</th><th>Jurisdiction</th><th>Amount</th><th>Status</th><th>Compliance</th><th>Admin action</th></tr></thead><tbody>{leads.map((lead) => {
      const review = state.complianceReviews.find((item) => item.interestId === lead.id);
      const wallet = state.approvedWallets.find((item) => item.interestId === lead.id && !item.revokedAt);
      const settlement = state.settlementIntents.find((item) => item.interestId === lead.id);
      const leadWallet = isWalletAddress(lead.walletAddress) ? lead.walletAddress : undefined;
      return <tr key={lead.id}><td>{lead.fullName}<small>{lead.email} / {lead.organization}</small></td><td>{getProjectName(lead.projectSlug)}</td><td>{lead.roleType}</td><td>{lead.jurisdiction}</td><td>{formatUSDC(lead.intendedAmountUSDC)}</td><td><Status tone="cyan">{lead.status}</Status></td><td><small>Review: {review?.status ?? "not_started"}<br />Wallet: {wallet ? "allowlisted" : "not approved"}<br />Settlement: {settlement?.status ?? "none"}</small></td><td><div className="admin-action-stack"><select value={lead.status} onChange={(event) => void runAdminAction(() => updateLeadStatus(lead.id, event.target.value as CapitalStatus))}>{CAPITAL_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="button ghost" onClick={() => void runAdminAction(() => upsertComplianceReview(lead.id, "verified"))}>Mark verified</button>{leadWallet ? <button className="button ghost" onClick={() => void runAdminAction(() => approveWallet({ interestId: lead.id, walletAddress: leadWallet }))}>Approve wallet</button> : null}{leadWallet ? <button className="button ghost" onClick={() => void runAdminAction(() => createSettlementIntent({ interestId: lead.id, walletAddress: leadWallet, usdcAmount: lead.intendedAmountUSDC }))}>Create settlement intent</button> : null}</div></td></tr>;
    })}</tbody></table></div></section>
    <section className="panel admin-note-box"><SectionHead label="INTERNAL NOTES" title="Add private admin note" copy="Private notes are visible only in admin views." /><div><select id="note-lead">{state.capitalInterests.map((lead) => <option key={lead.id} value={lead.id}>{lead.organization} / {getProjectName(lead.projectSlug)}</option>)}</select><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add compliance, diligence, or routing note." /><button className="button primary" onClick={() => { const select = document.getElementById("note-lead") as HTMLSelectElement | null; void addAdminNote(select?.value ?? state.capitalInterests[0]?.id ?? "", note); setNote(""); }}>Add note</button></div></section>
  </AdminShell></CapitalStateBoundary>;
}

export function AdminDataroomPage() {
  const { state, setDataroomAccess, updateDocumentMetadata } = useCapitalGateway();
  const [storageById, setStorageById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const saveStorage = async (documentId: string) => {
    setMessage("");
    try {
      await updateDocumentMetadata(documentId, { storageUri: storageById[documentId] ?? "" });
      setMessage("Document metadata updated.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Document metadata update failed.");
    }
  };
  return <CapitalStateBoundary><AdminShell>
    <section className="capital-metrics"><Metric label="Access requests" value={String(state.dataroomAccess.filter((item) => item.level === "requested").length)} icon={<FolderLock />} /><Metric label="Granted scopes" value={String(state.dataroomAccess.filter((item) => item.level === "granted").length)} icon={<ShieldCheck />} /><Metric label="Documents" value={String(state.dataroomDocuments.length)} icon={<FileText />} /><Metric label="Views/downloads" value={String(state.dataroomEvents.length)} icon={<Eye />} /></section>
    <section className="panel"><SectionHead label="ACCESS CONTROL" title="Grant or revoke by partner and project" /><div className="capital-table-wrap"><table><thead><tr><th>Partner</th><th>Project</th><th>Access</th><th>Change</th></tr></thead><tbody>{state.partners.flatMap((partner) => state.projects.slice(0, 5).map((project) => { const level = partnerProjectAccess(state, partner.id, project.slug); return <tr key={`${partner.id}-${project.slug}`}><td>{partner.organization}</td><td>{project.name}</td><td><Status tone={level === "granted" ? "ok" : level === "requested" ? "cyan" : "muted"}>{level}</Status></td><td><div className="document-actions"><button className="button ghost" onClick={() => setDataroomAccess(partner.id, project.slug, "granted")}>Grant</button><button className="button ghost" onClick={() => setDataroomAccess(partner.id, project.slug, "revoked")}>Revoke</button></div></td></tr>; }))}</tbody></table></div></section>
    {message ? <div className="toast warn"><FileText size={14} />{message}</div> : null}
    <section className="panel"><SectionHead label="DOCUMENT METADATA" title="Manage dataroom documents" copy="Attach approved storage URLs from your secure object store. Partner views receive URLs only through the gated document access endpoint." /><div className="capital-table-wrap"><table><thead><tr><th>Document</th><th>Project</th><th>Category</th><th>Status</th><th>Storage URI</th><th>Save</th></tr></thead><tbody>{state.dataroomDocuments.map((doc) => <tr key={doc.id}><td>{doc.title}<small>{doc.version} / {doc.visibility}</small></td><td>{getProjectName(doc.projectSlug)}</td><td>{doc.category}</td><td><Status tone={doc.status === "ready" ? "ok" : "muted"}>{doc.status}</Status></td><td><input value={storageById[doc.id] ?? doc.storageUri ?? ""} onChange={(event) => setStorageById((current) => ({ ...current, [doc.id]: event.target.value }))} placeholder="Paste approved storage URL" /></td><td><button className="button ghost" onClick={() => void saveStorage(doc.id)}>Save URI</button></td></tr>)}</tbody></table></div></section>
  </AdminShell></CapitalStateBoundary>;
}

export function AdminProjectsPage() {
  const { state } = useCapitalGateway();
  const breakdown = state.projects.map((project) => ({ project, count: state.capitalInterests.filter((lead) => lead.projectSlug === project.slug).length }));
  return <CapitalStateBoundary><AdminShell>
    <section className="panel"><SectionHead label="PROJECT INTEREST BREAKDOWN" title="Project status and partner fit" /><div className="capital-table-wrap"><table><thead><tr><th>Project</th><th>Category</th><th>Stage</th><th>Status</th><th>Dataroom</th><th>Interest count</th></tr></thead><tbody>{breakdown.map(({ project, count }) => <tr key={project.slug}><td>{project.name}<small>{project.preferredPartnerType}</small></td><td>{project.category}</td><td>{project.stage}</td><td>{project.fundingStatus}</td><td>{project.dataroomAvailability.replace("_", " ")}</td><td>{count}</td></tr>)}</tbody></table></div></section>
  </AdminShell></CapitalStateBoundary>;
}

export function AdminPartnersPage() {
  const { state } = useCapitalGateway();
  return <CapitalStateBoundary><AdminShell>
    <section className="panel"><SectionHead label="PARTNER ACTIVITY LOGS" title="Partners and permissions" /><div className="capital-table-wrap"><table><thead><tr><th>Partner</th><th>Organization</th><th>Code</th><th>Role</th><th>Access level</th><th>Joined</th></tr></thead><tbody>{state.partners.map((partner) => <tr key={partner.id}><td>{partner.name}<small>{partner.email}</small></td><td>{partner.organization}</td><td>{partner.code}</td><td>{partner.role}</td><td>{partner.accessLevel}</td><td>{partner.joinedAt}</td></tr>)}</tbody></table></div></section>
    <RecentActivity />
  </AdminShell></CapitalStateBoundary>;
}

export function CapitalUsdcReadinessPanel() {
  return <section className="panel usdc-readiness">
    <SectionHead label="BASE L2 USDC READINESS" title="Future settlement rail is disabled" copy="Approved-wallet deposits are intentionally blocked until compliance review and admin approval exist." />
    <div><Landmark /><span>Chain</span><strong>{BASE_USDC_CONFIG.chainName} / {BASE_USDC_CONFIG.chainId}</strong></div>
    <div><CircleDollarSign /><span>USDC contract</span><strong>{BASE_USDC_CONFIG.usdcAddress}</strong></div>
    <div><LockKeyhole /><span>Settlement mode</span><strong>{BASE_USDC_CONFIG.settlementMode}</strong></div>
  </section>;
}
