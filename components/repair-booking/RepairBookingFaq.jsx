import AppIcon from "@/components/AppIcon";
import styles from "./RepairBookingFaq.module.css";

/**
 * Pads the FAQ index for a cleaner visual rhythm.
 *
 * @param {number} index
 * @returns {string}
 */
function formatFaqIndex(index) {
  return String(index + 1).padStart(2, "0");
}

/**
 * Renders the repair FAQ section using a richer intro card and expandable items.
 *
 * @param {{ items?: Array<{ question?: string, answer?: string }> }} props
 * @returns {JSX.Element | null}
 */
export default function RepairBookingFaq({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.introCard}>
        <div className={styles.introHead}>
          <span className={styles.badge}>
            <AppIcon name="message" size={14} />
            الأسئلة الشائعة
          </span>

          <span className={styles.inlineCount}>
            <AppIcon name="info" size={14} />
            {items.length} أسئلة
          </span>
        </div>

        <div className={styles.introCopy}>
          <h2>إجابات سريعة قبل إرسال طلب الصيانة</h2>
          <p>
            هذه أكثر الأسئلة التي يكررها العملاء قبل الحجز، جمعناها هنا بشكل واضح
            ومباشر حتى تختار الخدمة المناسبة بثقة وهدوء.
          </p>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <strong>{items.length}</strong>
            <span>أسئلة أساسية قبل الحجز</span>
          </div>
          <div className={styles.stat}>
            <strong>رد واضح</strong>
            <span>مباشر وسريع قبل الإرسال</span>
          </div>
        </div>
      </div>

      <div className={styles.list}>
        {items.map((item, index) => (
          <details key={item.question || index} className={styles.faqItem} open={index === 0}>
            <summary className={styles.summary}>
              <span className={styles.summaryMeta}>
                <span className={styles.index}>{formatFaqIndex(index)}</span>
                <span className={styles.summaryHint}>اضغط لعرض الإجابة المختصرة</span>
              </span>

              <span className={styles.summaryText}>
                <strong>{item.question || "سؤال شائع"}</strong>
              </span>

              <span className={styles.summaryAside}>
                <span className={styles.iconWrap}>
                  <AppIcon name="chevron-left" size={18} />
                </span>
              </span>
            </summary>

            <div className={styles.answer}>
              <p>{item.answer || "سيتم توضيح التفاصيل المناسبة لك مباشرة بعد مراجعة الطلب."}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
