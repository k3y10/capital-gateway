import { useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminCapitalInterestPage, AdminDataroomPage, AdminPartnersPage, AdminProjectsPage, AdminReferralsPage, CapitalGatewayPage, InvitePage, LaikaCapitalPage, LaunchProjectPage, PartnerDashboardPage, PartnerDataroomPage } from "./capitalPages";
import { CapitalGatewayProvider, useCapitalGateway } from "./capitalServices";
import { Layout, Status } from "./components";
import { useWalletState } from "./hooks";
import { LandingPage } from "./LandingPage";

export default function App() {
  const wallet = useWalletState();

  if (typeof window !== "undefined" && window.location.pathname === "/") {
    const pendingRedirect = window.sessionStorage.getItem("mindlaunch.redirect");
    if (pendingRedirect && pendingRedirect !== "/") {
      window.sessionStorage.removeItem("mindlaunch.redirect");
      return <Navigate to={pendingRedirect} replace />;
    }
  }

  return <CapitalGatewayProvider><Routes><Route element={<Layout wallet={wallet} />}>
    <Route index element={<LandingPage wallet={wallet} />} />
    <Route path="capital-gateway" element={<GatewayRoute><CapitalGatewayPage wallet={wallet} /></GatewayRoute>} />
    <Route path="invite/:partnerCode" element={<GatewayRoute><InvitePage wallet={wallet} /></GatewayRoute>} />
    <Route path="launch/:projectSlug" element={<GatewayRoute><LaunchProjectPage wallet={wallet} /></GatewayRoute>} />
    <Route path="laika/capital" element={<GatewayRoute><LaikaCapitalPage wallet={wallet} /></GatewayRoute>} />
    <Route path="partner" element={<Navigate to="/partner/dashboard" replace />} />
    <Route path="partner/dashboard" element={<GatewayRoute scope="partner"><PartnerDashboardPage /></GatewayRoute>} />
    <Route path="dataroom" element={<Navigate to="/partner/dataroom" replace />} />
    <Route path="partner/dataroom" element={<GatewayRoute scope="partner"><PartnerDataroomPage /></GatewayRoute>} />
    <Route path="partner/dataroom/:projectSlug" element={<GatewayRoute scope="partner"><PartnerDataroomPage /></GatewayRoute>} />
    <Route path="admin" element={<Navigate to="/admin/referrals" replace />} />
    <Route path="admin/referrals" element={<GatewayRoute scope="admin"><AdminReferralsPage /></GatewayRoute>} />
    <Route path="admin/capital-interest" element={<GatewayRoute scope="admin"><AdminCapitalInterestPage /></GatewayRoute>} />
    <Route path="admin/dataroom" element={<GatewayRoute scope="admin"><AdminDataroomPage /></GatewayRoute>} />
    <Route path="admin/projects" element={<GatewayRoute scope="admin"><AdminProjectsPage /></GatewayRoute>} />
    <Route path="admin/partners" element={<GatewayRoute scope="admin"><AdminPartnersPage /></GatewayRoute>} />
    <Route path="*" element={<Navigate to="/capital-gateway" replace />} />
  </Route></Routes></CapitalGatewayProvider>;
}

function GatewayRoute({ children, scope = "public" }: { children: ReactNode; scope?: "public" | "partner" | "admin" }) {
  const { isLoading, error, state, saveAccessToken, clearAccessToken } = useCapitalGateway();
  const location = useLocation();
  const [token, setToken] = useState("");
  const recordsReady = state.projects.length > 0 && state.partners.length > 0;
  const secureRoute = scope === "partner" || scope === "admin";
  const authProblem = secureRoute && /token|access denied|unauthorized|forbidden|CAPITAL_.*TOKEN|partner portal|admin api/i.test(error);

  if (isLoading) return <GatewayStatePanel tone="cyan" label="connecting" title="Gateway is connecting" copy="MindLaunch Gateway is loading the backend API, project records, partner permissions, and dataroom access state." path={location.pathname} />;

  if (error) return <GatewayStatePanel tone="warn" label={secureRoute ? "authentication" : "api required"} title={secureRoute ? "Gateway access needs verification" : "Gateway backend is not available"} copy={error} path={location.pathname}>
    {authProblem ? <div className="access-token-panel">
      <strong>{scope === "admin" ? "Admin API token required" : "Partner access token required"}</strong>
      <p>Enter the server-issued token for this browser session. Production access is enforced by the API and database boundary.</p>
      <div><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={scope === "admin" ? "Admin token" : "Partner token"} /><button className="button primary" onClick={() => saveAccessToken(scope, token)}>Unlock</button><button className="button ghost" onClick={() => { setToken(""); clearAccessToken(scope); }}>Clear</button></div>
    </div> : <p>Once the backend host and Postgres database are connected, this route will load live Gateway data instead of a static placeholder.</p>}
  </GatewayStatePanel>;

  if (!recordsReady) return <GatewayStatePanel tone="warn" label="backend pending" title="Gateway records are pending" copy="The app shell is live, but the API has not returned seeded MindLaunch projects and partner records yet. Run migrations and seed data on the backend provider, then refresh." path={location.pathname} />;

  return children;
}

function GatewayStatePanel({ tone, label, title, copy, path, children }: { tone: "cyan" | "warn"; label: string; title: string; copy: string; path: string; children?: ReactNode }) {
  return <div className="capital-page"><section className="panel capital-state-panel gateway-state-panel">
    <Status tone={tone}>{label}</Status>
    <h2>{title}</h2>
    <p>{copy}</p>
    <code>{path}</code>
    {children}
  </section></div>;
}
