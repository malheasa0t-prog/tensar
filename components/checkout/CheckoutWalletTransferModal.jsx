import { useRef } from "react";
import AppIcon from "@/components/AppIcon";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import styles from "./CheckoutWalletTransferModal.module.css";

/**
 * Displays wallet transfer instructions for manual wallet payments.
 *
 * @param {{
 *   instructions: { amountText: string, walletNumber: string } | null,
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 * @returns {JSX.Element | null}
 */
export default function CheckoutWalletTransferModal({ instructions, isOpen, onClose }) {
  const modalRef = useRef(null);
  const { handleKeyDown } = useModalAccessibility({
    containerRef: modalRef,
    isOpen,
    onClose,
  });

  if (!isOpen || !instructions) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-transfer-title"
      >
        <div className={styles.header}>
          <span className={styles.icon}>
            <AppIcon name="wallet" size={20} />
          </span>
          <div>
            <h3 id="wallet-transfer-title" className={styles.headerTitle}>
              تعليمات التحويل إلى المحفظة
            </h3>
            <p className={styles.headerCopy}>
              حوّل المبلغ التالي إلى رقم المحفظة المعروض قبل تثبيت الطلب.
            </p>
          </div>
        </div>

        <div className={styles.block}>
          <span className={styles.blockLabel}>المبلغ المطلوب</span>
          <strong className={styles.blockValue}>{instructions.amountText}</strong>
        </div>

        <div className={styles.block}>
          <span className={styles.blockLabel}>رقم المحفظة</span>
          <strong className={styles.blockValue} dir="ltr">
            {instructions.walletNumber}
          </strong>
        </div>

        <p className={styles.hint}>
          الرجاء إرسال الحوالة عبر <strong>Orange Money</strong> حصراً.
          بمجرد وصول الحوالة، سيقوم نظامنا بتأكيد طلبك وتحديث حالته <strong>تلقائياً خلال ثوانٍ</strong>.
        </p>

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            فهمت، سأقوم بالتحويل الآن
          </button>
        </div>
      </div>
    </div>
  );
}
