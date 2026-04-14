"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, X } from "lucide-react";
import AppIcon from "./AppIcon";
import { useCart } from "./CartProvider";
import { useToast } from "./ToastProvider";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { formatCurrency } from "@/lib/formatCurrency";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import styles from "./CartSidebar.module.css";

export default function CartSidebar() {
  const {
    items,
    cartCount,
    cartSavings,
    cartTotal,
    removeFromCart,
    updateQty,
    sidebarOpen,
    closeSidebar,
  } = useCart();
  const { showToast } = useToast();
  const animatedTotal = useAnimatedNumber(cartTotal, 360);
  const animatedSavings = useAnimatedNumber(cartSavings, 340);

  useEffect(() => {
    if (!sidebarOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeSidebar, sidebarOpen]);

  function handleQtyChange(productId, qty) {
    const result = updateQty(productId, qty);

    if (!result?.ok && result?.message) {
      showToast(result.message, { type: "error" });
    }
  }

  if (!sidebarOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeSidebar}>
      <div
        className={styles.sidebar}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="سلة التسوق"
      >
        <div className={styles.header}>
          <h3 className={styles.title}>
            <AppIcon name="shopping-cart" size={18} />
            سلة التسوق ({cartCount})
          </h3>
          <button className={styles.closeButton} onClick={closeSidebar} aria-label="إغلاق السلة">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <AppIcon name="shopping-cart" size={40} />
              </span>
              <p className={styles.emptyText}>السلة فارغة</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemIcon}>
                  {item.images?.[0] ? (
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      width={44}
                      height={44}
                      quality={80}
                      className={styles.itemImage}
                      unoptimized={!isOptimizableImageSrc(item.images[0])}
                    />
                  ) : (
                    <AppIcon name={item.icon || item.category || "package"} size={18} />
                  )}
                </div>

                <div className={styles.itemInfo}>
                  <h4 className={styles.itemName}>{item.name}</h4>
                  <span className={styles.itemPrice}>{formatCurrency(item.price)}</span>
                </div>

                <div className={styles.itemActions}>
                  <button
                    className={styles.qtyButton}
                    onClick={() => handleQtyChange(item.id, item.qty - 1)}
                    aria-label="تقليل الكمية"
                  >
                    <Minus size={14} />
                  </button>
                  <span className={styles.qtyValue}>{item.qty}</span>
                  <button
                    className={styles.qtyButton}
                    onClick={() => handleQtyChange(item.id, item.qty + 1)}
                    aria-label="زيادة الكمية"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  className={styles.removeButton}
                  onClick={() => removeFromCart(item.id)}
                  aria-label="إزالة المنتج"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 ? (
          <div className={styles.footer}>
            {cartSavings > 0 ? (
              <div className={styles.savingsBanner}>
                <AppIcon name="sparkles" size={15} />
                وفّرت {formatCurrency(animatedSavings)}
              </div>
            ) : null}

            <div className={styles.total}>
              <span>المجموع:</span>
              <strong className={styles.totalValue}>{formatCurrency(animatedTotal)}</strong>
            </div>
            <Link href="/checkout" className={`btn btn-solid ${styles.checkoutLink}`} onClick={closeSidebar}>
              <AppIcon name="credit-card" size={16} />
              إتمام الشراء
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
