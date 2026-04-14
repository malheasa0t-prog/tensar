"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Service detail error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function ServiceDetailsError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء تحميل الخدمة"
      description="تعذر تجهيز تفاصيل الخدمة أو خيارات الحجز الآن. أعد المحاولة أو ارجع لقائمة الخدمات."
    />
  );
}

