import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";

export default function Loading() {
  return <CatalogPageSkeleton showCategories categoryCount={6} showProducts={false} />;
}
