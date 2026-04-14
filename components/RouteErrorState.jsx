"use client";

import Link from 'next/link';

import AppIcon from '@/components/AppIcon';
import styles from '@/components/RouteErrorState.module.css';

/**
 * Renders a reusable route error boundary card with retry and navigation actions.
 *
 * @param {{
 *   error?: Error & { digest?: string },
 *   reset: () => void,
 *   title?: string,
 *   description?: string,
 * }} props
 * @returns {JSX.Element}
 */
export default function RouteErrorState({
  error,
  reset,
  title = 'حدث خطأ غير متوقع',
  description = 'تعذر إكمال هذه الصفحة الآن. يمكنك إعادة المحاولة أو الرجوع إلى الصفحة الرئيسية.',
}) {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <AppIcon name="x" size={28} />
          </div>
          <span className={styles.eyebrow}>خطأ في تحميل الصفحة</span>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.description}>{description}</p>
          {error?.message ? <p className={styles.message}>{error.message}</p> : null}

          <div className={styles.actions}>
            <button type="button" onClick={reset} className="btn btn-primary">
              إعادة المحاولة
            </button>
            <Link href="/" className="btn btn-outline">
              العودة إلى الرئيسية
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
