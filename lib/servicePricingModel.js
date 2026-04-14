/**
 * Derived pricing tiers used by the repair services listing.
 */

const ADVANCED_TIER_MULTIPLIER = 1.55;
const COMPLETE_TIER_MULTIPLIER = 2.2;

const BASIC_FEATURES = Object.freeze([
  [true, true, true],
  [true, true, true],
  [false, true, true],
  [false, false, true],
]);

const TIER_BLUEPRINTS = Object.freeze([
  {
    ctaLabel: "ابدأ بالأساسي",
    helper: "للأعطال الخفيفة والتشخيص المباشر",
    isPopular: false,
    key: "basic",
    label: "أساسي",
    multiplier: 1,
  },
  {
    ctaLabel: "اختر المتقدم",
    helper: "أفضل توازن بين السرعة والنتيجة",
    isPopular: true,
    key: "advanced",
    label: "متقدم",
    multiplier: ADVANCED_TIER_MULTIPLIER,
  },
  {
    ctaLabel: "احجز الشامل",
    helper: "عناية كاملة مع أولوية ومتابعة أوسع",
    isPopular: false,
    key: "complete",
    label: "شامل",
    multiplier: COMPLETE_TIER_MULTIPLIER,
  },
]);

/**
 * Returns the shared feature rows shown in the pricing tiers table.
 *
 * @param {{ duration?: unknown, name?: unknown }} service
 * @returns {string[]}
 */
function getTierFeatureLabels(service) {
  const duration = String(service?.duration || "حسب التشخيص").trim() || "حسب التشخيص";

  return [
    "تشخيص أولي وخطة تنفيذ واضحة",
    `مدة التنفيذ المتوقعة: ${duration}`,
    "تحديثات مرحلية أثناء التنفيذ",
    "متابعة بعد الإنجاز وأولوية في الدور",
  ];
}

/**
 * Rounds tier prices to user-friendly values.
 *
 * @param {number} price
 * @returns {number}
 */
function roundTierPrice(price) {
  return Math.max(0, Number(price.toFixed(2)));
}

/**
 * Builds the public-facing pricing tiers for one repair service.
 *
 * @param {{ name?: unknown, price?: unknown, duration?: unknown }} service
 * @returns {Array<{
 *   ctaLabel: string,
 *   features: Array<{ included: boolean, label: string }>,
 *   helper: string,
 *   isPopular: boolean,
 *   key: string,
 *   label: string,
 *   price: number,
 * }>}
 */
export function buildServicePricingTiers(service) {
  const featureLabels = getTierFeatureLabels(service);
  const basePrice = Math.max(0, Number(service?.price || 0));

  return TIER_BLUEPRINTS.map((tier, tierIndex) => ({
    ...tier,
    features: featureLabels.map((label, featureIndex) => ({
      included: BASIC_FEATURES[featureIndex]?.[tierIndex] ?? false,
      label,
    })),
    price: roundTierPrice(basePrice * tier.multiplier),
  }));
}
