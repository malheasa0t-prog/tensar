"use client";

import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import { useCart } from "@/components/CartProvider";
import { useComparison } from "@/components/ComparisonProvider";
import { useToast } from "@/components/ToastProvider";
import styles from "./ComparePageClient.module.css";

const COMPARISON_ROWS = [
  { key: "category", label: "الفئة", type: "text" },
  { key: "price", label: "السعر الحالي", type: "price" },
  { key: "originalPrice", label: "السعر السابق", type: "price" },
  { key: "rating", label: "التقييم", type: "rating" },
  { key: "quantity", label: "المخزون", type: "quantity" },
  { key: "description", label: "الوصف", type: "description" },
];

function formatCellValue(entry, row) {
  if (row.type === "price") {
    const value = Number(entry[row.key] || 0);
    return value > 0 ? `${value.toFixed(2)} د.أ` : "غير متاح";
  }

  if (row.type === "rating") {
    const rating = Number(entry.rating || 0);
    const reviews = Number(entry.reviewCount || 0);
    return rating > 0 ? `${rating.toFixed(1)} / 5${reviews > 0 ? ` (${reviews})` : ""}` : "بدون تقييم";
  }

  if (row.type === "quantity") {
    const quantity = Number(entry.quantity || 0);
    return quantity > 0 ? `${quantity} قطعة` : "حسب الطلب";
  }

  return String(entry[row.key] || "—").trim() || "—";
}

export default function ComparePageClient() {
  const { addToCart, openSidebar } = useCart();
  const { clearComparison, comparisonCount, comparisonEntries, removeComparison } = useComparison();
  const { showToast } = useToast();

  function handleAddToCart(entry) {
    const result = addToCart({
      badge: entry.badge,
      category: entry.category,
      description: entry.description,
      icon: entry.category || "package",
      id: entry.id,
      images: entry.image ? [entry.image] : [],
      name: entry.name,
      originalPrice: entry.originalPrice,
      price: entry.price,
      quantity: entry.quantity,
    });

    if (!result?.ok) {
      showToast(result?.message || "تعذر إضافة المنتج حالياً", { type: "error" });
      return;
    }

    openSidebar();
    showToast("تمت إضافة المنتج إلى السلة", { type: "success" });
  }

  if (comparisonCount === 0) {
    return (
      <section className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <AppIcon name="compare" size={34} />
        </div>
        <h2>لا توجد منتجات للمقارنة حالياً</h2>
        <p>ابدأ من الكتالوج وأضف منتجين أو أكثر عبر زر المقارنة داخل البطاقة.</p>
        <Link href="/products" className={styles.primaryButton}>
          تصفح المنتجات
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>جدول المقارنة</span>
          <h2>قارن بين المنتجات جنباً إلى جنب</h2>
          <p>راجع الأسعار والتقييمات والوصف قبل اتخاذ قرار الشراء.</p>
        </div>

        <button type="button" className={styles.clearButton} onClick={clearComparison}>
          مسح الكل
        </button>
      </div>

      <div className={styles.cardsGrid}>
        {comparisonEntries.map((entry) => (
          <article key={entry.id} className={styles.productCard}>
            <div className={styles.productHead}>
              <div>
                <strong>{entry.name}</strong>
                <span>{entry.badge || entry.category || "منتج تقني"}</span>
              </div>
              <button type="button" className={styles.removeButton} onClick={() => removeComparison(entry.id)}>
                <AppIcon name="x" size={15} />
              </button>
            </div>

            <div className={styles.productActions}>
              <button type="button" className={styles.primaryButton} onClick={() => handleAddToCart(entry)}>
                <AppIcon name="shopping-cart" size={15} />
                أضف للسلة
              </button>
              <Link href={entry.href} className={styles.secondaryButton}>
                عرض المنتج
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.tableShell}>
        <div className={styles.table}>
          <div className={styles.tableLabels}>
            {COMPARISON_ROWS.map((row) => (
              <div key={row.key} className={styles.labelCell}>
                {row.label}
              </div>
            ))}
          </div>

          {comparisonEntries.map((entry) => (
            <div key={entry.id} className={styles.tableColumn}>
              {COMPARISON_ROWS.map((row) => (
                <div key={`${entry.id}-${row.key}`} className={styles.valueCell}>
                  {formatCellValue(entry, row)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
