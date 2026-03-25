"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";
import { useToast } from "./ToastProvider";
import styles from "./ProductCard.module.css";
import { isOptimizableImageSrc } from "@/lib/imageUtils";

const productPlaceholderImage = "/images/product-placeholder.svg";

export default function ProductCard({ product }) {
  const { addToCart, openSidebar } = useCart();
  const { showToast } = useToast();
  const [isFav, setIsFav] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  const href = product.link || `/products/${product.id}`;
  const image = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : "";
  const finalPrice = Number(product.discountPrice || product.discount_price || product.price || 0);
  const originalPrice = Number(product.price || 0);
  const hasDiscount =
    Number(product.discountPrice || product.discount_price || 0) > 0 &&
    finalPrice < originalPrice;
  const showRealImage = Boolean(image) && !hasImageError;
  const displayImage = showRealImage ? image : productPlaceholderImage;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tz_favorites");
      const parsed = raw ? JSON.parse(raw) : [];
      setIsFav(Array.isArray(parsed) && parsed.includes(product.id));
    } catch {
      setIsFav(false);
    }
  }, [product.id]);

  useEffect(() => {
    setHasImageError(false);
  }, [image, product.id]);

  function handleAdd() {
    addToCart({
      ...product,
      price: finalPrice,
    });
    openSidebar();
    showToast("تمت إضافة المنتج إلى السلة");
  }

  function handleToggleFavorite() {
    try {
      const raw = localStorage.getItem("tz_favorites");
      const parsed = raw ? JSON.parse(raw) : [];
      const current = Array.isArray(parsed) ? parsed : [];
      let next;

      if (current.includes(product.id)) {
        next = current.filter((id) => id !== product.id);
        setIsFav(false);
        showToast("تمت إزالة المنتج من المفضلة");
      } else {
        next = [...current, product.id];
        setIsFav(true);
        showToast("تمت إضافة المنتج إلى المفضلة");
      }

      localStorage.setItem("tz_favorites", JSON.stringify(next));
    } catch {
      showToast("تعذر تحديث المفضلة حاليًا");
    }
  }

  return (
    <article className={styles.card}>
      <Link href={href} className={styles.mediaLink} aria-label={`عرض تفاصيل ${product.name}`}>
        <div className={styles.imageArea}>
          <Image
            src={displayImage}
            alt={showRealImage ? product.name : `صورة افتراضية للمنتج ${product.name}`}
            className={`${styles.image}${showRealImage ? "" : ` ${styles.imagePlaceholder}`}`}
            onError={showRealImage ? () => setHasImageError(true) : undefined}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 280px"
            loading="lazy"
            unoptimized={!isOptimizableImageSrc(displayImage)}
          />

          {product.badge ? <div className={styles.badge}>{product.badge}</div> : null}

          <button
            type="button"
            className={`${styles.favoriteButton}${isFav ? ` ${styles.favoriteButtonActive}` : ""}`}
            title="المفضلة"
            aria-label="إضافة إلى المفضلة"
            onClick={(event) => {
              event.preventDefault();
              handleToggleFavorite();
            }}
          >
            <Heart size={16} fill={isFav ? "currentColor" : "none"} />
          </button>
        </div>
      </Link>

      <div className={styles.body}>
        <span className={styles.category}>{product.category}</span>

        <Link href={href} className={styles.titleLink}>
          <h3 className={styles.title}>{product.name}</h3>
        </Link>

        <p className={styles.description}>
          {product.description || "وصف موجز للمنتج مع أبرز النقاط المهمة."}
        </p>

        <div className={styles.bottom}>
          <div className={styles.priceStack}>
            <span className={styles.price}>
              {finalPrice.toFixed(2)} <small>د.أ</small>
            </span>
            {hasDiscount ? <span className={styles.oldPrice}>{originalPrice.toFixed(2)} د.أ</span> : null}
          </div>

          <div className={styles.actionsRow}>
            <Link href={href} className={styles.ghostLink}>
              التفاصيل
              <ArrowLeft size={15} />
            </Link>

            <button type="button" className={styles.addCartButton} onClick={handleAdd}>
              <ShoppingCart size={15} />
              أضف للسلة
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
