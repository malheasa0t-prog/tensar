"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Dashboard route error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function DashboardError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء تحميل لوحة التحكم"
      description="تعذر عرض بيانات الحساب أو الأقسام الداخلية الآن. أعد المحاولة أو ارجع إلى الرئيسية."
    />
  );
}
