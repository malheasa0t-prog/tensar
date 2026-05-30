/**
 * Application Router Configuration.
 *
 * Defines all client-side routes using React Router DOM.
 * Lazy-loads page components for optimal bundle splitting.
 */

import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import App from './App';
import { routeModuleLoaders } from './routePrefetch';

/* Lazy-loaded Pages */

const HomePage = lazy(routeModuleLoaders.home);
const ServicesPage = lazy(routeModuleLoaders.services);
const ServiceDetailPage = lazy(routeModuleLoaders['service-detail']);
const CategoryPage = lazy(routeModuleLoaders.category);
const ContactPage = lazy(routeModuleLoaders.contact);
const CheckoutPage = lazy(routeModuleLoaders.checkout);
const ComparePage = lazy(routeModuleLoaders.compare);
const SharedFavoritesPage = lazy(routeModuleLoaders["favorites-shared"]);
const DepositPage = lazy(routeModuleLoaders.deposit);
const TrackOrderPage = lazy(routeModuleLoaders.track);
const HelpCenterPage = lazy(routeModuleLoaders.help);
const NotFoundPage = lazy(() => import('@/app/not-found'));

/* Auth Pages */
const LoginPage = lazy(routeModuleLoaders['auth-login']);
const RegisterPage = lazy(routeModuleLoaders['auth-register']);
const RecoverPage = lazy(routeModuleLoaders['auth-recover']);
const AuthCallbackPage = lazy(routeModuleLoaders['auth-callback']);

/* Dashboard Layout + Pages */
const DashboardLayout = lazy(() => import('@/app/dashboard/layout'));
const DashboardPage = lazy(routeModuleLoaders.dashboard);
const DashboardOrdersPage = lazy(routeModuleLoaders['dashboard-orders']);
const DashboardFavoritesPage = lazy(routeModuleLoaders['dashboard-favorites']);
const DashboardProfilePage = lazy(routeModuleLoaders['dashboard-profile']);
const DashboardNotificationsPage = lazy(routeModuleLoaders['dashboard-notifications']);
const DashboardDepositPage = lazy(routeModuleLoaders['dashboard-deposit']);
const DashboardWalletPage = lazy(routeModuleLoaders['dashboard-wallet']);

/**
 * Renders the application route tree.
 *
 * @returns {JSX.Element}
 */
export default function AppRouter() {
  return (
    <Routes>
      <Route element={<App />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<Navigate to="/services" replace />} />
        <Route path="products/:id" element={<Navigate to="/services" replace />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:slug" element={<ServiceDetailPage />} />
        <Route path="category/:id" element={<CategoryPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="favorites/shared" element={<SharedFavoritesPage />} />
        <Route path="deposit" element={<DepositPage />} />
        <Route path="track" element={<TrackOrderPage />} />
        <Route path="help" element={<HelpCenterPage />} />

        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/register" element={<RegisterPage />} />
        <Route path="auth/recover" element={<RecoverPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />

        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<DashboardOrdersPage />} />
          <Route path="favorites" element={<DashboardFavoritesPage />} />
          <Route path="profile" element={<DashboardProfilePage />} />
          <Route path="notifications" element={<DashboardNotificationsPage />} />
          <Route path="deposit" element={<DashboardDepositPage />} />
          <Route path="wallet" element={<DashboardWalletPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
