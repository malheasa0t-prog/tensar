"use client";

/**
 * Quick Orange Money deposit modal.
 */

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";
import Button from "@/components/Button";
import { useToast } from "@/components/ToastProvider";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import {
  acquireSubmissionLock,
  createSubmissionState,
  releaseSubmissionLock,
  resetSubmissionIdempotencyKey,
  resolveSubmissionIdempotencyKey,
} from "@/lib/idempotencyKey";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  MAX_DEPOSIT_AMOUNT,
  PRESET_DEPOSIT_AMOUNTS,
  validateDepositAmount,
} from "@/lib/depositPageModel";
import {
  buildOrangeMoneyDepositSuccessMessage,
  createDepositRequest,
  validateDepositPayerPhone,
  validateOrangeMoneyReferenceId,
} from "@/services/depositPageService";

const QUICK_DEPOSIT_TEXT = Object.freeze({
  amountLabel: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0628\u0644\u063a (\u062f.\u0623)",
  closeLabel: "\u0625\u063a\u0644\u0627\u0642",
  currency: "\u062f.\u0623",
  customAmountPlaceholder: "\u0623\u0648 \u0623\u062f\u062e\u0644 \u0645\u0628\u0644\u063a\u064b\u0627 \u0645\u062e\u0635\u0635\u064b\u0627",
  fallbackError: "\u062a\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628.",
  limitPrefix: "\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649:",
  loadingLabel: "\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0631\u0633\u0627\u0644...",
  payerPhoneHelp:
    "\u0623\u062f\u062e\u0644 \u0646\u0641\u0633 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0630\u064a \u0633\u064a\u0638\u0647\u0631 \u0641\u064a \u0631\u0633\u0627\u0644\u0629 Orange Money \u062d\u062a\u0649 \u062a\u062a\u0645 \u0645\u0637\u0627\u0628\u0642\u0629 \u0637\u0644\u0628\u0643 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627.",
  payerPhoneLabel: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641 \u0627\u0644\u0630\u064a \u062a\u0645 \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0645\u0646\u0647",
  referenceHelp:
    "\u0627\u0645\u0644\u0623 \u0647\u0630\u0627 \u0627\u0644\u062d\u0642\u0644 \u0641\u0642\u0637 \u0625\u0630\u0627 \u0643\u0646\u062a \u0642\u062f \u062d\u0648\u0644\u062a \u0645\u0633\u0628\u0642\u064b\u0627 \u0648\u062a\u0631\u064a\u062f \u0631\u0628\u0637 \u0627\u0644\u062d\u0648\u0627\u0644\u0629 \u0641\u0648\u0631\u064b\u0627. \u0628\u062f\u0648\u0646 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062c\u0639\u064a \u0633\u064a\u0628\u0642\u0649 \u0627\u0644\u0637\u0644\u0628 \u0645\u0639\u0644\u0642\u064b\u0627 \u062d\u062a\u0649 \u062a\u0635\u0644 \u0631\u0633\u0627\u0644\u0629 Orange Money \u0627\u0644\u062c\u062f\u064a\u062f\u0629.",
  referenceLabel:
    "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062c\u0639\u064a \u0645\u0646 \u0631\u0633\u0627\u0644\u0629 Orange Money (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)",
  submitButton: "\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0634\u062d\u0646",
  successTitle: "\u062a\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",
  title: "\u0634\u062d\u0646 \u0631\u0635\u064a\u062f \u0633\u0631\u064a\u0639",
});

const MODAL_OVERLAY_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  animation: "fadeIn 0.2s ease",
};

const MODAL_CARD_STYLE = {
  background: "var(--card-bg)",
  border: "1px solid var(--border-color)",
  borderRadius: "22px",
  width: "min(440px, 92vw)",
  maxHeight: "88vh",
  overflow: "auto",
  boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
  animation: "slideUp 0.25s ease",
};

const HEADER_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 22px",
  borderBottom: "1px solid var(--border-color)",
};

const BODY_STYLE = {
  padding: "22px",
};

const PRESET_BTN_BASE = {
  padding: "9px 18px",
  borderRadius: "12px",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "0.88rem",
  transition: "all 0.15s ease",
};

const INPUT_STYLE = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
  background: "var(--bg-lighter)",
  color: "var(--text-color)",
  fontSize: "1rem",
  outline: "none",
};

const FEEDBACK_BASE = {
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "14px",
  textAlign: "center",
  fontSize: "0.9rem",
  fontWeight: "600",
};

/**
 * Renders one selectable amount button.
 *
 * @param {{ amount: string, preset: number, onSelect: (value: string) => void }} props - Button props.
 * @returns {JSX.Element}
 */
function PresetAmountButton({ amount, preset, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(String(preset))}
      style={{
        ...PRESET_BTN_BASE,
        border: amount === String(preset) ? "2px solid var(--primary)" : "1px solid var(--border-color)",
        background: amount === String(preset) ? "var(--primary)" : "var(--bg-lighter)",
        color: amount === String(preset) ? "#fff" : "var(--text-color)",
      }}
    >
      {preset} {QUICK_DEPOSIT_TEXT.currency}
    </button>
  );
}

