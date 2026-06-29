import type { WalletAddress } from "./types";

export type CapitalRoleType = "LP" | "GP" | "advisor" | "builder" | "founder" | "strategic_partner";
export type CapitalStatus =
  | "New"
  | "Wallet Connected"
  | "Interest Submitted"
  | "Pending Review"
  | "Needs Documents"
  | "Dataroom Requested"
  | "Dataroom Granted"
  | "Accredited Verified"
  | "Approved"
  | "Rejected"
  | "Soft Committed"
  | "Funded"
  | "Closed";

export type DataroomCategory =
  | "Overview"
  | "Pitch Deck"
  | "Financial Model"
  | "Legal / Formation"
  | "USDC Model"
  | "Technical Architecture"
  | "Roadmap"
  | "Diligence Notes"
  | "Partner Updates"
  | "Investment Memo"
  | "Risk Notes";

export type DataroomAccessLevel = "locked" | "requested" | "granted" | "revoked";
export type UserRole = "admin" | "partner" | "founder" | "viewer";
export type ComplianceReviewStatus = "not_started" | "pending" | "needs_documents" | "verified" | "rejected" | "expired";
export type SettlementIntentStatus = "draft" | "approved" | "pending_signature" | "submitted" | "confirmed" | "cancelled" | "expired";

export interface CapitalAcknowledgements {
  indicationOnly: true;
  noOfferOrAllocation: true;
  eligibilityReview: true;
  usdcSettlementRail: true;
  referralNoAutomaticCompensation: true;
  riskAndIlliquidity: true;
  accurateInformation: true;
}

export interface CapitalUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  walletAddress?: WalletAddress;
}

export interface Partner {
  id: string;
  name: string;
  organization: string;
  email: string;
  code: string;
  role: CapitalRoleType;
  accessLevel: "standard" | "strategic" | "admin-review";
  joinedAt: string;
}

export interface ReferralLink {
  id: string;
  partnerId: string;
  code: string;
  url: string;
  visits: number;
  walletConnects: number;
  submittedInterests: number;
  createdAt: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  category: string;
  stage: string;
  fundingStatus: string;
  preferredPartnerType: string;
  dataroomAvailability: "available" | "restricted" | "coming_soon";
  pool: string;
  priority: "active" | "watchlist" | "future";
}

export interface CapitalInterest {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  walletAddress: WalletAddress | "";
  connectedWalletProvider: "Coinbase Wallet" | "MetaMask" | "Injected Wallet" | "Not connected";
  referralCode: string;
  projectSlug: string;
  poolOfInterest: string;
  intendedAmountUSDC: number;
  roleType: CapitalRoleType;
  accreditedSelfAttestation: boolean;
  jurisdiction: string;
  notes: string;
  status: CapitalStatus;
  submittedAt: string;
  confirmationAccepted: boolean;
  acknowledgements: CapitalAcknowledgements;
}

export interface WalletConnection {
  id: string;
  referralCode: string;
  walletAddress: WalletAddress;
  provider: "Coinbase Wallet" | "MetaMask" | "Injected Wallet";
  projectSlug?: string;
  connectedAt: string;
}

export interface DataroomDocument {
  id: string;
  projectSlug: string;
  title: string;
  category: DataroomCategory;
  uploadDate: string;
  version: string;
  visibility: "partner" | "admin" | "founder" | "viewer";
  status: "ready" | "coming_soon";
  views: number;
  downloads: number;
  storageUri?: string;
}

export interface DataroomAccess {
  id: string;
  partnerId: string;
  projectSlug: string;
  level: DataroomAccessLevel;
  grantedBy?: string;
  grantedAt?: string;
  requestedAt?: string;
}

export interface DataroomEvent {
  id: string;
  documentId: string;
  projectSlug: string;
  partnerId: string;
  event: "view" | "download" | "request_access";
  timestamp: string;
}

export interface StatusEvent {
  id: string;
  interestId: string;
  fromStatus: CapitalStatus;
  toStatus: CapitalStatus;
  actor: "admin" | "partner" | "system";
  timestamp: string;
}

export interface AdminNote {
  id: string;
  interestId: string;
  author: string;
  body: string;
  createdAt: string;
  private: true;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  projectSlug?: string;
  referralCode?: string;
  createdAt: string;
}

export interface ComplianceReview {
  id: string;
  interestId: string;
  status: ComplianceReviewStatus;
  provider: string;
  externalReference: string;
  reviewedBy: string;
  reviewedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedWallet {
  id: string;
  walletAddress: WalletAddress;
  partnerId?: string;
  interestId?: string;
  chainId: number;
  approvedBy: string;
  approvedAt: string;
  revokedAt?: string;
  createdAt: string;
}

export interface SettlementIntent {
  id: string;
  interestId: string;
  walletAddress: WalletAddress;
  chainId: number;
  usdcAmount: number;
  status: SettlementIntentStatus;
  txHash: string;
  createdBy: string;
  approvedBy: string;
  approvedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CapitalGatewayState {
  users: CapitalUser[];
  partners: Partner[];
  referralLinks: ReferralLink[];
  projects: Project[];
  capitalInterests: CapitalInterest[];
  walletConnections: WalletConnection[];
  dataroomDocuments: DataroomDocument[];
  dataroomAccess: DataroomAccess[];
  dataroomEvents: DataroomEvent[];
  statusEvents: StatusEvent[];
  adminNotes: AdminNote[];
  activityLogs: ActivityLog[];
  complianceReviews: ComplianceReview[];
  approvedWallets: ApprovedWallet[];
  settlementIntents: SettlementIntent[];
}
