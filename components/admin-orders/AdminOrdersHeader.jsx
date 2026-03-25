import { ADMIN_ORDER_TABS } from '@/lib/adminOrdersModel';
import { panelStyle } from '@/components/admin-orders/adminOrdersStyles';

/**
 * Header card for the admin orders screen.
 *
 * @param {{
 *   activeTab: string,
 *   onChangeTab: (value: string) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function AdminOrdersHeader({ activeTab, onChangeTab }) {
  return (
    <div
      style={{
        ...panelStyle,
        display: 'flex',
        justifyContent: 'space-between',
        gap: '14px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'grid', gap: '4px' }}>
        <h3 style={{ margin: 0 }}>إدارة الطلبات</h3>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          هنا نتابع طلبات المتجر والطلبات الرقمية من مكان واحد، مع تعديل مباشر للحالة.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {ADMIN_ORDER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChangeTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border:
                activeTab === tab.key
                  ? '2px solid var(--primary)'
                  : '1px solid var(--border-color)',
              background: activeTab === tab.key ? 'var(--primary)' : 'var(--card-bg)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-color)',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
