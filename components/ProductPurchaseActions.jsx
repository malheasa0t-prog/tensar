"use client";

import { ArrowLeft, ShoppingCart } from "lucide-react";
import Button from "./Button";
import { useCart } from "./CartProvider";
import { useToast } from "./ToastProvider";

export default function ProductPurchaseActions({ product }) {
  const { addToCart, openSidebar } = useCart();
  const { showToast } = useToast();

  function handleAddToCart() {
    addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.discount_price || product.price || 0),
      category: product.categoryName || "منتجات",
      description: product.description || "",
      icon: product.icon || "package",
      badge: product.brand || "",
      images: product.images || [],
    });
    openSidebar();
    showToast("تمت إضافة المنتج إلى السلة");
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
        href="/products"
        variant="ghost"
        endIcon={<ArrowLeft size={16} />}
      >
        العودة إلى المنتجات
      </Button>
    </div>
  );
}
