import StatusPanel from "@/components/StatusPanel";

export default function LoadingProductDetails() {
  return (
    <section className="section page-top" style={{ paddingBottom: "4rem" }}>
      <div className="container">
        <StatusPanel
          compact
          icon="refresh-cw"
          eyebrow="جاري تحميل المنتج"
          title="نجهز تفاصيل المنتج"
          description="يتم الآن تحميل الصورة، المواصفات، ومسار الشراء."
        />
      </div>
    </section>
  );
}
