import StatusPanel from '@/components/StatusPanel';

/**
 * Empty state shown when a service category has no published repair services.
 *
 * @returns {JSX.Element} Empty state panel.
 */
export default function CategoryEmptyState() {
  return (
    <StatusPanel
      icon="wrench"
      eyebrow="لا توجد خدمات"
      title="هذه الفئة لا تحتوي خدمات صيانة منشورة حالياً"
      description="عند إضافة خدمات صيانة لهذه الفئة أو لإحدى فئاتها الفرعية ستظهر هنا تلقائياً."
    />
  );
}
