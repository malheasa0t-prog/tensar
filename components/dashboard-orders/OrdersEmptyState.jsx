import Link from 'next/link';
import { emptyStateStyle } from '@/components/dashboard-orders/dashboardOrdersStyles';

/**
 * Displays an empty state with an optional call to action.
 *
 * @param {{
 *   title: string,
 *   body: string,
 *   href?: string,
 *   actionLabel?: string,
 * }} props
 * @returns {JSX.Element}
 */
export default function OrdersEmptyState({ title, body, href, actionLabel }) {
  return (
    <div style={emptyStateStyle}>
      <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>📭</div>
      <h3 style={{ marginBottom: '8px', color: 'var(--text-color)' }}>{title}</h3>
      <p style={{ marginBottom: href ? '16px' : 0 }}>{body}</p>
      {href && actionLabel ? (
        <Link href={href} className="btn btn-outline btn-sm">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
