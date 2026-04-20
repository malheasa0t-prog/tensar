import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import ComparePageClient from "@/components/compare/ComparePageClient";

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
