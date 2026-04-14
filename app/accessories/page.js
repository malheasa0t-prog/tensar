import "../techfix-pages.css";
import Link from "next/link";
import AccessoriesClient from "@/components/AccessoriesClient";
import StatusPanel from "@/components/StatusPanel";
import { supabase } from "@/lib/supabaseClient";
import { isAccessoryProduct } from "@/lib/accessoryCatalog";
import { getPageMetadata } from "@/lib/siteMetadata";

export async function generateMetadata() {
  return getPageMetadata({
    title: "الإكسسوارات",
    description: "تصفح أحدث منتجات الإكسسوارات والملحقات التقنية بأفضل الأسعار.",
  });
}

export const revalidate = 0;

export default async function AccessoriesPage() {
  const [{ data: productsData, error: productsError }, { data: categoriesData }] = await Promise.all([
    supabase.from("products").select("*").eq("status", "active"),
    supabase.from("categories").select("id, name").eq("status", "active"),
  ]);

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

  const accessoryProducts = (productsData || [])
    .filter((product) => isAccessoryProduct(product))
    .sort(
      (first, second) =>
        new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
    );

  return (
    <section className="section page-top">
      <div className="container">
        <AccessoriesClient initialProducts={accessoryProducts} categories={categoriesData || []} />
      </div>
    </section>
  );
}
