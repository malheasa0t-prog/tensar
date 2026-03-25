export const panelStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  padding: '22px 24px',
  display: 'grid',
  gap: '16px',
};

/**
 * Builds the alert box style used above the notifications center.
 *
 * @param {'error' | 'success'} tone
 * @returns {Record<string, string>}
 */
export function buildAlertStyle(tone) {
  if (tone === 'success') {
    return {
      background: 'rgba(46,204,113,0.12)',
      border: '1px solid rgba(46,204,113,0.26)',
      color: '#2ecc71',
    };
  }

  return {
    background: 'rgba(231,76,60,0.12)',
    border: '1px solid rgba(231,76,60,0.26)',
    color: '#e74c3c',
  };
}

export const emptyStateStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '18px',
  padding: '38px 24px',
  textAlign: 'center',
  color: 'var(--text-muted)',
};
