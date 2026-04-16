import Link from "next/link";
import AccessoriesClient from "@/components/AccessoriesClient";
import StatusPanel from "@/components/StatusPanel";
import { useAsyncPageData } from "../hooks/useAsyncPageData.js";
import { loadAccessoriesPageSnapshot } from "../data/publicPageData.js";

const EMPTY_ACCESSORIES_DATA = {
  categories: [],
  products: []
};

/**
 * Renders the accessories catalog in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function AccessoriesRoute() {
  const { data, error } = useAsyncPageData(
    loadAccessoriesPageSnapshot,
    [],
    EMPTY_ACCESSORIES_DATA
  );

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل الإكسسوارات"
            title="لم نتمكن من عرض الإكسسوارات الآن"
            description="حصل خلل أثناء الجلب."
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

  return (
    <section className="section page-top">
      <div className="container">
        <AccessoriesClient initialProducts={data.products} categories={data.categories} />
      </div>
    </section>
  );
}
