"use client";

import RouteErrorState from '@/components/RouteErrorState';

/**
 * Checkout route error boundary.
 *
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 * @returns {JSX.Element}
 */
export default function CheckoutError({ error, reset }) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      title="حدث خطأ أثناء إتمام الشراء"
      description="تعذر تجهيز نموذج الطلب أو ملخص السلة الآن. أعد المحاولة أو ارجع إلى المنتجات."
    />
  );
}
