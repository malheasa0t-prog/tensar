import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import DashboardShellSkeleton from "@/components/DashboardShellSkeleton";
import HomePageSkeleton from "@/components/HomePageSkeleton";
import ProductDetailsSkeleton from "@/components/ProductDetailsSkeleton";
import RouteLoadingScreen from "@/components/RouteLoadingScreen";
import CheckoutPageSkeleton from "@/components/checkout/CheckoutPageSkeleton";
import { resolveRouteSuspenseFallback } from "@/lib/routeSuspenseModel";

/**
 * Renders a route-aware suspense fallback that matches the destination layout.
 *
 * @param {{ pathname?: string }} props
 * @returns {JSX.Element}
 */
export default function RouteSuspenseFallback({ pathname = "/" }) {
  const fallbackConfig = resolveRouteSuspenseFallback(pathname);

  switch (fallbackConfig.kind) {
    case "home":
      return <HomePageSkeleton />;
    case "dashboard":
      return <DashboardShellSkeleton />;
    case "checkout":
      return <CheckoutPageSkeleton />;
    case "product-details":
      return <ProductDetailsSkeleton />;
    case "catalog":
      return <CatalogPageSkeleton {...fallbackConfig} />;
    case "screen":
    default:
      return <RouteLoadingScreen {...fallbackConfig} />;
  }
}
