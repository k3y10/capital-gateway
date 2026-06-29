import { ArrowRight, Bot, CircleDollarSign, Database, FolderLock, Landmark, Network, ShieldCheck, Users, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { Metric, SectionHead, Status, WalletButton, type WalletView } from "./components";
import "./landing.css";

const audiences = [
  ["LPs and GPs", "Review ecosystem ventures, indicate non-binding capital interest, and enter a compliance-led review process."],
  ["Founders and builders", "Route venture fit, operating capability, and project involvement into the MindLaunch pipeline."],
  ["Advisors and strategic partners", "Request project context, identify diligence needs, and coordinate next steps with the studio."],
];

const workflow = [
  ["Partner link", "A MindLaunch partner shares a unique Capital Gateway link."],
  ["Guided intake", "Laika explains project fit, role type, dataroom status, and why review is required."],
  ["Compliance review", "Interest, wallet context, jurisdiction, and partner source are reviewed before any funding step."],
  ["Dataroom access", "Approved users receive project-specific document access based on permissions."],
];

export function LandingPage({ wallet }: { wallet: WalletView }) {
  return <div className="capital-page">
    <section className="capital-hero">
      <div className="capital-hero-copy">
        <span className="capital-brandline">MindLaunch Capital Gateway</span>
        <h1>A private venture routing layer for capital, partners, and dataroom access.</h1>
        <p>MindLaunch Capital Gateway helps LPs, GPs, advisors, founders, builders, and strategic partners understand where they fit before sensitive documents, wallet allowlists, or settlement steps are considered.</p>
        <div className="hero-actions">
          <Link className="button primary" to="/capital-gateway">Explore Gateway <ArrowRight size={16} /></Link>
          <Link className="button ghost" to="/laika/capital">Connect with Laika</Link>
          <WalletButton wallet={wallet} />
        </div>
        <div className="capital-trust-strip">
          <div><span>Positioning</span><strong>Private venture OS</strong></div>
          <div><span>Funds</span><strong>No checkout or deposit</strong></div>
          <div><span>Access</span><strong>Compliance-gated</strong></div>
        </div>
      </div>
      <aside className="laika-panel">
        <div className="laika-orb"><Bot /></div>
        <span className="mono-label">LAIKA CAPITAL GUIDE</span>
        <h2>Laika helps route capital, founders, and partners across the MindLaunch ecosystem.</h2>
        <div className="laika-steps">
          {workflow.map(([title, copy], index) => <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><p><strong>{title}</strong><br />{copy}</p></div>)}
        </div>
        <div className="compliance-mini"><ShieldCheck size={16} />This is an interest and routing workflow, not an investment checkout.</div>
      </aside>
    </section>

    <section className="capital-metrics">
      <Metric label="Primary users" value="LP / GP / Advisor" detail="plus builders and founders" icon={<Users />} />
      <Metric label="Wallet context" value="Coinbase / MetaMask" detail="for attribution and future allowlists" icon={<WalletCards />} />
      <Metric label="Dataroom model" value="Permissioned" detail="partner and project scoped" icon={<FolderLock />} />
      <Metric label="USDC role" value="Settlement rail" detail="disabled until approval" icon={<CircleDollarSign />} />
    </section>

    <section className="capital-education">
      <div className="capital-education-hero">
        <div>
          <h2>What this is</h2>
          <p>Capital Gateway is the operating layer for partner referral links, project discovery, capital interest intake, compliance review, approved-wallet preparation, and project-specific dataroom access.</p>
        </div>
        <div className="education-status">
          <Status tone="cyan">backend aware</Status>
          <p>The public landing page can explain the platform before the backend is connected. Live projects, partner dashboards, admin review, and dataroom records load from the API once the provider is online.</p>
        </div>
      </div>

      <div className="education-grid">
        <article><Network /><h3>Partner attribution</h3><p>Unique links preserve referral source, wallet context, role type, project interest, and pipeline movement without implying automatic transaction compensation.</p></article>
        <article><ShieldCheck /><h3>Review before access</h3><p>Compliance review, admin approval, and project permissions stay ahead of dataroom release or any future funding step.</p></article>
        <article><Database /><h3>Backend records</h3><p>Projects, leads, notes, document events, access grants, and status movement are API/database backed for production deployment.</p></article>
      </div>

      <div className="education-split">
        <div className="panel-lite">
          <SectionHead label="AUDIENCE" title="Who this is for" copy="The Gateway is built for a private capital operating motion, not a public raise." />
          {audiences.map(([title, copy]) => <div key={title} className="education-row"><Users size={16} /><div><strong>{title}</strong><p>{copy}</p></div></div>)}
        </div>
        <div className="panel-lite">
          <SectionHead label="PROCESS" title="How routing works" copy="Each step is designed to preserve attribution, control access, and keep review ahead of funding." />
          {workflow.map(([title, copy], index) => <div key={title} className="education-row"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}
        </div>
      </div>

      <div className="capital-education-footer">
        <div><Landmark /><strong>USDC is a future settlement rail only.</strong><p>No deposits, transfers, investment checkout, or automatic referral compensation are enabled by this page.</p></div>
        <div><FolderLock /><strong>Datarooms are permissioned.</strong><p>Project documents become available only after partner/project access is granted by the platform.</p></div>
        <div><Bot /><strong>Laika keeps users oriented.</strong><p>Laika explains the ecosystem, clarifies documents, and routes the correct next step.</p></div>
      </div>
    </section>
  </div>;
}
