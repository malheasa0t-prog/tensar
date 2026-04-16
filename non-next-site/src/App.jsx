import { Navigate, Route, Routes } from "react-router-dom";
import DashboardOutletShell from "./components/DashboardOutletShell.jsx";
import PublicSiteShell from "./components/PublicSiteShell.jsx";
import AccessoriesRoute from "./routes/AccessoriesRoute.jsx";
import AuthCallbackRoute from "./routes/AuthCallbackRoute.jsx";
import AuthLoginRoute from "./routes/AuthLoginRoute.jsx";
import AuthRecoverRoute from "./routes/AuthRecoverRoute.jsx";
import AuthRegisterRoute from "./routes/AuthRegisterRoute.jsx";
import CategoryRoute from "./routes/CategoryRoute.jsx";
import CheckoutRoute from "./routes/CheckoutRoute.jsx";
import CompareRoute from "./routes/CompareRoute.jsx";
import ContactRoute from "./routes/ContactRoute.jsx";
import HomeRoute from "./routes/HomeRoute.jsx";
import NotFoundPage from "./routes/NotFoundPage.jsx";
import ProductDetailsRoute from "./routes/ProductDetailsRoute.jsx";
import ProductsRoute from "./routes/ProductsRoute.jsx";
import PublicDepositRoute from "./routes/PublicDepositRoute.jsx";
import ServiceDetailsRoute from "./routes/ServiceDetailsRoute.jsx";
import ServicesRoute from "./routes/ServicesRoute.jsx";
import SubscriptionsRoute from "./routes/SubscriptionsRoute.jsx";
import DashboardDepositRoute from "./routes/dashboard/DashboardDepositRoute.jsx";
import DashboardFavoritesRoute from "./routes/dashboard/DashboardFavoritesRoute.jsx";
import DashboardHomeRoute from "./routes/dashboard/DashboardHomeRoute.jsx";
import DashboardNotificationsRoute from "./routes/dashboard/DashboardNotificationsRoute.jsx";
import DashboardOrdersRoute from "./routes/dashboard/DashboardOrdersRoute.jsx";
import DashboardProfileRoute from "./routes/dashboard/DashboardProfileRoute.jsx";
import DashboardWalletRoute from "./routes/dashboard/DashboardWalletRoute.jsx";

/**
 * Registers the parallel non-Next application routes while reusing the existing UI modules.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <Routes>
      <Route element={<PublicSiteShell />}>
        <Route index element={<HomeRoute />} />
        <Route path="products" element={<ProductsRoute />} />
        <Route path="products/:id" element={<ProductDetailsRoute />} />
        <Route path="accessories" element={<AccessoriesRoute />} />
        <Route path="services" element={<ServicesRoute />} />
        <Route path="services/:slug" element={<ServiceDetailsRoute />} />
        <Route path="category/:id" element={<CategoryRoute />} />
        <Route path="contact" element={<ContactRoute />} />
        <Route path="subscriptions" element={<SubscriptionsRoute />} />
        <Route path="compare" element={<CompareRoute />} />
        <Route path="checkout" element={<CheckoutRoute />} />
        <Route path="deposit" element={<PublicDepositRoute />} />
        <Route path="auth/login" element={<AuthLoginRoute />} />
        <Route path="auth/register" element={<AuthRegisterRoute />} />
        <Route path="auth/recover" element={<AuthRecoverRoute />} />
        <Route path="auth/callback" element={<AuthCallbackRoute />} />

        <Route path="dashboard" element={<DashboardOutletShell />}>
          <Route index element={<DashboardHomeRoute />} />
          <Route path="orders" element={<DashboardOrdersRoute />} />
          <Route path="favorites" element={<DashboardFavoritesRoute />} />
          <Route path="notifications" element={<DashboardNotificationsRoute />} />
          <Route path="wallet" element={<DashboardWalletRoute />} />
          <Route path="deposit" element={<DashboardDepositRoute />} />
          <Route path="profile" element={<DashboardProfileRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="admin" element={<Navigate replace to="/admin.html" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
