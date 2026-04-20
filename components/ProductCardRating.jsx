import { Star } from "lucide-react";
import enhancedStyles from "./ProductCardEnhancements.module.css";
import { PRODUCT_CARD_TOTAL_STARS } from "@/lib/productCardModel";

/**
 * Renders the star rating summary shown inside a product card.
 *
 * @param {{ filledStars: number, ratingValue: number, reviewCount: number }} props
 * @returns {import("react").JSX.Element}
 */
export default function ProductCardRating({ filledStars, ratingValue, reviewCount }) {
  return (
    <div className={enhancedStyles.ratingRow} aria-label={`التقييم ${ratingValue.toFixed(1)} من 5`}>
      <div className={enhancedStyles.ratingStars} aria-hidden="true">
        {Array.from({ length: PRODUCT_CARD_TOTAL_STARS }, (_, index) => {
          const isActive = index < filledStars;
          const className = isActive
            ? `${enhancedStyles.ratingStar} ${enhancedStyles.ratingStarActive}`
            : enhancedStyles.ratingStar;

          return <Star key={`star-${index}`} size={14} className={className} fill={isActive ? "currentColor" : "none"} />;
        })}
      </div>

      <span className={enhancedStyles.ratingSummary}>
        {ratingValue.toFixed(1)} <small>({reviewCount})</small>
      </span>
    </div>
  );
}
