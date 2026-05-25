"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";
import Button from "@/components/Button";
import { useToast } from "@/components/ToastProvider";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import {
  MAX_DEPOSIT_AMOUNT,
  PRESET_DEPOSIT_AMOUNTS,
  validateDepositAmount,
} from "@/lib/depositPageModel";
import { createDepositRequest } from "@/services/depositPageService";

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
 * Quick deposit modal triggered from the header wallet badge.
 *
 * @param {{ onClose: () => void }} props
 * @returns {JSX.Element}
 */
export default function QuickDepositModal({ onClose }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
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
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  /**
   * Handles the deposit form submission.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateDepositAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!proofFile) {
      setError("يجب رفع صورة إثبات التحويل.");
      return;
    }

    setLoading(true);
    try {
      const supabase = await loadSupabaseClient();
      await createDepositRequest({ client: supabase, amount, proofFile });
      setSuccess("تم إرسال طلب الشحن بنجاح وسيتم مراجعته قريبًا ✅");
      setAmount("");
      setProofFile(null);
      showToast("تم إرسال طلب الشحن بنجاح", { type: "success", title: "تم الإرسال" });
      setTimeout(onClose, 2000);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "تعذر إرسال الطلب";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={MODAL_OVERLAY_STYLE} onClick={onClose} role="presentation">
      <div
        style={MODAL_CARD_STYLE}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleModalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-deposit-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div style={HEADER_STYLE}>
          <h3
            id="quick-deposit-title"
            style={{ fontSize: "1.05rem", fontWeight: "700", margin: 0 }}
          >
            💰 إيداع رصيد سريع
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            ref={closeButtonRef}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
            }}
          >
            <AppIcon name="x" size={18} />
          </button>
        </div>

        <div style={BODY_STYLE}>
          {success ? (
            <div
              style={{
                ...FEEDBACK_BASE,
                background: "rgba(46,204,113,0.1)",
                border: "1px solid rgba(46,204,113,0.3)",
                color: "#2ecc71",
              }}
            >
              {success}
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                ...FEEDBACK_BASE,
                background: "rgba(231,76,60,0.1)",
                border: "1px solid rgba(231,76,60,0.3)",
                color: "#e74c3c",
              }}
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <label
              style={{
                display: "block",
                marginBottom: "10px",
                fontWeight: "600",
                fontSize: "0.95rem",
              }}
            >
              اختر المبلغ (د.أ)
            </label>

            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "14px",
                flexWrap: "wrap",
              }}
            >
              {PRESET_DEPOSIT_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  style={{
                    ...PRESET_BTN_BASE,
                    border:
                      amount === String(preset)
                        ? "2px solid var(--primary)"
                        : "1px solid var(--border-color)",
                    background:
                      amount === String(preset) ? "var(--primary)" : "var(--bg-lighter)",
                    color: amount === String(preset) ? "#fff" : "var(--text-color)",
                  }}
                >
                  {preset} د.أ
                </button>
              ))}
            </div>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max={String(MAX_DEPOSIT_AMOUNT)}
              step="0.01"
              required
              placeholder="أو أدخل مبلغًا مخصصًا"
              style={{ ...INPUT_STYLE, marginBottom: "6px" }}
            />
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: "16px",
              }}
            >
              الحد الأقصى: {MAX_DEPOSIT_AMOUNT} د.أ
            </div>

            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "0.95rem",
              }}
            >
              صورة إثبات التحويل <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              style={{
                display: "block",
                width: "100%",
                padding: "11px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-lighter)",
                marginBottom: "18px",
                fontSize: "0.88rem",
              }}
            />

            <Button
              type="submit"
              loading={loading}
              loadingLabel="جاري الإرسال..."
              fullWidth
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "12px",
                fontWeight: "700",
                fontSize: "1rem",
              }}
            >
              إرسال طلب الشحن
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
