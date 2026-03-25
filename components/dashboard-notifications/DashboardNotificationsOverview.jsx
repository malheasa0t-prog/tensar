import { panelStyle } from '@/components/dashboard-notifications/dashboardNotificationsStyles';

/**
 * Renders the notifications header, counters, and primary actions.
 *
 * @param {{
 *   stats: { total: number, unread: number, adminBroadcasts: number },
 *   refreshing: boolean,
 *   bulkActionLoading: boolean,
 *   showUnreadOnly: boolean,
 *   onRefresh: () => void,
 *   onMarkAllAsRead: () => void,
 *   onToggleUnreadOnly: (value: boolean) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function DashboardNotificationsOverview({
  stats,
  refreshing,
  bulkActionLoading,
  showUnreadOnly,
  onRefresh,
  onMarkAllAsRead,
  onToggleUnreadOnly,
}) {
  return (
    <div style={panelStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>🔔 مركز الإشعارات</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            هنا تظهر إشعارات الإدارة وتحديثات الطلبات والرصد الخاصة بحسابك.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onRefresh}
            className="btn btn-outline btn-sm"
            disabled={refreshing}
          >
            {refreshing ? '⏳ تحديث...' : 'تحديث'}
          </button>
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="btn btn-primary btn-sm"
            disabled={bulkActionLoading || stats.unread === 0}
          >
            {bulkActionLoading ? '⏳ جاري التنفيذ...' : 'تعليم الكل كمقروء'}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ background: 'var(--bg-lighter)', borderRadius: '14px', padding: '14px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إجمالي الإشعارات</div>
          <strong style={{ fontSize: '1.45rem' }}>{stats.total}</strong>
        </div>
        <div style={{ background: 'var(--bg-lighter)', borderRadius: '14px', padding: '14px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>غير المقروءة</div>
          <strong
            style={{
              fontSize: '1.45rem',
              color: stats.unread > 0 ? 'var(--primary)' : 'var(--text-color)',
            }}
          >
            {stats.unread}
          </strong>
        </div>
        <div style={{ background: 'var(--bg-lighter)', borderRadius: '14px', padding: '14px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>رسائل الإدارة</div>
          <strong style={{ fontSize: '1.45rem' }}>{stats.adminBroadcasts}</strong>
        </div>
      </div>

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          width: 'fit-content',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}
      >
        <input
          type="checkbox"
          checked={showUnreadOnly}
          onChange={(event) => onToggleUnreadOnly(event.target.checked)}
        />
        عرض غير المقروءة فقط
      </label>
    </div>
  );
}
