import Link from 'next/link';
import OrdersEmptyState from '@/components/dashboard-orders/OrdersEmptyState';
import OrderStatusPill from '@/components/dashboard-orders/OrderStatusPill';
import {
  orderCardStyle,
  sectionStyle,
} from '@/components/dashboard-orders/dashboardOrdersStyles';
import {
  formatDashboardDate,
  formatDashboardMoney,
  getDashboardDeliveryLabel,
  getDashboardPaymentLabel,
  PRODUCT_STATUS_MAP,
} from '@/lib/dashboardOrdersModel';

/**
 * Renders the product orders section with nested order items.
 *
 * @param {{
 *   orders: Array<Record<string, unknown>>,
 *   orderItemsMap: Record<string, Array<Record<string, unknown>>>,
 * }} props
 * @returns {JSX.Element}
 */
export default function ProductOrdersSection({ orders, orderItemsMap }) {
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
        <h3 style={{ margin: 0 }}>🛍️ طلبات المنتجات</h3>
        <Link href="/products" className="btn btn-outline btn-sm">
          شراء منتج جديد
        </Link>
      </div>

      {orders.length === 0 ? (
        <OrdersEmptyState
          title="لا توجد طلبات منتجات بعد"
          body="عندما تشتري قطعة أو اكسسوار سيظهر الطلب هنا مع حالته وتفاصيله."
          href="/products"
          actionLabel="تصفح المنتجات"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map((order) => {
            const items = orderItemsMap[order.id] || [];

            return (
              <div key={order.id} style={{ ...orderCardStyle, gap: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '6px' }}>
                      طلب منتج #{String(order.id || '').slice(-8)}
                    </h4>
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>📅 {formatDashboardDate(order.created_at)}</span>
                      <span>🚚 {getDashboardDeliveryLabel(order.delivery_method)}</span>
                      <span>💳 {getDashboardPaymentLabel(order.payment_method)}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <OrderStatusPill status={order.status} map={PRODUCT_STATUS_MAP} />
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

                {items.length > 0 ? (
                  <div
                    style={{
                      background: 'var(--bg-lighter)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    <strong style={{ fontSize: '0.92rem' }}>محتويات الطلب</strong>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px',
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span>
                          {item.product_name} × {item.qty}
                        </span>
                        <strong style={{ color: 'var(--text-color)' }}>
                          {formatDashboardMoney(Number(item.price || 0) * Number(item.qty || 1))}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : null}

                {order.notes ? (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    📝 <strong style={{ color: 'var(--text-color)' }}>ملاحظاتك:</strong> {order.notes}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
