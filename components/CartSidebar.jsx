"use client";

import Link from "next/link";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useCart } from "./CartProvider";
import AppIcon from "./AppIcon";

export default function CartSidebar() {
  const { items, cartCount, cartTotal, removeFromCart, updateQty, sidebarOpen, closeSidebar } = useCart();

  if (!sidebarOpen) return null;

  return (
    <div className="cart-overlay" onClick={closeSidebar}>
      <div className="cart-sidebar" onClick={(event) => event.stopPropagation()}>
        <div className="cart-sidebar-header">
          <h3>
            <AppIcon name="shopping-cart" size={18} /> سلة التسوق ({cartCount})
          </h3>
          <button className="cart-close-btn" onClick={closeSidebar} aria-label="إغلاق السلة">
            <X size={18} />
          </button>
        </div>

        <div className="cart-sidebar-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <span style={{ fontSize: "3rem", display: "inline-flex" }}>
                <AppIcon name="shopping-cart" size={40} />
              </span>
              <p>السلة فارغة</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-icon">
                  {item.images?.[0] ? (
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                    />
                  ) : (
                    <AppIcon name={item.icon || item.category || "package"} size={18} />
                  )}
                </div>

                <div className="cart-item-info">
                  <h4>{item.name}</h4>
                  <span className="cart-item-price">{item.price} د.أ</span>
                </div>

                <div className="cart-item-actions">
                  <button onClick={() => updateQty(item.id, item.qty - 1)} aria-label="تقليل الكمية">
                    <Minus size={14} />
                  </button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)} aria-label="زيادة الكمية">
                    <Plus size={14} />
                  </button>
                </div>

                <button className="cart-item-remove" onClick={() => removeFromCart(item.id)} aria-label="إزالة المنتج">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 ? (
          <div className="cart-sidebar-footer">
            <div className="cart-total">
              <span>المجموع:</span>
              <strong>{cartTotal.toFixed(2)} د.أ</strong>
            </div>
            <Link
              href="/checkout"
              className="btn btn-solid"
              style={{ width: "100%", display: "inline-flex", justifyContent: "center", textDecoration: "none" }}
              onClick={closeSidebar}
            >
              <AppIcon name="credit-card" size={16} />
              إتمام الشراء
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
