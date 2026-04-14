import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import ComparePageClient from "@/components/compare/ComparePageClient";
import { getPageMetadata } from "@/lib/siteMetadata";

export async function generateMetadata() {
  return getPageMetadata({
    title: "مقارنة المنتجات",
    description: "قارن بين المنتجات جنباً إلى جنب لمعرفة السعر والتقييم والمخزون قبل الشراء.",
  });
}

export default function ComparePage() {
  return (
    <section className="section page-top">
      <div className="container">
        <div className="section-topbar" style={{ marginBottom: "1rem" }}>
          <PageSectionBreadcrumbs />
        </div>
        <ComparePageClient />
      </div>
    </section>
  );
}
