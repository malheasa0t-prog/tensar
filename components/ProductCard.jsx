"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Check, Heart, RefreshCw, ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";
import { useComparison } from "./ComparisonProvider";
import { useFavorites } from "./FavoritesProvider";
import ProductCardRating from "./ProductCardRating";
import { useToast } from "./ToastProvider";
import AppIcon from "./AppIcon";
import styles from "./ProductCard.module.css";
import enhancedStyles from "./ProductCardEnhancements.module.css";
import { useProductCardStockAlert } from "@/hooks/useProductCardStockAlert";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { formatCurrency } from "@/lib/formatCurrency";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { buildPointerGlowPosition } from "@/lib/interactiveEffectsModel";
import { buildProductCardSnapshot } from "@/lib/productCardModel";
import { buildRevealClassName, getStaggeredRevealDelay, resolveRevealDelay } from "@/lib/scrollRevealModel";

const PRODUCT_PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

function buildCardActionState({ cartFeedbackActive, isOutOfStock, stockAlertActive, stockAlertPending }) {
  if (isOutOfStock) {
    return {
      buttonClassName: `${styles.addCartButton} ${styles.stockAlertButton}${
        stockAlertActive ? ` ${styles.stockAlertButtonActive}` : ""
      }`,
      icon: stockAlertPending ? (
        <RefreshCw size={15} className={styles.buttonSpinner} />
      ) : stockAlertActive ? (
        <Check size={15} />
      ) : (
        <Bell size={15} />
      ),
      label: stockAlertPending
        ? "جاري تفعيل التنبيه"
        : stockAlertActive
          ? "سنخبرك عند التوفر"
          : "نبهني عند التوفر",
    };
  }

  return {
    buttonClassName: `${styles.addCartButton}${cartFeedbackActive ? ` ${styles.addCartButtonSuccess}` : ""}`,
    icon: cartFeedbackActive ? <Check size={15} /> : <ShoppingCart size={15} />,
    label: cartFeedbackActive ? "تمت الإضافة" : "أضف للسلة",
  };
}

