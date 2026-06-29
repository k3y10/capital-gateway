import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BASE_CHAIN_ID, USDC_CONTRACT_ADDRESS } from "./config";
import type { ApprovedWallet, CapitalGatewayState, CapitalInterest, CapitalStatus, ComplianceReview, ComplianceReviewStatus, DataroomAccess, DataroomDocument, Partner, SettlementIntent, SettlementIntentStatus, WalletConnection } from "./capitalTypes";
import type { WalletAddress } from "./types";

const EMPTY_CAPITAL_STATE: CapitalGatewayState = {
  users: [],
  partners: [],
  referralLinks: [],
  projects: [],
  capitalInterests: [],
  walletConnections: [],
  dataroomDocuments: [],
  dataroomAccess: [],
  dataroomEvents: [],
  statusEvents: [],
  adminNotes: [],
  activityLogs: [],
  complianceReviews: [],
  approvedWallets: [],
  settlementIntents: [],
};

const CAPITAL_API_BASE_URL = import.meta.env.VITE_CAPITAL_API_BASE_URL ?? "";
const ADMIN_API_TOKEN = import.meta.env.DEV ? (import.meta.env.VITE_CAPITAL_ADMIN_API_TOKEN ?? "") : "";
const PARTNER_PORTAL_TOKEN = import.meta.env.DEV ? (import.meta.env.VITE_CAPITAL_PARTNER_PORTAL_TOKEN ?? "") : "";
const DEFAULT_PARTNER_CODE = import.meta.env.VITE_CAPITAL_PARTNER_CODE ?? "WOLFDEN-ALPHA";
const ADMIN_TOKEN_SESSION_KEY = "mindlaunch.capital.adminToken";
const PARTNER_TOKEN_SESSION_KEY = "mindlaunch.capital.partnerToken";

export const BASE_USDC_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: "Base",
  usdcAddress: USDC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
  settlementMode: "disabled_until_admin_compliance_approval",
} as const;

interface CapitalGatewayContextValue {
  state: CapitalGatewayState;
  metrics: {
    totalReferrals: number;
    totalVisits: number;
    walletConnects: number;
    submittedInterests: number;
    softCommitted: number;
  };
  isLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
  submitInterest: (input: Omit<CapitalInterest, "id" | "status" | "submittedAt">) => Promise<{ ok: true; interest: CapitalInterest } | { ok: false; errors: string[] }>;
  recordWalletConnection: (input: Omit<WalletConnection, "id" | "connectedAt">) => Promise<void>;
  updateLeadStatus: (interestId: string, toStatus: CapitalStatus) => Promise<void>;
  setDataroomAccess: (partnerId: string, projectSlug: string, level: DataroomAccess["level"]) => Promise<void>;
  addAdminNote: (interestId: string, body: string) => Promise<void>;
  requestDataroomAccess: (partnerCode: string, projectSlug: string) => Promise<void>;
  recordDataroomEvent: (partnerCode: string, projectSlug: string, event: "view" | "download" | "request_access", documentId?: string) => Promise<void>;
  openDataroomDocument: (partnerCode: string, document: DataroomDocument, event: "view" | "download") => Promise<void>;
  saveAccessToken: (scope: "partner" | "admin", token: string) => void;
  clearAccessToken: (scope: "partner" | "admin") => void;
  upsertComplianceReview: (interestId: string, status: ComplianceReviewStatus) => Promise<void>;
  approveWallet: (input: { walletAddress: WalletAddress; partnerId?: string; interestId?: string; chainId?: number }) => Promise<void>;
  createSettlementIntent: (input: { interestId: string; walletAddress: WalletAddress; chainId?: number; usdcAmount: number; expiresAt?: string }) => Promise<void>;
  updateSettlementIntentStatus: (intentId: string, status: SettlementIntentStatus, txHash?: string) => Promise<void>;
  updateDocumentMetadata: (documentId: string, input: Partial<Pick<DataroomDocument, "title" | "category" | "version" | "visibility" | "status" | "storageUri">>) => Promise<void>;
}

const CapitalGatewayContext = createContext<CapitalGatewayContextValue | null>(null);

function apiUrl(path: string) {
  return `${CAPITAL_API_BASE_URL}${path}`;
}

function getReferralCodeFromLocation() {
  if (typeof window === "undefined") return DEFAULT_PARTNER_CODE;
  const url = new URL(window.location.href);
  const inviteMatch = url.pathname.match(/^\/invite\/([^/]+)/);
  return inviteMatch?.[1] ?? url.searchParams.get("ref") ?? DEFAULT_PARTNER_CODE;
}

