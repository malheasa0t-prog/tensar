import Link from 'next/link';
import StatusPanel from '@/components/StatusPanel';
import { getCategoryHref } from '@/lib/categoryPageModel';

/**
 * Empty state shown when a leaf category has no published products.
 *
 * @param {{
 *   mainCategory: Record<string, unknown> | null,
 *   category: Record<string, unknown> | null,
 * }} props
 * @returns {JSX.Element}
 */
export default function CategoryEmptyState({ mainCategory, category }) {
  const showParentLink = mainCategory && mainCategory.id !== category?.id;

  return (
    <StatusPanel
      icon="shopping-bag"
      eyebrow="لا توجد منتجات"
      title="هذه الفئة لا تحتوي منتجات منشورة حالياً"
      description="عند إضافة منتجات جديدة إلى هذه الفئة ستظهر هنا تلقائيًا داخل بطاقات واضحة."
      actions={
        showParentLink ? (
          <Link href={getCategoryHref(mainCategory)} className="btn btn-outline">
            العودة إلى {mainCategory.name}
          </Link>
        ) : (
          <Link href="/products" className="btn btn-outline">
            العودة إلى الفئات
          </Link>
        )
      }
    />
  );
}
