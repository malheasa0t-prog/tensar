'use client';

/**
 * Orange Money customer deposit page.
 */

import { useEffect, useRef, useState } from 'react';
import DepositHistoryList from '@/components/deposit/DepositHistoryList';
import DepositRequestForm from '@/components/deposit/DepositRequestForm';
import { useToast } from '@/components/ToastProvider';
import {
  acquireSubmissionLock,
  createSubmissionState,
  releaseSubmissionLock,
  resetSubmissionIdempotencyKey,
  resolveSubmissionIdempotencyKey,
} from '@/lib/idempotencyKey';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';
import { validateDepositAmount } from '@/lib/depositPageModel';
import {
  buildOrangeMoneyDepositSuccessMessage,
  createDepositRequest,
  fetchDepositPageSnapshot,
  validateDepositPayerPhone,
  validateOrangeMoneyReferenceId,
} from '@/services/depositPageService';

const DEPOSIT_PAGE_SNAPSHOT_ERROR =
  '[DPG-301] \u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0635\u0641\u062d\u0629 \u0627\u0644\u0625\u064a\u062f\u0627\u0639.';
const DEPOSIT_PAGE_SUBMIT_ERROR =
  '[DPG-302] \u062a\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0625\u064a\u062f\u0627\u0639.';
const DEPOSIT_PAGE_WARNING_TITLE = '\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a';
const DEPOSIT_PAGE_SUCCESS_TITLE = '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628';
const DEPOSIT_PAGE_ERROR_TITLE = '\u062a\u0639\u0630\u0631 \u0627\u0644\u0625\u0631\u0633\u0627\u0644';

/**
 * Prefixes deposit messages with a stable support code when needed.
 *
 * @param {string} code - Stable support code.
 * @param {string} message - User-facing message.
 * @returns {string} Message with a support code.
 */
function withDepositCode(code, message) {
  return String(message || '').startsWith('[') ? message : `[${code}] ${message}`;
}

/**
 * Builds the initial deposit transfer state.
 *
 * @returns {{ bankName: string, accountHolder: string, iban: string, instructions: string }}
 */
function createInitialDepositTransfer() {
  return {
    bankName: '',
    accountHolder: '',
    iban: '',
    instructions: '',
  };
}

/**
 * Renders the Orange Money wallet-deposit page and keeps its history in sync.
 *
 * @returns {JSX.Element}
 */
export default function DepositPage() {
  const { showToast } = useToast();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [deposits, setDeposits] = useState([]);
  const [walletTransferNumber, setWalletTransferNumber] = useState('');
  const [depositTransfer, setDepositTransfer] = useState(createInitialDepositTransfer);
  const successTimerRef = useRef(0);
  const submissionStateRef = useRef(createSubmissionState());

  /**
   * Applies a loaded deposit snapshot to state.
   *
   * @param {{ userId: string, deposits: unknown[], depositTransfer: Record<string, string>, walletTransferNumber: string }} snapshot - Loaded snapshot.
   * @returns {void}
   */
  function applySnapshot(snapshot) {
    setUserId(snapshot.userId);
    setDeposits(snapshot.deposits);
    setDepositTransfer(snapshot.depositTransfer);
    setWalletTransferNumber(snapshot.walletTransferNumber || '');
  }

  useEffect(() => {
    let active = true;
    let cleanup = () => {};

    /**
     * Loads the latest deposit page snapshot into component state.
     *
     * @param {Record<string, unknown>} [client] - Optional Supabase client.
     * @returns {Promise<{ userId: string } | null>} Loaded snapshot or null.
     */
    async function refreshSnapshot(client) {
      try {
        const supabase = client || await loadSupabaseClient();
        const snapshot = await fetchDepositPageSnapshot({ client: supabase });
        if (!active) return null;
        applySnapshot(snapshot);
        return snapshot;
      } catch (snapshotError) {
        if (active) {
          setError(snapshotError instanceof Error ? snapshotError.message : DEPOSIT_PAGE_SNAPSHOT_ERROR);
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
      const supabase = await loadSupabaseClient();
      const snapshot = await refreshSnapshot(supabase);
      if (!active || !snapshot?.userId) return;

      const channel = supabase
        .channel(`deposit-page-${snapshot.userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deposits', filter: `user_id=eq.${snapshot.userId}` }, () => {
          void refreshSnapshot();
        })
        .subscribe();

      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    }

    void initialize();
    return () => {
      active = false;
      cleanup();
      clearTimeout(successTimerRef.current);
    };
  }, []);

  /**
   * Submits a new Orange Money deposit request after local validation.
   *
   * @param {React.FormEvent<HTMLFormElement>} event - Form submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    if (!acquireSubmissionLock(submissionStateRef.current)) {
      return;
    }

    let shouldResetIdempotencyKey = false;

    try {
      setError('');
      setSuccessMessage('');

      const validationError =
        validateDepositAmount(amount)
        || validateDepositPayerPhone(payerPhone)
        || validateOrangeMoneyReferenceId(referenceId);
      if (validationError) {
        setError(validationError);
        showToast(withDepositCode('DPG-101', validationError), {
          type: 'warning',
          title: DEPOSIT_PAGE_WARNING_TITLE,
        });
        return;
      }

      setLoading(true);
      const supabase = await loadSupabaseClient();
      const result = await createDepositRequest({
        client: supabase,
        amount,
        payerPhone,
        referenceId,
        idempotencyKey: resolveSubmissionIdempotencyKey({
          state: submissionStateRef.current,
          fingerprint: JSON.stringify({
            amount: String(amount || ''),
            payerPhone: String(payerPhone || ''),
            referenceId: String(referenceId || ''),
          }),
        }),
      });
      const snapshot = await fetchDepositPageSnapshot({ client: supabase });
      applySnapshot({ ...snapshot, userId: result.userId });
      const nextSuccessMessage = buildOrangeMoneyDepositSuccessMessage(result);
      setSuccessMessage(nextSuccessMessage);
      setAmount('');
      setPayerPhone('');
      setReferenceId('');
      showToast(nextSuccessMessage, {
        type: 'success',
        title: DEPOSIT_PAGE_SUCCESS_TITLE,
      });
      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(''), 5000);
      shouldResetIdempotencyKey = true;
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : DEPOSIT_PAGE_SUBMIT_ERROR;
      setError(nextError);
      showToast(withDepositCode('DPG-302', nextError), {
        type: 'error',
        title: DEPOSIT_PAGE_ERROR_TITLE,
      });
    } finally {
      if (shouldResetIdempotencyKey) {
        resetSubmissionIdempotencyKey(submissionStateRef.current);
      }
      releaseSubmissionLock(submissionStateRef.current);
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
      <DepositRequestForm
        amount={amount}
        depositTransfer={depositTransfer}
        error={error}
        loading={loading}
        onAmountChange={setAmount}
        onPayerPhoneChange={setPayerPhone}
        onReferenceIdChange={setReferenceId}
        onSubmit={handleSubmit}
        payerPhone={payerPhone}
        referenceId={referenceId}
        successMessage={successMessage}
        walletTransferNumber={walletTransferNumber}
      />
      <DepositHistoryList deposits={deposits} userId={userId} />
    </div>
  );
}
