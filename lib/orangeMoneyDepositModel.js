/**
 * Orange Money deposit request validation and metadata helpers.
 */

import { getPhoneSearchTail, normalizePhoneForSearch } from "./orangeMoneySmsModel.js";

export const PAYER_PHONE_REQUIRED_MESSAGE = "[DPG-103] أدخل رقم الهاتف الذي تم التحويل منه.";
export const PAYER_PHONE_INVALID_MESSAGE = "[DPG-104] أدخل رقم هاتف أردني صالح مثل 0771234567.";
export const REFERENCE_ID_INVALID_MESSAGE = "[DPG-105] أدخل الرقم المرجعي كما ظهر في رسالة Orange Money.";
export const LOGIN_REQUIRED_MESSAGE = "[DPG-201] يجب تسجيل الدخول أولًا";
export const STORED_REFERENCE_SUCCESS_MESSAGE = "تمت مطابقة الحوالة المحفوظة وشحن رصيدك تلقائيًا.";
export const PENDING_SMS_SUCCESS_MESSAGE =
  "تم استلام طلب الشحن بنجاح. سيُؤكد الطلب تلقائيًا عند وصول رسالة Orange Money المطابقة.";

const JORDAN_MOBILE_PATTERN = /^07\d{8}$/u;
const ORANGE_MONEY_REFERENCE_PATTERN = /^[A-Z0-9-]{6,64}$/u;

/**
 * Normalizes the payer phone into a local Jordanian searchable form.
 *
 * @param {unknown} payerPhone - Raw phone number entered by the customer.
 * @returns {string} Normalized local phone number, or an empty string.
 */
export function normalizeDepositPayerPhone(payerPhone) {
  return normalizePhoneForSearch(payerPhone).replace(/\D/g, "");
}

/**
 * Validates the Orange Money phone number attached to a deposit request.
 *
 * @param {unknown} payerPhone - Raw phone number entered by the customer.
 * @returns {string} Validation message, or an empty string when valid.
 */
export function validateDepositPayerPhone(payerPhone) {
  const normalizedPhone = normalizeDepositPayerPhone(payerPhone);
  if (!normalizedPhone) {
    return PAYER_PHONE_REQUIRED_MESSAGE;
  }

  return JORDAN_MOBILE_PATTERN.test(normalizedPhone) ? "" : PAYER_PHONE_INVALID_MESSAGE;
}

/**
 * Normalizes one Orange Money transfer reference.
 *
 * @param {unknown} referenceId - Raw reference value.
 * @returns {string} Uppercased reference id, or an empty string.
 */
export function normalizeOrangeMoneyReferenceId(referenceId) {
  return String(referenceId || "").trim().toUpperCase();
}

/**
 * Validates one optional Orange Money transfer reference.
 *
 * @param {unknown} referenceId - Raw reference value.
 * @returns {string} Validation message, or an empty string when valid.
 */
export function validateOrangeMoneyReferenceId(referenceId) {
  const normalizedReference = normalizeOrangeMoneyReferenceId(referenceId);
  if (!normalizedReference) {
    return "";
  }

  return ORANGE_MONEY_REFERENCE_PATTERN.test(normalizedReference)
    ? ""
    : REFERENCE_ID_INVALID_MESSAGE;
}

/**
 * Builds the Orange Money metadata stored with one deposit request.
 *
 * @param {{ payerPhone: string, referenceId?: string, now?: () => string }} input - Metadata input.
 * @returns {Record<string, string>} Deposit metadata payload.
 */
export function buildOrangeMoneyDepositMetadata({
  payerPhone,
  referenceId = "",
  now = () => new Date().toISOString(),
}) {
  const normalizedPhone = normalizeDepositPayerPhone(payerPhone);
  const normalizedReference = normalizeOrangeMoneyReferenceId(referenceId);
  const metadata = {
    orange_money_payer_phone: normalizedPhone,
    orange_money_payer_phone_tail: getPhoneSearchTail(normalizedPhone),
    orange_money_requested_at: now(),
  };

  if (normalizedReference) {
    metadata.orange_money_reference_id = normalizedReference;
  }

  return metadata;
}

/**
 * Builds the success message shown after creating one Orange Money deposit request.
 *
 * @param {{ autoApproved?: boolean, claimOutcome?: string, status?: string }} result - API response payload.
 * @returns {string} User-facing success message.
 */
export function buildOrangeMoneyDepositSuccessMessage(result) {
  const claimOutcome = String(result?.claimOutcome || "").trim();
  const status = String(result?.status || "").trim().toLowerCase();
  const isApproved =
    result?.autoApproved === true
    || claimOutcome === "stored_reference_matched"
    || status === "approved";

  return isApproved ? STORED_REFERENCE_SUCCESS_MESSAGE : PENDING_SMS_SUCCESS_MESSAGE;
}
