import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import ComparePageClient from "@/components/compare/ComparePageClient";

/**
 * Renders the compare page in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function CompareRoute() {
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
