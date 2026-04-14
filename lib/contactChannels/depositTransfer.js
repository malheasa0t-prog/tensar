import { cleanValue } from "./helpers.js";

export const EMPTY_DEPOSIT_TRANSFER = Object.freeze({
  bankName: "",
  accountHolder: "",
  iban: "",
  instructions: "",
});

/**
 * Normalizes bank-transfer details used by the deposit page.
 *
 * @param {unknown} value
 * @param {string} [fallbackAccountHolder]
 * @returns {{ bankName: string, accountHolder: string, iban: string, instructions: string }}
 */
export function normalizeDepositTransferSettings(value, fallbackAccountHolder = "") {
  const source = value && typeof value === "object" ? value : {};
  const accountHolder =
    cleanValue(source.accountHolder || source.accountName || source.holderName) ||
    cleanValue(fallbackAccountHolder);

  return {
    bankName: cleanValue(source.bankName || source.bank),
    accountHolder,
    iban: cleanValue(source.iban || source.accountNumber),
    instructions: cleanValue(source.instructions || source.note),
  };
}

/**
 * Checks whether the deposit transfer settings are complete enough for display.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasDepositTransferDetails(value) {
  const normalized = normalizeDepositTransferSettings(value);
  return Boolean(normalized.bankName && normalized.iban);
}