/**
 * Quick deposit modal triggered from the header wallet badge.
 *
 * @param {{ onClose: () => void }} props - Modal props.
 * @returns {JSX.Element}
 */
export default function QuickDepositModal({ onClose }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeTimerRef = useRef(0);
  const submissionStateRef = useRef(createSubmissionState());
  const { handleKeyDown: handleModalKeyDown } = useModalAccessibility({
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    isOpen: true,
    onClose,
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(closeTimerRef.current);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  /**
   * Handles the deposit form submission.
   *
   * @param {React.FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    if (!acquireSubmissionLock(submissionStateRef.current)) {
      return;
    }

    let shouldResetIdempotencyKey = false;

    try {
      setError("");
      setSuccess("");

      const validationError =
        validateDepositAmount(amount)
        || validateDepositPayerPhone(payerPhone)
        || validateOrangeMoneyReferenceId(referenceId);
      if (validationError) {
        setError(validationError);
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
            amount: String(amount || ""),
            payerPhone: String(payerPhone || ""),
            referenceId: String(referenceId || ""),
          }),
        }),
      });
      const nextSuccessMessage = buildOrangeMoneyDepositSuccessMessage(result);
      setSuccess(nextSuccessMessage);
      setAmount("");
      setPayerPhone("");
      setReferenceId("");
      showToast(nextSuccessMessage, { type: "success", title: QUICK_DEPOSIT_TEXT.successTitle });
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(onClose, 2000);
      shouldResetIdempotencyKey = true;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : QUICK_DEPOSIT_TEXT.fallbackError);
    } finally {
      if (shouldResetIdempotencyKey) {
        resetSubmissionIdempotencyKey(submissionStateRef.current);
      }
      releaseSubmissionLock(submissionStateRef.current);
      setLoading(false);
    }
  }

  return (
    <div style={MODAL_OVERLAY_STYLE} onClick={onClose} role="presentation">
      <div
        style={MODAL_CARD_STYLE}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleModalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-deposit-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div style={HEADER_STYLE}>
          <h3 id="quick-deposit-title" style={{ fontSize: "1.05rem", fontWeight: "700", margin: 0 }}>
            {QUICK_DEPOSIT_TEXT.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={QUICK_DEPOSIT_TEXT.closeLabel}
            ref={closeButtonRef}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
          >
            <AppIcon name="x" size={18} />
          </button>
        </div>

        <div style={BODY_STYLE}>
          {success ? (
            <div style={{ ...FEEDBACK_BASE, background: "rgba(46,204,113,0.1)", border: "1px solid rgba(46,204,113,0.3)", color: "#2ecc71" }}>
              {success}
            </div>
          ) : null}

          {error ? (
            <div style={{ ...FEEDBACK_BASE, background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", color: "#e74c3c" }}>
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", marginBottom: "10px", fontWeight: "600", fontSize: "0.95rem" }}>
              {QUICK_DEPOSIT_TEXT.amountLabel}
            </label>

            <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
              {PRESET_DEPOSIT_AMOUNTS.map((preset) => (
                <PresetAmountButton key={preset} amount={amount} preset={preset} onSelect={setAmount} />
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
              placeholder={QUICK_DEPOSIT_TEXT.customAmountPlaceholder}
              style={{ ...INPUT_STYLE, marginBottom: "6px" }}
            />
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              {`${QUICK_DEPOSIT_TEXT.limitPrefix} ${MAX_DEPOSIT_AMOUNT} ${QUICK_DEPOSIT_TEXT.currency}`}
            </div>

            <label htmlFor="quick_orange_money_phone" style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "0.95rem" }}>
              {QUICK_DEPOSIT_TEXT.payerPhoneLabel}
            </label>
            <input
              id="quick_orange_money_phone"
              type="tel"
              value={payerPhone}
              onChange={(event) => setPayerPhone(event.target.value)}
              required
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0771234567"
              style={{ ...INPUT_STYLE, marginBottom: "8px" }}
            />
            <div style={{ fontSize: "0.85rem", color: "var(--primary)", marginBottom: "18px", lineHeight: "1.7" }}>
              {QUICK_DEPOSIT_TEXT.payerPhoneHelp}
            </div>

            <label htmlFor="quick_orange_money_reference" style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "0.95rem" }}>
              {QUICK_DEPOSIT_TEXT.referenceLabel}
            </label>
            <input
              id="quick_orange_money_reference"
              type="text"
              value={referenceId}
              onChange={(event) => setReferenceId(event.target.value)}
              dir="ltr"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="OJM-123456"
              style={{ ...INPUT_STYLE, marginBottom: "8px" }}
            />
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "18px", lineHeight: "1.7" }}>
              {QUICK_DEPOSIT_TEXT.referenceHelp}
            </div>

            <Button
              type="submit"
              loading={loading}
              loadingLabel={QUICK_DEPOSIT_TEXT.loadingLabel}
              fullWidth
              style={{ width: "100%", padding: "13px", borderRadius: "12px", fontWeight: "700", fontSize: "1rem" }}
            >
              {QUICK_DEPOSIT_TEXT.submitButton}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
