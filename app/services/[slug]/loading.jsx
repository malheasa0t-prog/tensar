import StatusPanel from "@/components/StatusPanel";

export default function LoadingServiceDetails() {
  return (
    <section className="section page-top" style={{ paddingBottom: "4rem" }}>
      <div className="container">
        <StatusPanel
          compact
          icon="refresh-cw"
          eyebrow="جاري تحميل الخدمة"
          title="نجهز تفاصيل الخدمة"
          description="يتم الآن تحميل السعر، مدة التنفيذ، وخيارات الحجز."
        />
      </div>
    </section>
  );
}
