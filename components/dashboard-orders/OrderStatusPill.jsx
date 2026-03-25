/**
 * Displays a colored status badge for an order lifecycle state.
 *
 * @param {{ status: string, map: Record<string, { label: string, color: string, icon: string }> }} props
 * @returns {JSX.Element}
 */
export default function OrderStatusPill({ status, map }) {
  const meta = map[status] || { label: status || 'غير معروف', color: '#666', icon: '•' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 16px',
        borderRadius: '999px',
        fontSize: '0.85rem',
        fontWeight: '700',
        background: `${meta.color}18`,
        color: meta.color,
      }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}
