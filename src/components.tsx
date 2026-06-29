import { Activity, Bot, BriefcaseBusiness, Database, FolderLock, LayoutDashboard, Menu, ShieldCheck, Users, Wallet, X, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BASE_CHAIN_ID } from "./config";
import type { WalletAddress, WalletProviderName } from "./types";
import { shortenWalletAddress } from "./utils";

const PRIMARY_NAV = [
  { to: "/capital-gateway", label: "Gateway", Icon: BriefcaseBusiness },
  { to: "/laika/capital", label: "Laika", Icon: Bot },
  { to: "/partner/dashboard", label: "Partner", Icon: LayoutDashboard },
  { to: "/partner/dataroom", label: "Dataroom", Icon: FolderLock },
  { to: "/admin/referrals", label: "Admin", Icon: ShieldCheck },
] as const;

const SECONDARY_NAV = [
  { to: "/admin/capital-interest", label: "Pipeline", Icon: Activity },
  { to: "/admin/dataroom", label: "Access", Icon: FolderLock },
  { to: "/admin/projects", label: "Projects", Icon: Database },
  { to: "/admin/partners", label: "Partners", Icon: Users },
] as const;

export function Brand() {
  return <Link to="/capital-gateway" className="brand" aria-label="Gateway for the MindLaunch ecosystem">
    <span className="mindlaunch-mark" aria-hidden="true">
      <img src="https://mindlaunch.xyz/mindlaunch-logo.png" alt="" onLoad={(event) => event.currentTarget.parentElement?.classList.add("has-image")} onError={(event) => { event.currentTarget.src = "/mindlaunch-logo.svg"; event.currentTarget.onerror = null; }} />
      <span>G</span>
    </span>
    <span><strong>Gateway</strong><small>MindLaunch Ecosystem</small></span>
  </Link>;
}

export interface WalletView {
  address: WalletAddress | "";
  status: string;
  providerName?: WalletProviderName;
  isConnected: boolean;
  isWrongNetwork: boolean;
  connect: (providerName?: WalletProviderName) => Promise<void>;
  switchToBase: () => Promise<void>;
}

export function WalletButton({ wallet, compact = false }: { wallet: WalletView; compact?: boolean }) {
  if (wallet.isWrongNetwork) return <button className="button warning" onClick={() => void wallet.switchToBase()}><Zap size={16} />Switch to Base</button>;
  return <button className={compact ? "wallet-compact" : "button outline"} onClick={() => void wallet.connect()}><Wallet size={16} />{wallet.isConnected ? shortenWalletAddress(wallet.address) : wallet.status === "connecting" ? "Connecting..." : "Connect Wallet"}</button>;
}

export function Layout({ wallet }: { wallet: WalletView }) {
  const [open, setOpen] = useState(false);
  return <div className="site-shell">
    {open ? <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
    <header className="topbar">
      <Brand />
      <nav className={open ? "main-nav open" : "main-nav"} aria-label="Gateway navigation">
        <div className="drawer-label">MindLaunch</div>
        {PRIMARY_NAV.map(({ to, label, Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={15} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
        <div className="drawer-section"><span>Admin</span>{SECONDARY_NAV.map(({ to, label, Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={15} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</div>
      </nav>
      <div className="topbar-actions">
        <span className="network-dot">{wallet.isWrongNetwork ? "Wrong network" : `Base / ${BASE_CHAIN_ID}`}</span>
        <WalletButton wallet={wallet} compact />
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
      </div>
    </header>
    <main><Outlet /></main>
    <footer>
      <div><Brand /><p>Gateway routes partner referrals, capital interest, and compliance-gated dataroom access across the MindLaunch ecosystem.</p></div>
      <div className="footer-links"><Link to="/capital-gateway">Gateway</Link><Link to="/partner/dataroom">Dataroom</Link><Link to="/admin/referrals">Admin</Link></div>
      <p className="disclaimer">This platform is not an offer to sell securities. USDC is prepared only as a future settlement rail after compliance approval.</p>
    </footer>
  </div>;
}

export function Status({ children, tone = "ok" }: { children: ReactNode; tone?: "ok" | "warn" | "muted" | "cyan" }) {
  return <span className={`status ${tone}`}><i />{children}</span>;
}

export function SectionHead({ label, title, copy, action }: { label?: string; title: string; copy?: string; action?: ReactNode }) {
  return <div className="section-head"><div>{label ? <span className="mono-label">{label}</span> : null}<h2>{title}</h2>{copy ? <p>{copy}</p> : null}</div>{action}</div>;
}

export function PageTitle({ index, title, copy, children }: { index: string; title: string; copy: string; children?: ReactNode }) {
  return <div className="page-title"><span className="page-index">{index}</span><div><h1>{title}</h1><p>{copy}</p></div>{children ? <div className="page-title-actions">{children}</div> : null}</div>;
}

export function Metric({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) {
  return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

export function Terminal({ title = "Gateway terminal", logs }: { title?: string; logs: string[] }) {
  return <div className="terminal"><div className="terminal-head"><span><i /><i /><i /></span><strong>{title}</strong><span className="live"><Activity size={12} /> live</span></div><div className="terminal-body">{logs.map((log, index) => <div key={`${log}-${index}`}><time>{`17:${String(42 - index).padStart(2, "0")}`}</time><span>{">"}</span><span>{log}</span></div>)}</div></div>;
}
