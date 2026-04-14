import StatusPanel from '@/components/StatusPanel';

/**
 * Empty state shown when a leaf category has no published products.
 *
 * @returns {JSX.Element}
 */
export default function CategoryEmptyState() {
  return (
    <StatusPanel
      icon="shopping-bag"
      eyebrow="لا توجد منتجات"
      title="هذه الفئة لا تحتوي منتجات منشورة حالياً"
      description="عند إضافة منتجات جديدة إلى هذه الفئة ستظهر هنا تلقائياً."
    />
  );
}
