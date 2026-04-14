/**
 * Shared currency formatting helpers for Jordanian Dinar values.
 */

export const CURRENCY_LOCALE = "ar-JO";
export const CURRENCY_SYMBOL = "د.أ";
const CURRENCY_FORMATTER = new Intl.NumberFormat(CURRENCY_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Converts mixed number-like values into a safe finite amount.
 *
 * @param {unknown} amount
 * @returns {number}
 */
export function normalizeCurrencyAmount(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Formats a monetary value using the shared Jordanian locale rules.
 *
 * @param {unknown} amount
 * @param {{ showSymbol?: boolean }} [options]
 * @returns {string}
 */
export function formatCurrency(amount, options = {}) {
  const formatted = CURRENCY_FORMATTER.format(normalizeCurrencyAmount(amount));

  return options.showSymbol === false ? formatted : `${formatted} ${CURRENCY_SYMBOL}`;
}
