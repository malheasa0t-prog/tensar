"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Products catalog error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function ProductsError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء تحميل المنتجات"
      description="تعذر إكمال عرض الكتالوج أو نتائج الفلاتر الآن. يمكنك إعادة المحاولة أو الرجوع للرئيسية."
    />
  );
}

