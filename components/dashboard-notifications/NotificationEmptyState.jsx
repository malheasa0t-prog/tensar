import Link from 'next/link';
import { emptyStateStyle } from '@/components/dashboard-notifications/dashboardNotificationsStyles';

/**
 * Displays the empty state when there are no visible notifications.
 *
 * @param {{ showUnreadOnly: boolean }} props
 * @returns {JSX.Element}
 */
export default function NotificationEmptyState({ showUnreadOnly }) {
  return (
    <div style={emptyStateStyle}>
      <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>📭</div>
      <h3 style={{ marginBottom: '8px', color: 'var(--text-color)' }}>
        {showUnreadOnly ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات حالياً'}
      </h3>
      <p style={{ marginBottom: '16px' }}>
        {showUnreadOnly
          ? 'كل الإشعارات الحالية تمت قراءتها.'
          : 'عندما يرسل لك الأدمن رسالة أو يتغير وضع طلبك ستظهر هنا.'}
      </p>
      <Link href="/dashboard" className="btn btn-outline btn-sm">
        العودة إلى الملخص
      </Link>
    </div>
  );
}
