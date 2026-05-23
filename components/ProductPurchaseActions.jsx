"use client";

import { ArrowLeft, ShoppingCart } from "lucide-react";
import Button from "./Button";
import { useCart } from "./CartProvider";
import { useToast } from "./ToastProvider";

const CART_ADD_ERROR_MESSAGE = "[CRT-301] تعذر إضافة المنتج حالياً.";

export default function ProductPurchaseActions({ product }) {
  const { addToCart, openSidebar } = useCart();
  const { showToast } = useToast();

  function handleAddToCart() {
    const result = addToCart({
      id: product.id,
      name: product.name,
      originalPrice: Number(product.price || 0),
      price: Number(product.discount_price || product.price || 0),
      category: product.categoryName || "منتجات",
      description: product.description || "",
      icon: product.icon || "package",
      badge: product.brand || "",
      images: product.images || [],
      quantity: product.quantity,
      status: product.status,
    });

    if (!result?.ok) {
      showToast(result?.message || CART_ADD_ERROR_MESSAGE, { type: "error" });
      return;
    }

    openSidebar();
    showToast("تمت إضافة المنتج إلى السلة", { type: "success" });
  }

  return (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      <Button
        type="button"
        variant="success"
        onClick={handleAddToCart}
        startIcon={<ShoppingCart size={16} />}
      >
        أضف إلى السلة
      </Button>

      <Button
        href="/services"
        variant="ghost"
        endIcon={<ArrowLeft size={16} />}
      >
        العودة إلى المنتجات
      </Button>
    </div>
  );
}