function getPartnerCodeFromLocation() {
  if (typeof window === "undefined") return DEFAULT_PARTNER_CODE;
  const url = new URL(window.location.href);
  return url.searchParams.get("partnerCode") ?? url.searchParams.get("ref") ?? DEFAULT_PARTNER_CODE;
}

function getStoredToken(scope: "partner" | "admin") {
  if (typeof window === "undefined") return "";
  const key = scope === "admin" ? ADMIN_TOKEN_SESSION_KEY : PARTNER_TOKEN_SESSION_KEY;
  return window.sessionStorage.getItem(key) ?? (scope === "admin" ? ADMIN_API_TOKEN : PARTNER_PORTAL_TOKEN);
}

function setStoredToken(scope: "partner" | "admin", token: string) {
  if (typeof window === "undefined") return;
  const key = scope === "admin" ? ADMIN_TOKEN_SESSION_KEY : PARTNER_TOKEN_SESSION_KEY;
  if (token.trim()) window.sessionStorage.setItem(key, token.trim());
  else window.sessionStorage.removeItem(key);
}

function authHeaders(scope: "public" | "partner" | "admin" = "public") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const adminToken = scope === "admin" ? getStoredToken("admin") : "";
  const partnerToken = scope === "partner" ? getStoredToken("partner") : "";
  if (adminToken) headers.authorization = `Bearer ${adminToken}`;
  if (partnerToken) headers["x-mindlaunch-partner-token"] = partnerToken;
  return headers;
}

