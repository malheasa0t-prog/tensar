import Image from "next/image";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import StatusPanel from "@/components/StatusPanel";
import { supabase } from "@/lib/supabaseClient";
import {
  isAccessoryCatalogCategoryId,
  isAccessoryProduct,
} from "@/lib/accessoryCatalog";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { getPageMetadata } from "@/lib/siteMetadata";

export async function generateMetadata() {
  return getPageMetadata({
    title: "المنتجات",
    description: "استكشف الفئات الرئيسية والفرعية للوصول إلى كافة المنتجات المتاحة.",
  });
}

export const revalidate = 60;

export default async function ProductsPage() {
  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("status", "active");

  const { data: categoriesData, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .eq("status", "active");

  if (productsError || categoriesError) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل الكتالوج"
            title="لم نتمكن من عرض المنتجات الآن"
            description="حصل خلل أثناء جلب المنتجات أو الأقسام. أعد المحاولة بعد قليل أو انتقل إلى صفحة التواصل للحصول على المساعدة."
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

  const categories = categoriesData || [];
  const products = productsData || [];
  const catalogProducts = products.filter((product) => !isAccessoryProduct(product));
  const visibleCatalogCategories = categories.filter((category) => !isAccessoryCatalogCategoryId(category.id));
  const categoryById = Object.fromEntries(visibleCatalogCategories.map((category) => [category.id, category]));
  const categoryIdSet = new Set(visibleCatalogCategories.map((category) => category.id));

  const mainCategories = visibleCatalogCategories
    .filter((category) => !category.parent_id || !categoryIdSet.has(category.parent_id))
    .sort(
      (first, second) =>
        Number(first.sort_order || 0) - Number(second.sort_order || 0) ||
        String(first.name || "").localeCompare(String(second.name || ""), "ar")
    );

  const childCountByParent = visibleCatalogCategories.reduce((counts, category) => {
    if (category.parent_id && categoryIdSet.has(category.parent_id)) {
      counts[category.parent_id] = (counts[category.parent_id] || 0) + 1;
    }
    return counts;
  }, {});

  const getRootCategoryId = (categoryId) => {
    let current = categoryById[categoryId];

    while (current?.parent_id && categoryById[current.parent_id]) {
      current = categoryById[current.parent_id];
    }

    return current?.id || categoryId;
  };

  const productsCountByRoot = catalogProducts.reduce((counts, product) => {
    if (!product.category_id || !categoryById[product.category_id]) {
      return counts;
    }

    const rootCategoryId = getRootCategoryId(product.category_id);
    counts[rootCategoryId] = (counts[rootCategoryId] || 0) + 1;
    return counts;
  }, {});

  const visibleCategories = mainCategories.filter((category) => {
    const hasChildren = (childCountByParent[category.id] || 0) > 0;
    const hasProducts = (productsCountByRoot[category.id] || 0) > 0;
    return hasChildren || hasProducts;
  });

  return (
    <section className="section page-top" style={{ paddingBottom: "4rem" }}>
      <div className="container" style={{ display: "grid", gap: "1.5rem" }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <h1>المنتجات</h1>
          <p>ادخل إلى الفئات الرئيسية ثم الفرعية للوصول إلى كافة المنتجات المتاحة لدينا.</p>
        </div>

        {visibleCategories.length === 0 ? (
          <StatusPanel
            icon="folder-open"
            eyebrow="لا توجد فئات جاهزة الآن"
            title="سيظهر الكتالوج هنا تلقائيًا"
            description="بمجرد إضافة فئات أو منتجات مفعلة ستظهر هنا تلقائيًا."
          />
        ) : null}

        {visibleCategories.length > 0 ? (
          <div className="surface-panel section-shell">
            <div className="section-shell-head">
              <div className="section-shell-copy">
                <h2>الفئات الرئيسية</h2>
                <p>اختر الفئة أولًا، ثم ادخل إلى الفئات الفرعية أو المنتجات المرتبطة بها داخل مسار أوضح وأكثر تنظيمًا.</p>
              </div>

              <span className="section-count-badge">
                <AppIcon name="folder-open" size={14} />
                {visibleCategories.length} فئة
              </span>
            </div>

            <div className="category-hub-grid">
              {visibleCategories.map((category) => {
                const directChildren = childCountByParent[category.id] || 0;
                const totalProducts = productsCountByRoot[category.id] || 0;

                return (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug || category.id}`}
                    className="surface-card category-hub-card"
                  >
                    <div className="category-hub-top">
                      <div className="category-hub-icon">
                        {category.image ? (
                          <Image
                            src={category.image}
                            alt={category.name}
                            className="category-hub-image"
                            width={72}
                            height={72}
                            unoptimized={!isOptimizableImageSrc(category.image)}
                          />
                        ) : (
                          <AppIcon name={category.icon || category.name || "folder"} size={28} />
                        )}
                      </div>

                      <span className="section-count-badge">
                        <AppIcon name={directChildren > 0 ? "folder" : "boxes"} size={14} />
                        {directChildren > 0 ? `${directChildren} قسم` : `${totalProducts} منتج`}
                      </span>
                    </div>

                    <div className="category-hub-copy">
                      <h2>{category.name}</h2>
                      <p>
                        {category.description ||
                          (directChildren > 0
                            ? "ادخل إلى هذه الفئة لاستعراض الأقسام الفرعية ثم الوصول إلى المنتجات الخاصة بكل قسم."
                            : "ادخل إلى هذه الفئة لعرض المنتجات المرتبطة بها مباشرة داخل بطاقات أوضح وأسهل للتصفح.")}
                      </p>
                    </div>

                    <div className="category-hub-meta">
                      <span className="category-hub-pill">
                        <AppIcon name="shopping-bag" size={13} />
                        {totalProducts} منتج
                      </span>

                      {directChildren > 0 ? (
                        <span className="category-hub-pill">
                          <AppIcon name="folder" size={13} />
                          {directChildren} قسم فرعي
                        </span>
                      ) : null}
                    </div>

                    <span className="category-hub-link">
                      افتح الفئة
                      <AppIcon name="arrow-left" size={14} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
