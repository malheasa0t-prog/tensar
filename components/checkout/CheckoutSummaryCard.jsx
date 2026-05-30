import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import { formatCurrency } from "@/lib/formatCurrency";

/**
 * Displays the current cart summary beside the checkout form.
 *
 * @param {{ items: Array<Record<string, unknown>>, cartTotal: number, shippingFee: number, checkoutTotal: number, couponDiscount?: number, payableTotal?: number }} props - Checkout totals.
 * @returns {JSX.Element} Checkout summary card.
 */
export default function CheckoutSummaryCard({ items, cartTotal, shippingFee, checkoutTotal, couponDiscount = 0, payableTotal }) {
  const hasDiscount = Number(couponDiscount) > 0;
  const finalTotal = typeof payableTotal === "number" ? payableTotal : checkoutTotal;
  return (
    <aside className="surface-card checkout-summary-card">
      <h2 style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>ملخص السلة</h2>

      {items.length === 0 ? (
        <div className="empty-state" style={{ paddingInline: 0 }}>
          <div className="empty-state-icon">
            <AppIcon name="shopping-cart" size={28} />
          </div>
          السلة فارغة حالياً.
          <Link href="/services" className="btn btn-ghost btn-sm">
            تصفح الخدمات
          </Link>
        </div>
      ) : (
        <>
          <div className="checkout-line-items">
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "10px",
                  fontSize: "0.92rem",
                  padding: "0.85rem 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span>
                  {item.name} × {item.qty}
                </span>
                <strong>{formatCurrency(Number(item.price || 0) * item.qty)}</strong>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "1rem",
              color: "var(--text-muted)",
              fontSize: "0.92rem",
            }}
          >
            <span>رسوم التوصيل</span>
            <span>{formatCurrency(shippingFee)}</span>
          </div>

          {hasDiscount ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "0.5rem",
                color: "var(--success, #16a34a)",
                fontSize: "0.92rem",
              }}
            >
              <span>خصم الكوبون</span>
              <span>− {formatCurrency(couponDiscount)}</span>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 800,
              marginTop: "0.85rem",
              paddingTop: "1rem",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span>الإجمالي</span>
            <span>{formatCurrency(finalTotal)}</span>
          </div>
        </>
      )}
    </aside>
  );
}
