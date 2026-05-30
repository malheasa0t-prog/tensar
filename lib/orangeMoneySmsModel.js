/**
 * Orange Money SMS parsing and phone normalization helpers.
 */

const INCOMING_TRANSFER_MARKERS = Object.freeze([
  "تم استقبال حوالة مالية",
  "\u00d8\u00aa\u00d9\u2026 \u00d8\u00a7\u00d8\u00b3\u00d8\u00aa\u00d9\u201a\u00d8\u00a8\u00d8\u00a7\u00d9\u201e \u00d8\u00ad\u00d9\u02c6\u00d8\u00a7\u00d9\u201e\u00d8\u00a9 \u00d9\u2026\u00d8\u00a7\u00d9\u201e\u00d9\u0160\u00d8\u00a9",
]);
const AMOUNT_PATTERNS = Object.freeze([
  /بمبلغ\s+([0-9]+(?:[.,][0-9]+)?)\s+دينار/u,
  /\u00d8\u00a8\u00d9\u2026\u00d8\u00a8\u00d9\u201e\u00d8\u00ba\s+([0-9]+(?:[.,][0-9]+)?)\s+\u00d8\u00af\u00d9\u0160\u00d9\u2020\u00d8\u00a7\u00d8\u00b1/u,
]);
const PHONE_PATTERNS = Object.freeze([
  /من\s+(\+?\d{8,15})\b/gu,
  /\u00d9\u2026\u00d9\u2020\s+(\+?\d{8,15})\b/gu,
]);
const REFERENCE_PATTERNS = Object.freeze([
  /بالرقم\s+المرجعي\s+([A-Z0-9-]+)\b/iu,
  /\u00d8\u00a8\u00d8\u00a7\u00d9\u201e\u00d8\u00b1\u00d9\u201a\u00d9\u2026\s+\u00d8\u00a7\u00d9\u201e\u00d9\u2026\u00d8\u00b1\u00d8\u00ac\u00d8\u00b9\u00d9\u0160\s+([A-Z0-9-]+)\b/iu,
  /\b(OJM-[A-Z0-9-]+)\b/iu,
]);

/**
 * Returns whether a sender string appears to belong to Orange Money.
 *
 * @param {unknown} sender - SMS sender value from the forwarder app.
 * @returns {boolean} True when the sender is blank or includes Orange.
 */
export function isOrangeMoneySender(sender) {
  const normalizedSender = String(sender || "").trim().toLowerCase();
  return !normalizedSender || normalizedSender.includes("orange");
}

/**
 * Returns whether an SMS body looks like an incoming Orange Money transfer.
 *
 * @param {unknown} text - Raw SMS body.
 * @returns {boolean} True when the transfer marker is present.
 */
export function isIncomingOrangeMoneyTransfer(text) {
  const normalizedText = String(text || "");
  return INCOMING_TRANSFER_MARKERS.some((marker) => normalizedText.includes(marker));
}

/**
 * Parses the first supported amount value from an Orange Money SMS body.
 *
 * @param {string} text - Raw SMS body.
 * @returns {number | null} Parsed amount or null when unavailable.
 */
function parseSmsAmount(text) {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const amount = Number(String(match[1]).replace(",", "."));
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  return null;
}

/**
 * Parses the first supported phone value from an Orange Money SMS body.
 *
 * @param {string} text - Raw SMS body.
 * @returns {string | null} Raw phone number or null when unavailable.
 */
function parseSmsPhone(text) {
  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = Array.from(text.matchAll(pattern));
    const match = matches.find((entry) => /\d{8,15}/.test(entry[1] || ""));
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parses the transfer reference from an Orange Money SMS body.
 *
 * @param {string} text - Raw SMS body.
 * @returns {string | null} Reference id or null when unavailable.
 */
function parseSmsReference(text) {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Extracts payment fields from an Orange Money SMS.
 *
 * @param {unknown} text - Raw SMS body.
 * @returns {{ amount: number | null, phone: string | null, referenceId: string | null }}
 */
export function parseOrangeMoneySms(text) {
  const normalizedText = String(text || "");
  return {
    amount: parseSmsAmount(normalizedText),
    phone: parseSmsPhone(normalizedText),
    referenceId: parseSmsReference(normalizedText),
  };
}

/**
 * Normalizes Jordanian phone numbers to a local searchable format.
 *
 * @param {unknown} phone - Raw phone number.
 * @returns {string} Normalized phone number or an empty string.
 */
export function normalizePhoneForSearch(phone) {
  const compactPhone = String(phone || "").replace(/[^\d+]/g, "");
  if (!compactPhone) {
    return "";
  }

  if (compactPhone.startsWith("+962")) {
    return `0${compactPhone.slice(4)}`;
  }

  if (compactPhone.startsWith("00962")) {
    return `0${compactPhone.slice(5)}`;
  }

  if (compactPhone.startsWith("962")) {
    return `0${compactPhone.slice(3)}`;
  }

  if (/^7\d{8}$/.test(compactPhone)) {
    return `0${compactPhone}`;
  }

  return compactPhone;
}

/**
 * Builds a safe suffix used for phone matching across differently formatted rows.
 *
 * @param {unknown} phone - Raw or normalized phone number.
 * @returns {string} Last eight digits, or an empty string when not searchable.
 */
export function getPhoneSearchTail(phone) {
  const normalizedPhone = normalizePhoneForSearch(phone).replace(/\D/g, "");
  return normalizedPhone.length >= 8 ? normalizedPhone.slice(-8) : "";
}
