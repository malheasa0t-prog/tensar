/**
 * Customer Orange Money deposit request form.
 */

import Button from '@/components/Button';
import { hasDepositTransferDetails } from '@/lib/contactChannels/depositTransfer';
import {
  MAX_DEPOSIT_AMOUNT,
  MISSING_DEPOSIT_TRANSFER_MESSAGE,
  PRESET_DEPOSIT_AMOUNTS,
} from '@/lib/depositPageModel';

const cardStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  overflow: 'hidden',
};

const inputStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-lighter)',
  color: 'var(--text-color)',
  fontSize: '1rem',
  marginBottom: '12px',
  outline: 'none',
};

const feedbackBaseStyle = {
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '16px',
  textAlign: 'center',
};

/**
 * Renders Orange Money transfer instructions.
 *
 * @param {{ depositTransfer: Record<string, string>, walletTransferNumber: string }} props - Transfer data.
 * @returns {JSX.Element}
 */
function DepositTransferInstructions({ depositTransfer, walletTransferNumber }) {
  const hasOrangeMoneyWallet = Boolean(walletTransferNumber.trim());
  const isTransferReady = hasOrangeMoneyWallet || hasDepositTransferDetails(depositTransfer);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(0,210,255,0.06))',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '20px',
        border: '1px solid rgba(108,92,231,0.15)',
      }}
    >
      <p style={{ fontWeight: '700', marginBottom: '10px', fontSize: '0.95rem' }}>معلومات التحويل:</p>
      {isTransferReady ? (
        <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
          {hasOrangeMoneyWallet ? (
            <>
              <div>
                رقم محفظة Orange Money:{' '}
                <strong style={{ direction: 'ltr', display: 'inline-block' }}>{walletTransferNumber}</strong>
              </div>
              <div style={{ marginTop: '10px', color: 'var(--text-muted)' }}>
                حوّل نفس المبلغ، ثم أدخل أدناه رقم الهاتف الذي تم التحويل منه. سيتم تأكيد الطلب تلقائيًا عند وصول رسالة Orange Money المطابقة.
              </div>
            </>
          ) : (
            <>
              <div>البنك: <strong>{depositTransfer.bankName}</strong></div>
              <div>اسم الحساب: <strong>{depositTransfer.accountHolder}</strong></div>
              <div>
                رقم الحساب:{' '}
                <strong style={{ direction: 'ltr', display: 'inline-block' }}>{depositTransfer.iban}</strong>
              </div>
            </>
          )}
          {depositTransfer.instructions ? (
            <div style={{ marginTop: '10px', color: 'var(--text-muted)' }}>{depositTransfer.instructions}</div>
          ) : null}
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.8' }}>
          {MISSING_DEPOSIT_TRANSFER_MESSAGE}
        </div>
      )}
    </div>
  );
}

/**
 * Renders preset amount buttons.
 *
 * @param {{ amount: string, onAmountChange: (value: string) => void }} props - Amount control props.
 * @returns {JSX.Element}
 */
function DepositAmountPresets({ amount, onAmountChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
      {PRESET_DEPOSIT_AMOUNTS.map((presetAmount) => (
        <button
          key={presetAmount}
          type="button"
          onClick={() => onAmountChange(String(presetAmount))}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            cursor: 'pointer',
            border: amount === String(presetAmount) ? '2px solid var(--primary)' : '1px solid var(--border-color)',
            background: amount === String(presetAmount) ? 'var(--primary)' : 'var(--bg-lighter)',
            color: amount === String(presetAmount) ? '#fff' : 'var(--text-color)',
            fontWeight: '700',
            fontSize: '0.9rem',
          }}
        >
          {presetAmount} د.أ
        </button>
      ))}
    </div>
  );
}

/**
 * Renders the Orange Money deposit request form.
 *
 * @param {{
 *   amount: string,
 *   depositTransfer: Record<string, string>,
 *   error: string,
 *   loading: boolean,
 *   onAmountChange: (value: string) => void,
 *   onPayerPhoneChange: (value: string) => void,
 *   onReferenceIdChange: (value: string) => void,
 *   onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   payerPhone: string,
 *   referenceId: string,
 *   successMessage: string,
 *   walletTransferNumber: string,
 * }} props - Form props.
 * @returns {JSX.Element}
 */
export default function DepositRequestForm({
  amount,
  depositTransfer,
  error,
  loading,
  onAmountChange,
  onPayerPhoneChange,
  onReferenceIdChange,
  onSubmit,
  payerPhone,
  referenceId,
  successMessage,
  walletTransferNumber,
}) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1.1rem' }}>شحن الرصيد عبر Orange Money</h3>
      </div>
      <div style={{ padding: '24px' }}>
        <DepositTransferInstructions
          depositTransfer={depositTransfer}
          walletTransferNumber={walletTransferNumber}
        />

        {successMessage ? (
          <div style={{ ...feedbackBaseStyle, background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', color: '#2ecc71', fontWeight: '600' }}>
            {successMessage}
          </div>
        ) : null}
        {error ? (
          <div style={{ ...feedbackBaseStyle, background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c' }}>
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>المبلغ (د.أ)</label>
          <DepositAmountPresets amount={amount} onAmountChange={onAmountChange} />

          <input
            type="number"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            min="1"
            max={String(MAX_DEPOSIT_AMOUNT)}
            step="0.01"
            required
            placeholder="أو أدخل مبلغًا مخصصًا"
            style={inputStyle}
          />
          <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            الحد الأقصى لطلب الإيداع الواحد هو {MAX_DEPOSIT_AMOUNT} د.أ.
          </div>

          <label htmlFor="orange_money_payer_phone" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            رقم الهاتف الذي تم التحويل منه
          </label>
          <input
            id="orange_money_payer_phone"
            type="tel"
            value={payerPhone}
            onChange={(event) => onPayerPhoneChange(event.target.value)}
            required
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0771234567"
            style={inputStyle}
          />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.7' }}>
            أدخل نفس الرقم الذي سيظهر في رسالة Orange Money حتى تتم مطابقة طلبك تلقائيًا.
          </div>

          <label htmlFor="orange_money_reference_id" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            الرقم المرجعي من رسالة Orange Money (اختياري)
          </label>
          <input
            id="orange_money_reference_id"
            type="text"
            value={referenceId}
            onChange={(event) => onReferenceIdChange(event.target.value)}
            dir="ltr"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="OJM-123456"
            style={inputStyle}
          />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.7' }}>
            املأ هذا الحقل فقط إذا كنت قد حولت مسبقًا وتريد ربط حوالة محفوظة لدينا فورًا. بدون الرقم المرجعي سيبقى الطلب معلقًا حتى تصل رسالة Orange Money الجديدة.
          </div>

          <Button
            type="submit"
            loading={loading}
            loadingLabel="جاري الإرسال..."
            fullWidth
            style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: '700', fontSize: '1rem' }}
          >
            إرسال طلب الشحن
          </Button>
        </form>
      </div>
    </div>
  );
}
