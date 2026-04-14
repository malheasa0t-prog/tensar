"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Services listing error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function ServicesError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء تحميل خدمات الصيانة"
      description="تعذر عرض خدمات الصيانة أو نموذج الحجز الآن. أعد المحاولة أو ارجع للرئيسية."
    />
  );
}

