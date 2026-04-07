import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { FreelancersPage } from './pages/FreelancersPage';
import { FreelancerProfilePage } from './pages/FreelancerProfilePage';
import { CreateOrderPage } from './pages/CreateOrderPage';
import { OrderPage } from './pages/OrderPage';
import { DisputePage } from './pages/DisputePage';
import { FreelancerDashboardProfilePage } from './pages/FreelancerDashboardProfilePage';
import { ClientDashboardProfilePage } from './pages/ClientDashboardProfilePage';
import { DashboardMessagesPage } from './pages/DashboardMessagesPage';
import { DashboardSettingsPage } from './pages/DashboardSettingsPage';
import { FreelancerOrdersPage } from './pages/FreelancerOrdersPage';
import { FreelancerMarketPage } from './pages/FreelancerMarketPage';
import { ClientOrdersPage } from './pages/ClientOrdersPage';
import { FreelancerFinancePage } from './pages/FreelancerFinancePage';
import { ClientFinancePage } from './pages/ClientFinancePage';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import { FreelancerDashboardPage } from './pages/FreelancerDashboardPage';
import { DashboardNotificationsPage } from './pages/DashboardNotificationsPage';
import { DashboardDocumentsPage } from './pages/DashboardDocumentsPage';
import { FreelancerResumePage } from './pages/FreelancerResumePage';
import { WorkspacePaymentMethodsPage } from './pages/WorkspacePaymentMethodsPage';
import { SupportCasesPage } from './pages/SupportCasesPage';
import { WorkspaceTeamPage } from './pages/WorkspaceTeamPage';
import { WorkspaceSecurityPage } from './pages/WorkspaceSecurityPage';
import { WorkspaceVerificationPage } from './pages/WorkspaceVerificationPage';
import { WorkspaceAnalyticsPage } from './pages/WorkspaceAnalyticsPage';
import { WorkspaceActivityPage } from './pages/WorkspaceActivityPage';
import { WorkspaceSubscriptionPage } from './pages/WorkspaceSubscriptionPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { AboutPage } from './pages/AboutPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { BlogPage } from './pages/BlogPage';
import { HelpPage } from './pages/HelpPage';
import { FaqPage } from './pages/FaqPage';
import { ContactPage } from './pages/ContactPage';
import { TermsPage } from './pages/TermsPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { RequireGuest } from './components/auth/RequireGuest';
import { AppErrorBoundary } from './components/system/AppErrorBoundary';

export function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppErrorBoundary>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route element={<RequireGuest />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                </Route>
                <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
                <Route path="/freelancers" element={<FreelancersPage />} />
                <Route path="/freelancers/:id" element={<FreelancerProfilePage />} />
                <Route element={<RequireAuth />}>
                  <Route path="/workspace" element={<DashboardPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/dashboard/client" element={<Navigate to="/dashboard/client/overview" replace />} />
                  <Route path="/dashboard/client/overview" element={<ClientDashboardPage />} />
                  <Route path="/dashboard/client/analytics" element={<WorkspaceAnalyticsPage />} />
                  <Route path="/dashboard/client/activity" element={<WorkspaceActivityPage />} />
                  <Route path="/dashboard/client/orders" element={<ClientOrdersPage />} />
                  <Route path="/dashboard/client/finance" element={<ClientFinancePage />} />
                  <Route path="/dashboard/client/billing" element={<WorkspacePaymentMethodsPage />} />
                  <Route path="/dashboard/client/subscription" element={<WorkspaceSubscriptionPage />} />
                  <Route path="/dashboard/client/notifications" element={<DashboardNotificationsPage />} />
                  <Route path="/dashboard/client/messages" element={<DashboardMessagesPage />} />
                  <Route path="/dashboard/client/support" element={<SupportCasesPage />} />
                  <Route path="/dashboard/client/documents" element={<DashboardDocumentsPage />} />
                  <Route path="/dashboard/client/team" element={<WorkspaceTeamPage />} />
                  <Route path="/dashboard/client/security" element={<WorkspaceSecurityPage />} />
                  <Route path="/dashboard/client/verification" element={<WorkspaceVerificationPage />} />
                  <Route path="/dashboard/client/profile" element={<ClientDashboardProfilePage />} />
                  <Route path="/dashboard/client/settings" element={<DashboardSettingsPage />} />
                  <Route path="/dashboard/freelancer" element={<Navigate to="/dashboard/freelancer/overview" replace />} />
                  <Route path="/dashboard/freelancer/overview" element={<FreelancerDashboardPage />} />
                  <Route path="/dashboard/freelancer/analytics" element={<WorkspaceAnalyticsPage />} />
                  <Route path="/dashboard/freelancer/activity" element={<WorkspaceActivityPage />} />
                  <Route path="/dashboard/freelancer/orders" element={<FreelancerOrdersPage />} />
                  <Route path="/dashboard/freelancer/market" element={<FreelancerMarketPage />} />
                  <Route path="/dashboard/freelancer/finance" element={<FreelancerFinancePage />} />
                  <Route path="/dashboard/freelancer/payouts" element={<WorkspacePaymentMethodsPage />} />
                  <Route path="/dashboard/freelancer/subscription" element={<WorkspaceSubscriptionPage />} />
                  <Route path="/dashboard/freelancer/notifications" element={<DashboardNotificationsPage />} />
                  <Route path="/dashboard/freelancer/messages" element={<DashboardMessagesPage />} />
                  <Route path="/dashboard/freelancer/support" element={<SupportCasesPage />} />
                  <Route path="/dashboard/freelancer/documents" element={<DashboardDocumentsPage />} />
                  <Route path="/dashboard/freelancer/team" element={<WorkspaceTeamPage />} />
                  <Route path="/dashboard/freelancer/security" element={<WorkspaceSecurityPage />} />
                  <Route path="/dashboard/freelancer/verification" element={<WorkspaceVerificationPage />} />
                  <Route path="/dashboard/freelancer/profile" element={<FreelancerDashboardProfilePage />} />
                  <Route path="/dashboard/freelancer/resume" element={<FreelancerResumePage />} />
                  <Route path="/dashboard/freelancer/settings" element={<DashboardSettingsPage />} />
                  <Route path="/orders/new" element={<CreateOrderPage />} />
                  <Route path="/orders/:id" element={<OrderPage />} />
                  <Route path="/orders/:id/dispute" element={<DisputePage />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppErrorBoundary>

            <Toaster
              position="top-right"
              closeButton
              expand
              toastOptions={{
                style: {
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid color-mix(in srgb, var(--color-border) 72%, transparent)',
                  boxShadow: 'var(--shadow-raised)',
                },
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
