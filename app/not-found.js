import Link from "next/link";
import StatusPanel from "@/components/StatusPanel";

export default function NotFound() {
  return (
    <section className="section page-top" style={{ paddingBottom: "4rem" }}>
      <div className="container">
        <StatusPanel
          tone="error"
          icon="folder-open"
          eyebrow="الصفحة غير متاحة"
          title="الوجهة التي تحاول الوصول إليها غير موجودة"
          description="قد يكون الرابط تغير أو أن العنصر لم يعد متاحًا حاليًا. يمكنك العودة للصفحة الرئيسية أو الانتقال إلى المنتجات والخدمات المتاحة."
          actions={
            <>
              <Link href="/" className="btn btn-primary">
                العودة للرئيسية
              </Link>
              <Link href="/products" className="btn btn-outline">
                تصفح المنتجات
              </Link>
            </>
          }
        />
      </div>
    </section>
  );
}