export default function ProductCard({ layout = "grid", product, revealIndex = 0 }) {
  const { addToCart, openSidebar } = useCart();
  const { isCompared, toggleCompare } = useComparison();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();
  const { handleRequestStockAlert, isOutOfStock, stockAlertActive, stockAlertPending } =
    useProductCardStockAlert(product);
  const { ref, isVisible } = useScrollReveal({ threshold: 0.16 });
  const cartFeedbackTimeoutRef = useRef(0);
  const favoriteFeedbackTimeoutRef = useRef(0);
  const [cartFeedbackActive, setCartFeedbackActive] = useState(false);
  const [favoriteFeedbackActive, setFavoriteFeedbackActive] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  const href = product.link || `/products/${product.id}`;
  const productName = typeof product?.name === "string" && product.name.trim() ? product.name.trim() : "المنتج";
  const image = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : "";
  const snapshot = buildProductCardSnapshot(product);
  const isFav = isFavorite(product.id);
  const compared = isCompared(product.id);
  const showRealImage = Boolean(image) && !hasImageError;
  const displayImage = showRealImage ? image : PRODUCT_PLACEHOLDER_IMAGE;
  const actionState = buildCardActionState({
    cartFeedbackActive,
    isOutOfStock,
    stockAlertActive,
    stockAlertPending,
  });

  useEffect(() => {
    const current = ref.current;
    if (!current) {
      return;
    }

    current.style.setProperty("--pointer-x", "50%");
    current.style.setProperty("--pointer-y", "55%");
  }, [ref]);

  useEffect(() => {
    setHasImageError(false);
  }, [image, product.id]);

  useEffect(() => {
    return () => {
      window.clearTimeout(cartFeedbackTimeoutRef.current);
      window.clearTimeout(favoriteFeedbackTimeoutRef.current);
    };
  }, []);

  function triggerCartFeedback() {
    window.clearTimeout(cartFeedbackTimeoutRef.current);
    setCartFeedbackActive(true);
    cartFeedbackTimeoutRef.current = window.setTimeout(() => setCartFeedbackActive(false), 900);
  }

  function triggerFavoriteFeedback() {
    window.clearTimeout(favoriteFeedbackTimeoutRef.current);
    setFavoriteFeedbackActive(true);
    favoriteFeedbackTimeoutRef.current = window.setTimeout(() => setFavoriteFeedbackActive(false), 650);
  }

  function handleAdd() {
    const result = addToCart({
      ...product,
      originalPrice: snapshot.originalPrice,
      price: snapshot.finalPrice,
    });

    if (!result?.ok) {
      showToast(result?.message || "تعذر إضافة المنتج حالياً", { type: "error" });
      return;
    }

    triggerCartFeedback();
    openSidebar();
    showToast("تمت إضافة المنتج إلى السلة", { type: "success" });
  }

  function handleToggleFavorite() {
    const result = toggleFavorite(product.id);
    if (result.isFavorite) {
      triggerFavoriteFeedback();
    }

    showToast(
      result.isFavorite ? "تمت إضافة المنتج إلى المفضلة" : "تمت إزالة المنتج من المفضلة",
      { type: "success" }
    );
  }

  function handleToggleCompare() {
    const result = toggleCompare({
      badge: product.badge,
      category: product.category,
      description: snapshot.description,
      href,
      id: product.id,
      image: showRealImage ? image : "",
      name: productName,
      originalPrice: snapshot.originalPrice,
      price: snapshot.finalPrice,
      quantity: snapshot.availableQuantity,
      rating: snapshot.ratingValue,
      reviewCount: snapshot.reviewCount,
    });

    if (result.isAtLimit) {
      showToast("يمكنك مقارنة أربعة منتجات كحد أقصى في نفس الوقت.", { type: "warning" });
      return;
    }

    showToast(result.isCompared ? "تمت إضافة المنتج إلى المقارنة" : "تمت إزالة المنتج من المقارنة", {
      type: "info",
    });
  }

  function handlePointerMove(event) {
    const position = buildPointerGlowPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: event.currentTarget.getBoundingClientRect(),
    });

    event.currentTarget.style.setProperty("--pointer-x", position.x);
    event.currentTarget.style.setProperty("--pointer-y", position.y);
  }

  function handlePointerLeave(event) {
    event.currentTarget.style.setProperty("--pointer-x", "50%");
    event.currentTarget.style.setProperty("--pointer-y", "55%");
  }

  return (
    <article
      ref={ref}
      className={buildRevealClassName(
        `${styles.card} ${layout === "list" ? styles.cardList : ""} ${enhancedStyles.cardInteractive} ${enhancedStyles.cardStagger} ${
          layout === "list" ? enhancedStyles.cardListInteractive : ""
        }`,
        "fade-up",
        isVisible
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ "--reveal-delay": resolveRevealDelay(getStaggeredRevealDelay(revealIndex)) }}
    >
      <div className={enhancedStyles.mediaShell}>
        <Link href={href} className={styles.mediaLink} aria-label={`عرض تفاصيل ${productName}`}>
          <div className={styles.imageArea}>
            <Image
              src={displayImage}
              alt={showRealImage ? productName : `صورة افتراضية للمنتج ${productName}`}
              className={`${styles.image}${showRealImage ? "" : ` ${styles.imagePlaceholder}`}`}
              width={720}
              height={900}
              sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 280px"
              quality={80}
              loading="lazy"
              onError={showRealImage ? () => setHasImageError(true) : undefined}
              unoptimized={!isOptimizableImageSrc(displayImage)}
            />
          </div>
        </Link>

        {snapshot.hasDiscount ? <div className={enhancedStyles.discountRibbon}>خصم {snapshot.discountPercentage}%</div> : null}

        <button
          type="button"
          className={`${enhancedStyles.compareButton}${compared ? ` ${enhancedStyles.compareButtonActive}` : ""}`}
          title="المقارنة"
          aria-label="إضافة إلى المقارنة"
          onClick={handleToggleCompare}
        >
          <AppIcon name="compare" size={15} />
        </button>

        <button
          type="button"
          className={`${styles.favoriteButton}${isFav ? ` ${styles.favoriteButtonActive}` : ""}${
            favoriteFeedbackActive ? ` ${styles.favoriteButtonBurst}` : ""
          }`}
          title="المفضلة"
          aria-label="إضافة إلى المفضلة"
          aria-pressed={isFav}
          onClick={handleToggleFavorite}
        >
          <Heart size={16} fill={isFav ? "currentColor" : "none"} />
          <span className={styles.favoriteParticles} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div className={styles.body}>
        {product.category || product.badge ? (
          <div className={enhancedStyles.metaRow}>
            {product.category ? <span className={styles.category}>{product.category}</span> : null}
            {product.badge ? <span className={enhancedStyles.brandBadge}>{product.badge}</span> : null}
          </div>
        ) : null}

        <Link href={href} className={styles.titleLink}>
          <h3 className={styles.title}>{productName}</h3>
        </Link>

        <ProductCardRating
          filledStars={snapshot.filledStars}
          ratingValue={snapshot.ratingValue}
          reviewCount={snapshot.reviewCount}
        />

        {snapshot.description ? <p className={styles.description}>{snapshot.description}</p> : null}
        {snapshot.urgencyLabel ? <p className={enhancedStyles.urgency}>{snapshot.urgencyLabel}</p> : null}

        <div className={styles.bottom}>
          <div className={styles.priceStack}>
            <span className={styles.price}>{formatCurrency(snapshot.finalPrice)}</span>
            {snapshot.hasDiscount ? <span className={styles.oldPrice}>{formatCurrency(snapshot.originalPrice)}</span> : null}
          </div>

          <div className={styles.actionsRow}>
            <Link href={href} className={styles.ghostLink}>
              التفاصيل
              <ArrowRight size={15} />
            </Link>

            <button
              type="button"
              className={actionState.buttonClassName}
              disabled={isOutOfStock ? stockAlertPending || stockAlertActive : false}
              onClick={isOutOfStock ? handleRequestStockAlert : handleAdd}
            >
              {actionState.icon}
              {actionState.label}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
