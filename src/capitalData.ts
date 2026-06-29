import type { CapitalStatus, DataroomCategory } from "./capitalTypes";

export const CAPITAL_STATUSES: CapitalStatus[] = [
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

export const DATAROOM_CATEGORIES: DataroomCategory[] = [
  "Overview",
  "Pitch Deck",
  "Financial Model",
  "Legal / Formation",
  "USDC Model",
  "Technical Architecture",
  "Roadmap",
  "Diligence Notes",
  "Partner Updates",
  "Investment Memo",
  "Risk Notes",
];
