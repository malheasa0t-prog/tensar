/**
 * Reusable section title used across the admin orders screen.
 *
 * @param {{ title: string, subtitle: string }} props
 * @returns {JSX.Element}
 */
export default function AdminOrdersSectionTitle({ title, subtitle }) {
  return (
    <div style={{ display: 'grid', gap: '4px' }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>{subtitle}</p>
    </div>
  );
}
