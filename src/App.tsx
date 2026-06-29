import { Navigate, Route, Routes } from "react-router-dom";
import { AdminCapitalInterestPage, AdminDataroomPage, AdminPartnersPage, AdminProjectsPage, AdminReferralsPage, CapitalGatewayPage, InvitePage, LaikaCapitalPage, LaunchProjectPage, PartnerDashboardPage, PartnerDataroomPage } from "./capitalPages";
import { CapitalGatewayProvider } from "./capitalServices";
import { Layout } from "./components";
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
    <Route path="capital-gateway" element={<CapitalGatewayPage wallet={wallet} />} />
    <Route path="invite/:partnerCode" element={<InvitePage wallet={wallet} />} />
    <Route path="launch/:projectSlug" element={<LaunchProjectPage wallet={wallet} />} />
    <Route path="laika/capital" element={<LaikaCapitalPage wallet={wallet} />} />
    <Route path="partner" element={<Navigate to="/partner/dashboard" replace />} />
    <Route path="partner/dashboard" element={<PartnerDashboardPage />} />
    <Route path="dataroom" element={<Navigate to="/partner/dataroom" replace />} />
    <Route path="partner/dataroom" element={<PartnerDataroomPage />} />
    <Route path="partner/dataroom/:projectSlug" element={<PartnerDataroomPage />} />
    <Route path="admin" element={<Navigate to="/admin/referrals" replace />} />
    <Route path="admin/referrals" element={<AdminReferralsPage />} />
    <Route path="admin/capital-interest" element={<AdminCapitalInterestPage />} />
    <Route path="admin/dataroom" element={<AdminDataroomPage />} />
    <Route path="admin/projects" element={<AdminProjectsPage />} />
    <Route path="admin/partners" element={<AdminPartnersPage />} />
    <Route path="*" element={<Navigate to="/capital-gateway" replace />} />
  </Route></Routes></CapitalGatewayProvider>;
}