async function apiFetch<T>(path: string, init: RequestInit = {}, scope: "public" | "partner" | "admin" = "public"): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { ...authHeaders(scope), ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `API request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function fetchCapitalState(): Promise<CapitalGatewayState> {
  if (typeof window === "undefined") return EMPTY_CAPITAL_STATE;
  const path = window.location.pathname;
  const capitalRoute = path.startsWith("/capital-gateway") || path.startsWith("/invite/") || path.startsWith("/launch/") || path.startsWith("/laika/") || path.startsWith("/partner/") || path.startsWith("/admin/");
  if (!capitalRoute) return EMPTY_CAPITAL_STATE;
  if (path.startsWith("/admin/")) {
    return normalizeCapitalState(await apiFetch<Partial<CapitalGatewayState>>("/api/admin/capital-state", {}, "admin"));
  }
  if (path.startsWith("/partner/")) {
    const partnerCode = encodeURIComponent(getPartnerCodeFromLocation());
    return normalizeCapitalState(await apiFetch<Partial<CapitalGatewayState>>(`/api/partner/capital-state?partnerCode=${partnerCode}`, {}, "partner"));
  }
  const referralCode = encodeURIComponent(getReferralCodeFromLocation());
  return normalizeCapitalState(await apiFetch<Partial<CapitalGatewayState>>(`/api/capital/state?ref=${referralCode}`));
}

function normalizeCapitalState(value: Partial<CapitalGatewayState>): CapitalGatewayState {
  return { ...EMPTY_CAPITAL_STATE, ...value, users: value.users ?? [], partners: value.partners ?? [], referralLinks: value.referralLinks ?? [], projects: value.projects ?? [], capitalInterests: value.capitalInterests ?? [], walletConnections: value.walletConnections ?? [], dataroomDocuments: value.dataroomDocuments ?? [], dataroomAccess: value.dataroomAccess ?? [], dataroomEvents: value.dataroomEvents ?? [], statusEvents: value.statusEvents ?? [], adminNotes: value.adminNotes ?? [], activityLogs: value.activityLogs ?? [], complianceReviews: value.complianceReviews ?? [], approvedWallets: value.approvedWallets ?? [], settlementIntents: value.settlementIntents ?? [] };
}

export function CapitalGatewayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CapitalGatewayState>(EMPTY_CAPITAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const visitRecorded = useRef("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setState(await fetchCapitalState());
    } catch (caught) {
      setState(EMPTY_CAPITAL_STATE);
      setError(caught instanceof Error ? caught.message : "Unable to load Capital Gateway data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const referralCode = getReferralCodeFromLocation();
    const key = `${window.location.pathname}:${referralCode}`;
    if (!window.location.pathname.startsWith("/invite/") || visitRecorded.current === key) return;
    visitRecorded.current = key;
    void apiFetch(`/api/referral-links/${encodeURIComponent(referralCode)}/visit`, { method: "POST" }).then(refresh).catch(() => undefined);
  }, [refresh]);

  const submitInterest = useCallback<CapitalGatewayContextValue["submitInterest"]>(async (input) => {
    try {
      const interest = await apiFetch<CapitalInterest>("/api/capital-interests", { method: "POST", body: JSON.stringify(input) });
      await refresh();
      return { ok: true, interest };
    } catch (caught) {
      return { ok: false, errors: [caught instanceof Error ? caught.message : "Interest submission failed."] };
    }
  }, [refresh]);

  const recordWalletConnection = useCallback<CapitalGatewayContextValue["recordWalletConnection"]>(async (input) => {
    await apiFetch<WalletConnection>("/api/wallet-connections", { method: "POST", body: JSON.stringify(input) });
    await refresh();
  }, [refresh]);

  const updateLeadStatus = useCallback<CapitalGatewayContextValue["updateLeadStatus"]>(async (interestId, toStatus) => {
    await apiFetch<CapitalInterest>(`/api/admin/capital-interests/${interestId}/status`, { method: "PATCH", body: JSON.stringify({ status: toStatus }) }, "admin");
    await refresh();
  }, [refresh]);

  const setDataroomAccess = useCallback<CapitalGatewayContextValue["setDataroomAccess"]>(async (partnerId, projectSlug, level) => {
    await apiFetch<DataroomAccess>("/api/admin/dataroom/access", { method: "POST", body: JSON.stringify({ partnerId, projectSlug, level }) }, "admin");
    await refresh();
  }, [refresh]);

  const addAdminNote = useCallback<CapitalGatewayContextValue["addAdminNote"]>(async (interestId, body) => {
    if (!body.trim()) return;
    await apiFetch("/api/admin/admin-notes", { method: "POST", body: JSON.stringify({ interestId, body }) }, "admin");
    await refresh();
  }, [refresh]);

  const requestDataroomAccess = useCallback<CapitalGatewayContextValue["requestDataroomAccess"]>(async (partnerCode, projectSlug) => {
    await apiFetch<DataroomAccess>("/api/dataroom/access-requests", { method: "POST", body: JSON.stringify({ partnerCode, projectSlug }) }, "partner");
    await refresh();
  }, [refresh]);

  const recordDataroomEvent = useCallback<CapitalGatewayContextValue["recordDataroomEvent"]>(async (partnerCode, projectSlug, event, documentId) => {
    await apiFetch(`/api/dataroom/events?partnerCode=${encodeURIComponent(partnerCode)}`, { method: "POST", body: JSON.stringify({ projectSlug, event, documentId }) }, "partner");
    await refresh();
  }, [refresh]);

  const openDataroomDocument = useCallback<CapitalGatewayContextValue["openDataroomDocument"]>(async (partnerCode, document, event) => {
    const response = await apiFetch<{ url: string }>(`/api/dataroom/documents/${document.id}/access?partnerCode=${encodeURIComponent(partnerCode)}&event=${event}`, {}, "partner");
    window.open(response.url, event === "download" ? "_self" : "_blank", "noopener,noreferrer");
    await refresh();
  }, [refresh]);

  const saveAccessToken = useCallback<CapitalGatewayContextValue["saveAccessToken"]>((scope, token) => {
    setStoredToken(scope, token);
    void refresh();
  }, [refresh]);

  const clearAccessToken = useCallback<CapitalGatewayContextValue["clearAccessToken"]>((scope) => {
    setStoredToken(scope, "");
    void refresh();
  }, [refresh]);

  const upsertComplianceReview = useCallback<CapitalGatewayContextValue["upsertComplianceReview"]>(async (interestId, status) => {
    await apiFetch<ComplianceReview>("/api/admin/compliance-reviews", { method: "POST", body: JSON.stringify({ interestId, status }) }, "admin");
    await refresh();
  }, [refresh]);

  const approveWallet = useCallback<CapitalGatewayContextValue["approveWallet"]>(async (input) => {
    await apiFetch<ApprovedWallet>("/api/admin/approved-wallets", { method: "POST", body: JSON.stringify({ chainId: BASE_CHAIN_ID, ...input }) }, "admin");
    await refresh();
  }, [refresh]);

  const createSettlementIntent = useCallback<CapitalGatewayContextValue["createSettlementIntent"]>(async (input) => {
    await apiFetch<SettlementIntent>("/api/admin/settlement-intents", { method: "POST", body: JSON.stringify({ chainId: BASE_CHAIN_ID, ...input }) }, "admin");
    await refresh();
  }, [refresh]);

  const updateSettlementIntentStatus = useCallback<CapitalGatewayContextValue["updateSettlementIntentStatus"]>(async (intentId, status, txHash) => {
    await apiFetch<SettlementIntent>(`/api/admin/settlement-intents/${intentId}/status`, { method: "PATCH", body: JSON.stringify({ status, txHash }) }, "admin");
    await refresh();
  }, [refresh]);

  const updateDocumentMetadata = useCallback<CapitalGatewayContextValue["updateDocumentMetadata"]>(async (documentId, input) => {
    await apiFetch<DataroomDocument>(`/api/admin/dataroom/documents/${documentId}`, { method: "PATCH", body: JSON.stringify(input) }, "admin");
    await refresh();
  }, [refresh]);

  const metrics = useMemo(() => {
    const softCommitted = state.capitalInterests.filter((item) => ["Soft Committed", "Approved", "Funded"].includes(item.status)).reduce((sum, item) => sum + item.intendedAmountUSDC, 0);
    return {
      totalReferrals: state.referralLinks.reduce((sum, link) => sum + link.submittedInterests, 0),
      totalVisits: state.referralLinks.reduce((sum, link) => sum + link.visits, 0),
      walletConnects: state.walletConnections.length + state.referralLinks.reduce((sum, link) => sum + link.walletConnects, 0),
      submittedInterests: state.capitalInterests.length,
      softCommitted,
    };
  }, [state]);

  const value = useMemo<CapitalGatewayContextValue>(() => ({
    state,
    metrics,
    isLoading,
    error,
    refresh,
    submitInterest,
    recordWalletConnection,
    updateLeadStatus,
    setDataroomAccess,
    addAdminNote,
    requestDataroomAccess,
    recordDataroomEvent,
    openDataroomDocument,
    saveAccessToken,
    clearAccessToken,
    upsertComplianceReview,
    approveWallet,
    createSettlementIntent,
    updateSettlementIntentStatus,
    updateDocumentMetadata,
  }), [addAdminNote, approveWallet, clearAccessToken, createSettlementIntent, error, isLoading, metrics, openDataroomDocument, recordDataroomEvent, recordWalletConnection, refresh, requestDataroomAccess, saveAccessToken, setDataroomAccess, state, submitInterest, updateDocumentMetadata, updateLeadStatus, updateSettlementIntentStatus, upsertComplianceReview]);

  return createElement(CapitalGatewayContext.Provider, { value }, children);
}

export function useCapitalGateway() {
  const context = useContext(CapitalGatewayContext);
  if (!context) throw new Error("useCapitalGateway must be used inside CapitalGatewayProvider.");
  return context;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

export function maskWallet(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";
}

export function getPartnerByCode(state: CapitalGatewayState, code = DEFAULT_PARTNER_CODE) {
  const link = state.referralLinks.find((item) => item.code.toLowerCase() === code.toLowerCase());
  return link ? state.partners.find((partner) => partner.id === link.partnerId || partner.code.toLowerCase() === link.code.toLowerCase()) : state.partners.find((partner) => partner.code.toLowerCase() === code.toLowerCase());
}

export function getPartnerLink(state: CapitalGatewayState, partnerId: string) {
  return state.referralLinks.find((item) => item.partnerId === partnerId);
}

export function getProject(state: CapitalGatewayState, slug: string) {
  return state.projects.find((project) => project.slug === slug);
}

export function partnerProjectAccess(state: CapitalGatewayState, partnerId: string, projectSlug: string) {
  return state.dataroomAccess.find((access) => access.partnerId === partnerId && access.projectSlug === projectSlug)?.level ?? "locked";
}

export function visiblePartnerDocuments(state: CapitalGatewayState, partner: Partner, projectSlug?: string) {
  return state.dataroomDocuments.filter((doc) => {
    if (projectSlug && doc.projectSlug !== projectSlug) return false;
    const level = partnerProjectAccess(state, partner.id, doc.projectSlug);
    return level === "granted" && doc.visibility !== "admin";
  });
}

export function prepareApprovedWalletAllowlist(wallets: WalletAddress[]) {
  return { chainId: BASE_CHAIN_ID, wallets, status: "draft_allowlist_requires_admin_approval" };
}

export async function requestFutureUSDCDeposit() {
  throw new Error("USDC deposits are disabled until server-side compliance approval, accredited verification, and approved-wallet allowlisting are complete.");
}
