import {
  ADMIN_DIGITAL_STATUSES,
  formatAdminOrderDateTime,
  formatAdminOrderMoney,
} from '@/lib/adminOrdersModel';
import { cardStyle } from '@/components/admin-orders/adminOrdersStyles';
import AdminOrdersSectionTitle from '@/components/admin-orders/AdminOrdersSectionTitle';

/**
 * Lists digital orders with inline status editing.
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
export default function AdminDigitalOrdersSection({
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
        title="الطلبات الرقمية"
        subtitle="بطاقات الألعاب والشحن والخدمات الرقمية المرتبطة بالمحفظة."
      />

      {orders.map((order) => {
        const key = `digital:${order.id}`;
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
                <div style={{ fontWeight: 800 }}>{order.service_name || 'طلب رقمي'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {order.user_display_name || 'مستخدم'}
                  {order.user_phone ? ` • ${order.user_phone}` : ''}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                  {formatAdminOrderDateTime(order.created_at)}
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  {formatAdminOrderMoney(order.total)}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {order.external_order_id
                    ? `مزود: ${order.external_order_id}`
                    : 'بدون رقم مزود'}
                </div>
              </div>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              الكمية: <strong style={{ color: 'var(--text-color)' }}>{order.quantity || 0}</strong>
              {order.link ? (
                <>
                  {' '}
                  • الرابط/المعرف:{' '}
                  <span style={{ direction: 'ltr', display: 'inline-block' }}>{order.link}</span>
                </>
              ) : null}
            </div>

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
                {ADMIN_DIGITAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => onSaveStatus('digital', order.id, order.status)}
                disabled={savingKey === key}
                className="btn btn-primary btn-sm"
              >
                {savingKey === key ? 'جارٍ الحفظ...' : 'حفظ الحالة'}
              </button>

              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {order.provider_name || 'بدون مزود'}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
