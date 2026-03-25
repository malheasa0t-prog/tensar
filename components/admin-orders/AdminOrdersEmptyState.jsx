import { panelStyle } from '@/components/admin-orders/adminOrdersStyles';

/**
 * Displays the empty state when the active tab has no matching orders.
 *
 * @returns {JSX.Element}
 */
export default function AdminOrdersEmptyState() {
  return (
    <div
      style={{
        ...panelStyle,
        padding: '30px',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}
    >
      لا توجد طلبات مطابقة لهذا القسم.
    </div>
  );
}
