import styles from "./RepairBookingForm.module.css";

/**
 * Renders a compact repair form heading without step cards or extra guidance blocks.
 *
 * @param {{ isAccountPrefilled: boolean }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingHeader({ isAccountPrefilled }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <div className={styles.headerCopy}>
          <h3 className={styles.formTitle}>احجز الصيانة</h3>
          <p className={styles.formSubtitle}>املأ البيانات التالية ثم أرسل الطلب.</p>
        </div>

        {isAccountPrefilled ? (
          <span className={styles.prefillBadge}>تم تعبئة الاسم ورقم الهاتف من حسابك</span>
        ) : null}
      </div>
    </header>
  );
}
