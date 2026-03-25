import {
  ADMIN_PRODUCT_STATUSES,
  formatAdminOrderDateTime,
  formatAdminOrderMoney,
} from '@/lib/adminOrdersModel';
import { cardStyle, nestedPanelStyle } from '@/components/admin-orders/adminOrdersStyles';
import AdminOrdersSectionTitle from '@/components/admin-orders/AdminOrdersSectionTitle';

/**
 * Lists product orders with inline status editing.
 *
 * @param {{
 *   orders: Array<Record<string, unknown>>,
 *   draftStatus: Record<string, string>,
 *   savingKey: string,
 *   onDraftChange: React.Dispatch<React.SetStateAction<Record<string, string>>>,
 *   onSaveStatus: (orderType: string, id: string, currentStatus: string) => Promise<void>,
 * }} props
 * @returns {JSX.Element | null}
 */
export default function AdminProductOrdersSection({
  orders,
  draftStatus,
  savingKey,
  onDraftChange,
  onSaveStatus,
}) {
  if (!orders.length) {
    return null;
  }

  return (
    <section style={{ display: 'grid', gap: '12px' }}>
      <AdminOrdersSectionTitle
        title="طلبات المتجر"
        subtitle="طلبات الاكسسوارات والقطع مع بيانات العميل ومحتويات السلة."
      />

      {orders.map((order) => {
        const key = `product:${order.id}`;
        const currentStatus = draftStatus[key] || order.status;

        return (
          <div key={order.id} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>
                  {order.customer_display_name || order.customer_name || 'عميل'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {order.customer_phone_display || order.customer_phone || '-'}
                  {order.customer_email ? ` • ${order.customer_email}` : ''}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                  {formatAdminOrderDateTime(order.created_at)}
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  {formatAdminOrderMoney(order.total)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  #{String(order.id || '').slice(-8)}
                </div>
              </div>
            </div>

            {(order.items || []).length > 0 ? (
              <div style={nestedPanelStyle}>
                {(order.items || []).map((item, index) => (
                  <div
                    key={`${item.product_id || index}-${index}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '10px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span>
                      {item.product_name} × {item.qty}
                    </span>
                    <strong>
                      {formatAdminOrderMoney(Number(item.price || 0) * Number(item.qty || 1))}
                    </strong>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={currentStatus}
                onChange={(event) =>
                  onDraftChange((prev) => ({ ...prev, [key]: event.target.value }))
                }
                style={{
                  minWidth: '220px',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-lighter)',
                  color: 'var(--text-color)',
                }}
              >
                {ADMIN_PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => onSaveStatus('product', order.id, order.status)}
                disabled={savingKey === key}
                className="btn btn-primary btn-sm"
              >
                {savingKey === key ? 'جارٍ الحفظ...' : 'حفظ الحالة'}
              </button>

              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {order.delivery_method || '-'} • {order.payment_method || '-'}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
