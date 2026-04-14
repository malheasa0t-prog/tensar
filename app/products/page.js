import "../techfix-pages.css";
import Link from "next/link";
import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import ProductsExplorerClient from "@/components/ProductsExplorerClient";
import StatusPanel from "@/components/StatusPanel";
import { isAccessoryCatalogCategoryId, isAccessoryProduct } from "@/lib/accessoryCatalog";
import { mapProductsExplorerProduct } from "@/lib/productsExplorerModel";
import { getPageMetadata } from "@/lib/siteMetadata";
import { supabase } from "@/lib/supabaseClient";

export async function generateMetadata() {
  return getPageMetadata({
    title: "المنتجات",
    description: "استكشف كتالوج المنتجات مع البحث والفلترة والترتيب داخل واجهة واحدة.",
  });
}

export const revalidate = 60;

export default async function ProductsPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const initialSearchQuery = String(resolvedSearchParams?.search || "").trim();
  const [{ data: productsData, error: productsError }, { data: categoriesData, error: categoriesError }] =
    await Promise.all([
      supabase.from("products").select("*").in("status", ["active", "out_of_stock"]),
      supabase.from("categories").select("id, name").eq("status", "active"),
    ]);

  if (productsError || categoriesError) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل الكتالوج"
            title="لم نتمكن من عرض المنتجات الآن"
            description="حدث خلل أثناء جلب المنتجات أو الفئات. أعد المحاولة بعد قليل أو انتقل إلى صفحة التواصل."
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

  const categories = (categoriesData || []).filter((category) => !isAccessoryCatalogCategoryId(category.id));
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  const products = (productsData || [])
    .filter((product) => !isAccessoryProduct(product))
    .map((product) => mapProductsExplorerProduct(product, categoryById[product.category_id] || "منتجات عامة"));

  return (
    <section className="section page-top">
      <div className="container">
        <div className="section-topbar" style={{ marginBottom: "1rem" }}>
          <PageSectionBreadcrumbs />
        </div>
        <ProductsExplorerClient
          initialProducts={products}
          categories={categories}
          initialSearchQuery={initialSearchQuery}
        />
      </div>
    </section>
  );
}
