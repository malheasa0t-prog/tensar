"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Category page error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function CategoryError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء تحميل الفئة"
      description="تعذر عرض محتوى هذه الفئة أو منتجاتها الآن. أعد المحاولة أو ارجع إلى صفحة المنتجات."
    />
  );
}

