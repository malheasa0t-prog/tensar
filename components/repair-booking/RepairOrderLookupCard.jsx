"use client";

import { useState } from "react";
import AppIcon from "@/components/AppIcon";
import Button from "@/components/Button";
import styles from "./RepairOrderLookupCard.module.css";

const LOOKUP_TYPE_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "repair", label: "الصيانة" },
  { value: "delivery", label: "التوصيل" },
];

/**
 * Renders one detail row in the order lookup result card.
 *
 * @param {{ label: string, value: string }} props
 * @returns {JSX.Element}
 */
function LookupDetailRow({ label, value }) {
  return (
    <div className={styles.resultMetaItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * Renders the resolved order lookup result.
 *
 * @param {{ result: { details: Array<{ label: string, value: string }>, orderNumber: string, requestTypeLabel: string, status: { color: string, label: string }, title: string } }} props
 * @returns {JSX.Element}
 */
function LookupResult({ result }) {
  return (
    <div className={styles.resultCard}>
      <div className={styles.resultHead}>
        <div className={styles.resultCopy}>
          <span className={styles.resultEyebrow}>{result.requestTypeLabel}</span>
          <h3>{result.title}</h3>
          <p>رقم الطلب: {result.orderNumber}</p>
        </div>

        <span className={styles.statusBadge} style={{ "--status-color": result.status.color }}>
          {result.status.label}
        </span>
      </div>

      <div className={styles.resultMeta}>
        {result.details.map((item) => (
          <LookupDetailRow key={`${result.orderNumber}-${item.label}`} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

/**
 * Provides a compact public lookup form for repair and delivery orders.
 *
 * @returns {JSX.Element}
 */
export default function RepairOrderLookupCard() {
  const [lookupType, setLookupType] = useState("all");
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookupType, orderNumber }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setResult(null);
        setError(payload?.error || "تعذر إتمام الاستعلام حالياً.");
        return;
      }

      setResult(payload);
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : "تعذر الاتصال بالخادم حالياً.";
      setResult(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <span className={styles.badge}>
          <AppIcon name="search" size={14} />
          استعلام الطلبات
        </span>
        <h2>تحقق من حالة طلب الصيانة أو التوصيل</h2>
        <p>اكتب رقم الطلب كما وصلك بعد الحجز، ثم اختر النوع المناسب لعرض آخر حالة بشكل مباشر.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>نوع الطلب</span>
            <select value={lookupType} onChange={(event) => setLookupType(event.target.value)} className={styles.input}>
              {LOOKUP_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>رقم الطلب</span>
            <input
              type="text"
              inputMode="text"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="مثال: bk-123456 أو ord-123456"
              className={styles.input}
            />
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          loadingLabel="جاري البحث..."
          fullWidth
          startIcon={<AppIcon name="search" size={16} />}
          className={styles.submitButton}
        >
          استعلام الآن
        </Button>
      </form>

      {error ? <p className={`${styles.feedback} ${styles.feedbackError}`}>{error}</p> : null}
      {result ? <LookupResult result={result} /> : null}
    </section>
  );
}
