"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Product detail error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function ProductDetailsError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء تحميل المنتج"
      description="تعذر جلب تفاصيل المنتج أو المسار الشرائي الآن. أعد المحاولة أو عد إلى صفحة المنتجات."
    />
  );
}

