/**
 * Reusable alert box for profile feedback messages.
 *
 * @param {{ message: string, tone: 'success' | 'error' }} props
 * @returns {JSX.Element | null}
 */
export default function ProfileAlert({ message, tone }) {
  if (!message) {
    return null;
  }

  const successTone = tone === 'success';

  return (
    <div
      style={{
        background: successTone ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)',
        border: successTone
          ? '1px solid rgba(46,204,113,0.3)'
          : '1px solid rgba(231,76,60,0.3)',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '16px',
        color: successTone ? '#2ecc71' : '#e74c3c',
        textAlign: 'center',
        fontWeight: '600',
      }}
    >
      {successTone ? '✅ ' : '⚠️ '}
      {message}
    </div>
  );
}
