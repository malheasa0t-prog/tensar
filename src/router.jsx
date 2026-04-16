/**
 * Application Router Configuration.
 *
 * Defines all client-side routes using React Router DOM.
 * Lazy-loads page components for optimal bundle splitting.
 */

import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import App from './App';

/* ─── Lazy-loaded Pages ─── */

const HomePage = lazy(() => import('@/app/page'));
const ProductsPage = lazy(() => import('@/app/products/page'));
const ProductDetailPage = lazy(() => import('@/app/products/[id]/page'));
const ServicesPage = lazy(() => import('@/app/services/page'));
const ServiceDetailPage = lazy(() => import('@/app/services/[slug]/page'));
const CategoryPage = lazy(() => import('@/app/category/[id]/page'));
const ContactPage = lazy(() => import('@/app/contact/page'));
const CheckoutPage = lazy(() => import('@/app/checkout/page'));
const ComparePage = lazy(() => import('@/app/compare/page'));
const AccessoriesPage = lazy(() => import('@/app/accessories/page'));
const SubscriptionsPage = lazy(() => import('@/app/subscriptions/page'));
const DepositPage = lazy(() => import('@/app/deposit/page'));
const NotFoundPage = lazy(() => import('@/app/not-found'));

/* ─── Auth Pages ─── */
const LoginPage = lazy(() => import('@/app/auth/login/page'));
const RegisterPage = lazy(() => import('@/app/auth/register/page'));
const RecoverPage = lazy(() => import('@/app/auth/recover/page'));
const AuthCallbackPage = lazy(() => import('@/app/auth/callback/page'));

/* ─── Dashboard Pages ─── */
const DashboardPage = lazy(() => import('@/app/dashboard/page'));
const DashboardOrdersPage = lazy(() => import('@/app/dashboard/orders/page'));
const DashboardFavoritesPage = lazy(() => import('@/app/dashboard/favorites/page'));
const DashboardProfilePage = lazy(() => import('@/app/dashboard/profile/page'));
const DashboardNotificationsPage = lazy(() => import('@/app/dashboard/notifications/page'));
const DashboardDepositPage = lazy(() => import('@/app/dashboard/deposit/page'));
const DashboardWalletPage = lazy(() => import('@/app/dashboard/wallet/page'));

/**
 * Renders the application route tree.
 *
 * @returns {JSX.Element}
 */
export default function AppRouter() {
  return (
    <Routes>
      <Route element={<App />}>
        {/* ── Public Routes ── */}
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:slug" element={<ServiceDetailPage />} />
        <Route path="category/:id" element={<CategoryPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="accessories" element={<AccessoriesPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="deposit" element={<DepositPage />} />

        {/* ── Auth Routes ── */}
        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/register" element={<RegisterPage />} />
        <Route path="auth/recover" element={<RecoverPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />

        {/* ── Dashboard Routes ── */}
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboard/orders" element={<DashboardOrdersPage />} />
        <Route path="dashboard/favorites" element={<DashboardFavoritesPage />} />
        <Route path="dashboard/profile" element={<DashboardProfilePage />} />
        <Route path="dashboard/notifications" element={<DashboardNotificationsPage />} />
        <Route path="dashboard/deposit" element={<DashboardDepositPage />} />
        <Route path="dashboard/wallet" element={<DashboardWalletPage />} />

        {/* ── Catch-all 404 ── */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
