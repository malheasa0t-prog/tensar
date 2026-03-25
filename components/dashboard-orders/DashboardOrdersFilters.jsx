import { DASHBOARD_ORDER_FILTERS } from '@/lib/dashboardOrdersModel';

/**
 * Renders the section tabs used to switch between order types.
 *
 * @param {{
 *   activeFilter: string,
 *   onChange: (value: string) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function DashboardOrdersFilters({ activeFilter, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {DASHBOARD_ORDER_FILTERS.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onChange(filter.key)}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            cursor: 'pointer',
            border:
              activeFilter === filter.key
                ? '2px solid var(--primary)'
                : '1px solid var(--border-color)',
            background: activeFilter === filter.key ? 'var(--primary)' : 'var(--card-bg)',
            color: activeFilter === filter.key ? '#fff' : 'var(--text-color)',
            fontWeight: '600',
            fontSize: '0.85rem',
          }}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
