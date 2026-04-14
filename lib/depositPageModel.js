export const DEPOSIT_PROOF_BUCKET_NAME = "deposits";
export const MIN_DEPOSIT_AMOUNT = 1;
export const MAX_DEPOSIT_AMOUNT = 10000;
export const INVALID_DEPOSIT_AMOUNT_MESSAGE = "مبلغ الشحن غير صالح.";
export const MIN_DEPOSIT_AMOUNT_MESSAGE = `الحد الأدنى للشحن ${MIN_DEPOSIT_AMOUNT} د.أ`;
export const MAX_DEPOSIT_AMOUNT_MESSAGE = `الحد الأقصى للشحن ${MAX_DEPOSIT_AMOUNT} د.أ`;
export const PRESET_DEPOSIT_AMOUNTS = Object.freeze([5, 10, 25, 50, 100]);
export const MISSING_DEPOSIT_TRANSFER_MESSAGE =
  "سيتم عرض معلومات التحويل البنكي بعد تحديث إعدادات الموقع.";
export const DEPOSIT_STATUS_MAP = Object.freeze({
  pending: { label: "قيد المراجعة", color: "#f39c12" },
  approved: { label: "تمت الموافقة", color: "#2ecc71" },
  rejected: { label: "مرفوض", color: "#e74c3c" },
});

const DEFAULT_PROOF_EXTENSION = "jpg";

/**
 * Validates a deposit amount against the public wallet top-up limits.
 *
 * @param {unknown} amount
 * @returns {string}
 */
export function validateDepositAmount(amount) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return INVALID_DEPOSIT_AMOUNT_MESSAGE;
  }

  if (numericAmount < MIN_DEPOSIT_AMOUNT) {
    return MIN_DEPOSIT_AMOUNT_MESSAGE;
  }

  if (numericAmount > MAX_DEPOSIT_AMOUNT) {
    return MAX_DEPOSIT_AMOUNT_MESSAGE;
  }

  return "";
}

/**
 * Builds a deterministic storage object path for a deposit proof image.
 *
 * @param {{ userId: string, fileName?: string, now?: number }} input
 * @returns {string}
 * @throws {Error}
 */
export function buildDepositProofObjectPath({ userId, fileName = "", now = Date.now() }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("معرّف المستخدم مطلوب لرفع إثبات الإيداع.");
  }

  const timestamp = Number.isFinite(Number(now)) ? Math.floor(Number(now)) : Date.now();
  const normalizedFileName = String(fileName || "").trim();
  const rawExtension = normalizedFileName.includes(".") ? normalizedFileName.split(".").pop() : "";
  const sanitizedExtension =
    /^[a-z0-9]+$/i.test(rawExtension || "") && rawExtension
      ? rawExtension.toLowerCase()
      : DEFAULT_PROOF_EXTENSION;

  return `${normalizedUserId}/${timestamp}.${sanitizedExtension}`;
}
