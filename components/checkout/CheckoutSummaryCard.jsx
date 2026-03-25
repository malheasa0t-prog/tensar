import Link from 'next/link';
import AppIcon from '@/components/AppIcon';

/**
 * Displays the current cart summary beside the checkout form.
 *
 * @param {{ items: Array<Record<string, unknown>>, cartTotal: number }} props
 * @returns {JSX.Element}
 */
export default function CheckoutSummaryCard({ items, cartTotal }) {
  return (
    <aside className="surface-card checkout-summary-card">
      <h2 style={{ fontSize: '1.05rem', marginBottom: '0.9rem' }}>ملخص السلة</h2>

      {items.length === 0 ? (
        <div className="empty-state" style={{ paddingInline: 0 }}>
          <div className="empty-state-icon">
            <AppIcon name="shopping-cart" size={28} />
          </div>
          السلة فارغة حالياً.
          <Link href="/products" className="btn btn-ghost btn-sm">
            تصفح المنتجات
          </Link>
        </div>
      ) : (
        <>
          <div className="checkout-line-items">
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '0.92rem',
                  padding: '0.85rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span>
                  {item.name} × {item.qty}
                </span>
                <strong>{(Number(item.price || 0) * item.qty).toFixed(2)} د.أ</strong>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span>الإجمالي</span>
            <span>{Number(cartTotal || 0).toFixed(2)} د.أ</span>
          </div>
        </>
      )}
    </aside>
  );
}
