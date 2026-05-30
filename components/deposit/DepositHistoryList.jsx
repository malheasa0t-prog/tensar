/**
 * Customer deposit history list.
 */

import { DEPOSIT_STATUS_MAP } from '@/lib/depositPageModel';

const cardStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  overflow: 'hidden',
};

/**
 * Returns the Orange Money payer phone saved with a deposit row.
 *
 * @param {Record<string, unknown>} deposit - Deposit row.
 * @returns {string} Stored payer phone or an empty string.
 */
function getDepositPayerPhone(deposit) {
  const metadata = deposit?.metadata && typeof deposit.metadata === 'object' ? deposit.metadata : {};
  return String(metadata.orange_money_payer_phone || '').trim();
}

/**
 * Renders a single previous deposit row.
 *
 * @param {{ deposit: Record<string, unknown> }} props - Deposit row props.
 * @returns {JSX.Element}
 */
function DepositHistoryItem({ deposit }) {
  const payerPhone = getDepositPayerPhone(deposit);

  return (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div>
        <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>
          {Number(deposit.amount || 0).toFixed(2)} د.أ
        </div>
        {payerPhone ? (
          <div dir="ltr" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {payerPhone}
          </div>
        ) : null}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {new Date(deposit.created_at).toLocaleDateString('ar-JO')}
        </div>
      </div>
      <span
        style={{
          padding: '4px 14px',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: '700',
          background: `${DEPOSIT_STATUS_MAP[deposit.status]?.color || '#999'}22`,
          color: DEPOSIT_STATUS_MAP[deposit.status]?.color || '#999',
        }}
      >
        {DEPOSIT_STATUS_MAP[deposit.status]?.label || deposit.status}
      </span>
    </div>
  );
}

/**
 * Renders customer deposit history.
 *
 * @param {{ deposits: Record<string, unknown>[], userId: string }} props - History props.
 * @returns {JSX.Element}
 */
export default function DepositHistoryList({ deposits, userId }) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1.1rem' }}>طلبات الشحن السابقة</h3>
      </div>
      {deposits.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {userId ? 'لا توجد طلبات شحن سابقة' : 'سجل الدخول لعرض طلبات الإيداع السابقة'}
        </div>
      ) : (
        <div>
          {deposits.map((deposit) => (
            <DepositHistoryItem key={deposit.id} deposit={deposit} />
          ))}
        </div>
      )}
    </div>
  );
}
