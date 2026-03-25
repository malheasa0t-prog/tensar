import Link from 'next/link';
import OrdersEmptyState from '@/components/dashboard-orders/OrdersEmptyState';
import OrderStatusPill from '@/components/dashboard-orders/OrderStatusPill';
import {
  orderCardStyle,
  sectionStyle,
} from '@/components/dashboard-orders/dashboardOrdersStyles';
import {
  DIGITAL_STATUS_MAP,
  formatDashboardDate,
  formatDashboardDateTime,
  formatDashboardMoney,
} from '@/lib/dashboardOrdersModel';

/**
 * Renders the digital services orders section.
 *
 * @param {{ orders: Array<Record<string, unknown>> }} props
 * @returns {JSX.Element}
 */
export default function DigitalOrdersSection({ orders }) {
  return (
    <section style={sectionStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ margin: 0 }}>🎮 الشحن والخدمات الرقمية</h3>
        <Link href="/subscriptions" className="btn btn-outline btn-sm">
          تصفح البطاقات والشحن
        </Link>
      </div>

      {orders.length === 0 ? (
        <OrdersEmptyState
          title="لا توجد طلبات رقمية بعد"
          body="هنا ستظهر طلبات شحن الألعاب أو الخدمات الرقمية المرتبطة بالمحفظة."
          href="/subscriptions"
          actionLabel="تصفح البطاقات والشحن"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map((order) => (
            <div key={order.id} style={orderCardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '6px' }}>
                    {order.service_name}
                  </h4>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      📦 الكمية: <strong>{order.quantity}</strong>
                    </span>
                    {order.link ? (
                      <span>
                        🔗{' '}
                        <span style={{ direction: 'ltr', display: 'inline' }}>
                          {String(order.link).slice(0, 40)}...
                        </span>
                      </span>
                    ) : null}
                    <span>📅 {formatDashboardDate(order.created_at)}</span>
                  </div>
                  {order.external_order_id ? (
                    <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      🔗 رقم المزود:{' '}
                      <code
                        style={{
                          background: 'var(--bg-lighter)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {order.external_order_id}
                      </code>
                    </div>
                  ) : null}
                  {order.updated_at ? (
                    <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      آخر تحديث: {formatDashboardDateTime(order.updated_at)}
                    </div>
                  ) : null}
                </div>

                <div style={{ textAlign: 'left' }}>
                  <OrderStatusPill status={order.status} map={DIGITAL_STATUS_MAP} />
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '1.15rem',
                      fontWeight: '800',
                      color: 'var(--primary)',
                    }}
                  >
                    {formatDashboardMoney(order.total)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
