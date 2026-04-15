import Link from "next/link";
import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import ProductsExplorerClient from "@/components/ProductsExplorerClient";
import StatusPanel from "@/components/StatusPanel";
import { useSearchParams } from "react-router-dom";
import { useAsyncPageData } from "../hooks/useAsyncPageData.js";
import { loadProductsPageSnapshot } from "../data/publicPageData.js";

const EMPTY_PRODUCTS_DATA = {
  categories: [],
  products: []
};

/**
 * Renders the products explorer page in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function ProductsRoute() {
  const [searchParams] = useSearchParams();
  const initialSearchQuery = String(searchParams.get("search") || "").trim();
  const { data, error } = useAsyncPageData(loadProductsPageSnapshot, [], EMPTY_PRODUCTS_DATA);

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل الكتالوج"
            title="لم نتمكن من عرض المنتجات الآن"
            description="حدث خلل أثناء جلب المنتجات أو الفئات."
            actions={
              <>
                <Link href="/products" className="btn btn-primary">
                  إعادة المحاولة
                </Link>
                <Link href="/contact" className="btn btn-outline">
                  تواصل معنا
                </Link>
              </>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="section page-top">
      <div className="container">
        <div className="section-topbar" style={{ marginBottom: "1rem" }}>
          <PageSectionBreadcrumbs />
        </div>
        <ProductsExplorerClient
          initialProducts={data.products}
          categories={data.categories}
          initialSearchQuery={initialSearchQuery}
        />
      </div>
    </section>
  );
}
