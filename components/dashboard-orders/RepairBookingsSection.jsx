import Link from 'next/link';
import OrdersEmptyState from '@/components/dashboard-orders/OrdersEmptyState';
import OrderStatusPill from '@/components/dashboard-orders/OrderStatusPill';
import {
  orderCardStyle,
  sectionStyle,
} from '@/components/dashboard-orders/dashboardOrdersStyles';
import {
  formatDashboardDate,
  getDashboardRepairModeLabel,
  REPAIR_STATUS_MAP,
} from '@/lib/dashboardOrdersModel';

/**
 * Renders the repair bookings section.
 *
 * @param {{ bookings: Array<Record<string, unknown>> }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingsSection({ bookings }) {
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
        <h3 style={{ margin: 0 }}>🔧 حجوزات الصيانة</h3>
        <Link href="/services" className="btn btn-outline btn-sm">
          احجز صيانة جديدة
        </Link>
      </div>

      {bookings.length === 0 ? (
        <OrdersEmptyState
          title="لا توجد حجوزات صيانة بعد"
          body="ستظهر هنا طلبات الصيانة المرتبطة بحسابك أو برقم الهاتف المستخدم في الحجز."
          href="/services"
          actionLabel="احجز صيانة"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bookings.map((booking) => (
            <div key={booking.id} style={orderCardStyle}>
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
                    {booking.service_name || 'طلب صيانة'}
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
                    <span>📍 {getDashboardRepairModeLabel(booking.mode)}</span>
                    <span>📅 {formatDashboardDate(booking.created_at)}</span>
                    {booking.device ? (
                      <span>
                        🖥️ <strong>{booking.device}</strong>
                      </span>
                    ) : null}
                  </div>
                </div>

                <OrderStatusPill status={booking.status} map={REPAIR_STATUS_MAP} />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '18px',
                  flexWrap: 'wrap',
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                }}
              >
                {booking.phone ? <span>📞 {booking.phone}</span> : null}
                {booking.address ? <span>📍 {booking.address}</span> : null}
              </div>

              {booking.description ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  📝 <strong style={{ color: 'var(--text-color)' }}>وصف المشكلة:</strong> {booking.description}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
