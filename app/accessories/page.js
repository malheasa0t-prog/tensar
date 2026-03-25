import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import ProductCard from "@/components/ProductCard";
import StatusPanel from "@/components/StatusPanel";
import { supabase } from "@/lib/supabaseClient";
import {
  ACCESSORY_PUBLIC_LABEL,
  ACCESSORY_SECTION_NAME,
  isAccessoryProduct,
} from "@/lib/accessoryCatalog";
import { getPageMetadata } from "@/lib/siteMetadata";

export async function generateMetadata() {
  return getPageMetadata({
    title: "الإكسسوارات",
    description: "تصفح أحدث منتجات الإكسسوارات والملحقات التقنية بأفضل الأسعار.",
  });
}

export const revalidate = 60;

export default async function AccessoriesPage() {
  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("status", "active");

  if (productsError) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل الإكسسوارات"
            title="لم نتمكن من عرض الإكسسوارات الآن"
            description="حصل خلل أثناء الجلب. أعد المحاولة بعد قليل أو تواصل معنا."
            actions={
              <>
                <Link href="/accessories" className="btn btn-primary">
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

  const products = productsData || [];
  const accessoryProducts = products
    .filter((product) => isAccessoryProduct(product))
    .sort(
      (first, second) =>
        new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
    );

  const hasAnyContent = accessoryProducts.length > 0;

  return (
    <section className="section page-top" style={{ paddingBottom: "4rem" }}>
      <div className="container" style={{ display: "grid", gap: "1.5rem" }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <h1>الإكسسوارات</h1>
          <p>أفضل الملحقات التقنية، الشواحن، الكابلات، والعديد من الإكسسوارات الأخرى بأسعار تنافسية.</p>
        </div>

        {!hasAnyContent ? (
          <StatusPanel
            icon="headphones"
            eyebrow="لا توجد إكسسوارات حاليًا"
            title="لم يتم إضافة أي إكسسوارات بعد"
            description="نقوم بتحديث متجرنا باستمرار. يرجى العودة لاحقًا لاستكشاف أحدث الإكسسوارات."
          />
        ) : null}

        {accessoryProducts.length > 0 ? (
          <div className="surface-panel section-shell">
            <div className="section-shell-head">
              <div className="section-shell-copy">
                <h2>{ACCESSORY_SECTION_NAME}</h2>
                <p>تصفح أحدث الإكسسوارات المستقلة المضافة مؤخرًا لمتجرنا.</p>
              </div>

              <span className="section-count-badge">
                <AppIcon name="headphones" size={14} />
                {accessoryProducts.length} إكسسوار
              </span>
            </div>

            <div className="balanced-card-grid">
              {accessoryProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    category: ACCESSORY_PUBLIC_LABEL,
                    categoryId: null,
                    price: product.price,
                    discountPrice: product.discount_price,
                    description: product.description,
                    badge: product.brand || null,
                    images: product.images || [],
                    icon: product.icon || ACCESSORY_PUBLIC_LABEL,
                    link: `/products/${product.id}`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
