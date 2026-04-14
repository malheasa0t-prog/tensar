"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Root app error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function GlobalError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء تحميل الصفحة"
      description="تعذر عرض هذه الصفحة الآن. أعد المحاولة أو ارجع إلى الرئيسية لمتابعة التصفح."
    />
  );
}

