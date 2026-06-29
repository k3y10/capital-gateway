import { Activity, Menu, Wallet, X, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BASE_CHAIN_ID } from "./config";
import type { WalletAddress, WalletProviderName } from "./types";
import { shortenWalletAddress } from "./utils";

const PRIMARY_NAV = [["/capital-gateway", "Gateway"], ["/laika/capital", "Laika"], ["/partner/dashboard", "Partner"], ["/partner/dataroom", "Dataroom"], ["/admin/referrals", "Admin"]] as const;
const SECONDARY_NAV = [["/admin/capital-interest", "Pipeline"], ["/admin/dataroom", "Access"], ["/admin/projects", "Projects"], ["/admin/partners", "Partners"]] as const;

export function Brand() {
  return <Link to="/capital-gateway" className="brand" aria-label="MindLaunch Capital Gateway home">
    <span className="mindlaunch-mark"><i /><i /><i /></span>
    <span><strong>MindLaunch</strong><small>CAPITAL GATEWAY</small></span>
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
      <nav className={open ? "main-nav open" : "main-nav"} aria-label="Primary app navigation">
        <div className="drawer-label">MindLaunch Capital</div>
        {PRIMARY_NAV.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)}
        <div className="drawer-section"><span>Admin</span>{SECONDARY_NAV.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)}</div>
      </nav>
      <div className="topbar-actions">
        <span className="network-dot">{wallet.isWrongNetwork ? "Wrong network" : `Base / ${BASE_CHAIN_ID}`}</span>
        <WalletButton wallet={wallet} compact />
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
      </div>
    </header>
    <main><Outlet /></main>
    <footer>
      <div><Brand /><p>Post-AI venture capital routing, partner referrals, and compliance-gated dataroom access for the MindLaunch ecosystem.</p></div>
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

export function Terminal({ title = "Capital terminal", logs }: { title?: string; logs: string[] }) {
  return <div className="terminal"><div className="terminal-head"><span><i /><i /><i /></span><strong>{title}</strong><span className="live"><Activity size={12} /> live</span></div><div className="terminal-body">{logs.map((log, index) => <div key={`${log}-${index}`}><time>{`17:${String(42 - index).padStart(2, "0")}`}</time><span>{">"}</span><span>{log}</span></div>)}</div></div>;
}
