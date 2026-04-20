'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { supabase } from '@/lib/supabaseClient';
import { hasDepositTransferDetails } from '@/lib/contactChannels/depositTransfer';
import {
  DEPOSIT_STATUS_MAP,
  MAX_DEPOSIT_AMOUNT,
  MISSING_DEPOSIT_TRANSFER_MESSAGE,
  PRESET_DEPOSIT_AMOUNTS,
  validateDepositAmount,
} from '@/lib/depositPageModel';
import { createDepositRequest, fetchDepositPageSnapshot } from '@/services/depositPageService';

const cardStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  overflow: 'hidden',
};
const feedbackBaseStyle = {
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '16px',
  textAlign: 'center',
};

/**
 * Renders the manual wallet-deposit page and keeps its history in sync.
 *
 * @returns {JSX.Element}
 */
export default function DepositPage() {
  const { showToast } = useToast();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [deposits, setDeposits] = useState([]);
  const [depositTransfer, setDepositTransfer] = useState({
    bankName: '',
    accountHolder: '',
    iban: '',
    instructions: '',
  });

  useEffect(() => {
    let active = true;
    let cleanup = () => {};

    /**
     * Loads the latest deposit page snapshot into component state.
     *
     * @returns {Promise<{ userId: string } | null>}
     */
    async function refreshSnapshot() {
      try {
        const snapshot = await fetchDepositPageSnapshot({ client: supabase });
        if (!active) return null;
        setUserId(snapshot.userId);
        setDeposits(snapshot.deposits);
        setDepositTransfer(snapshot.depositTransfer);
        return snapshot;
      } catch (snapshotError) {
        if (active) {
          setError(snapshotError instanceof Error ? snapshotError.message : 'تعذر تحميل صفحة الإيداع.');
        }
        return null;
      }
    }

    /**
     * Subscribes to realtime deposit updates after the first successful load.
     *
     * @returns {Promise<void>}
     */
    async function initialize() {
      const snapshot = await refreshSnapshot();
      if (!active || !snapshot?.userId) return;

      const channel = supabase
        .channel(`deposit-page-${snapshot.userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'deposits', filter: `user_id=eq.${snapshot.userId}` },
          () => {
            void refreshSnapshot();
          }
        )
        .subscribe();

      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    }

    void initialize();
    return () => {
      active = false;
      cleanup();
    };
  }, []);

  /**
   * Submits a new manual deposit request after validating the amount locally.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const amountValidationError = validateDepositAmount(amount);
    if (amountValidationError) {
      setError(amountValidationError);
      showToast(amountValidationError, { type: 'warning', title: 'تحقق من المبلغ' });
      return;
    }

    setLoading(true);
    try {
      const result = await createDepositRequest({ client: supabase, amount, proofFile });
      const snapshot = await fetchDepositPageSnapshot({ client: supabase });
      setUserId(result.userId);
      setDeposits(snapshot.deposits);
      setDepositTransfer(snapshot.depositTransfer);
      setSuccess(true);
      setAmount('');
      setProofFile(null);
      showToast('تم إرسال طلب الشحن بنجاح وسيتم مراجعته قريبًا.', {
        type: 'success',
        title: 'تم استلام الطلب',
      });
      setTimeout(() => setSuccess(false), 4000);
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : 'تعذر إرسال طلب الإيداع.';
      setError(nextError);
      showToast(nextError, { type: 'error', title: 'تعذر الإرسال' });
    } finally {
      setLoading(false);
    }
  }

  const isTransferReady = hasDepositTransferDetails(depositTransfer);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
      <div style={cardStyle}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem' }}>شحن الرصيد يدويًا</h3>
        </div>
        <div style={{ padding: '24px' }}>
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
                <div>
                  البنك: <strong>{depositTransfer.bankName}</strong>
                </div>
                <div>
                  اسم الحساب: <strong>{depositTransfer.accountHolder}</strong>
                </div>
                <div>
                  رقم الحساب:{' '}
                  <strong style={{ direction: 'ltr', display: 'inline-block' }}>{depositTransfer.iban}</strong>
                </div>
                {depositTransfer.instructions ? (
                  <div style={{ marginTop: '10px', color: 'var(--text-muted)' }}>
                    {depositTransfer.instructions}
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.8' }}>
                {MISSING_DEPOSIT_TRANSFER_MESSAGE}
              </div>
            )}
          </div>

          {success ? (
            <div
              style={{
                ...feedbackBaseStyle,
                background: 'rgba(46,204,113,0.1)',
                border: '1px solid rgba(46,204,113,0.3)',
                color: '#2ecc71',
                fontWeight: '600',
              }}
            >
              تم إرسال طلب الشحن بنجاح، وسيتم مراجعته قريبًا.
            </div>
          ) : null}
          {error ? (
            <div
              style={{
                ...feedbackBaseStyle,
                background: 'rgba(231,76,60,0.1)',
                border: '1px solid rgba(231,76,60,0.3)',
                color: '#e74c3c',
              }}
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>المبلغ (د.أ)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {PRESET_DEPOSIT_AMOUNTS.map((presetAmount) => (
                <button
                  key={presetAmount}
                  type="button"
                  onClick={() => setAmount(String(presetAmount))}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border:
                      amount === String(presetAmount)
                        ? '2px solid var(--primary)'
                        : '1px solid var(--border-color)',
                    background:
                      amount === String(presetAmount) ? 'var(--primary)' : 'var(--bg-lighter)',
                    color: amount === String(presetAmount) ? '#fff' : 'var(--text-color)',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                  }}
                >
                  {presetAmount} د.أ
                </button>
              ))}
            </div>

            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="1"
              max={String(MAX_DEPOSIT_AMOUNT)}
              step="0.01"
              required
              placeholder="أو أدخل مبلغًا مخصصًا"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-lighter)',
                color: 'var(--text-color)',
                fontSize: '1rem',
                marginBottom: '12px',
                outline: 'none',
              }}
            />
            <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              الحد الأقصى لطلب الإيداع الواحد هو {MAX_DEPOSIT_AMOUNT} د.أ.
            </div>

            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              صورة إثبات التحويل
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setProofFile(event.target.files?.[0] || null)}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-lighter)',
                marginBottom: '20px',
              }}
            />

            <Button
              type="submit"
              loading={loading}
              loadingLabel="جاري الإرسال..."
              fullWidth
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '1rem',
              }}
            >
              إرسال طلب الشحن
            </Button>
          </form>
        </div>
      </div>

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
              <div
                key={deposit.id}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
