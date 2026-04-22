import { panelStyle } from '@/components/dashboard-orders/dashboardOrdersStyles';

/**
 * Renders the dashboard intro and top-level order counters.
 *
 * @param {{
 *   profile: { full_name?: string } | null,
 *   stats: { total: number, products: number, repairs: number },
 * }} props
 * @returns {JSX.Element}
 */
export default function DashboardOrdersOverview({ profile, stats }) {
  return (
    <div style={panelStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>📋 مركز الطلبات</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            {profile?.full_name ? `مرحبًا ${profile.full_name}،` : 'هنا'} تجد طلبات المنتجات وحجوزات الصيانة في مكان واحد.
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          تظهر حجوزات الصيانة المرتبطة بحسابك أو بنفس رقم الهاتف المستخدم أثناء الحجز.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ background: 'var(--bg-lighter)', borderRadius: '14px', padding: '14px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إجمالي السجلات</div>
          <strong style={{ fontSize: '1.45rem' }}>{stats.total}</strong>
        </div>
        <div style={{ background: 'var(--bg-lighter)', borderRadius: '14px', padding: '14px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>طلبات المنتجات</div>
          <strong style={{ fontSize: '1.45rem' }}>{stats.products}</strong>
        </div>
        <div style={{ background: 'var(--bg-lighter)', borderRadius: '14px', padding: '14px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>حجوزات الصيانة</div>
          <strong style={{ fontSize: '1.45rem' }}>{stats.repairs}</strong>
        </div>
      </div>
    </div>
  );
}
