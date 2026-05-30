/**
 * Deferred Orange Money claim helpers for previously-received SMS logs.
 */

import { loadExistingOrangeMoneyLog } from "./orangeMoneyLogs.js";

const CLAIMABLE_LOG_STATUSES = new Set(["received", "unmatched"]);
const DEFAULT_CLAIM_WINDOW_MINUTES = 24 * 60;
const DUPLICATE_PENDING_DEPOSIT_MESSAGE =
  "[DPG-106] لديك بالفعل طلب إيداع معلق بنفس المبلغ ورقم الهاتف.";
const CLAIM_REFERENCE_NOT_FOUND_MESSAGE =
  "[DPG-107] لم نعثر على حوالة محفوظة بهذا الرقم المرجعي.";
const CLAIM_REFERENCE_ALREADY_USED_MESSAGE =
  "[DPG-108] هذه الحوالة استُخدمت سابقًا أو هي قيد المعالجة الآن.";
const CLAIM_REFERENCE_MISMATCH_MESSAGE =
  "[DPG-109] رقم الهاتف أو المبلغ لا يطابق الحوالة المحفوظة بهذا الرقم المرجعي.";
const CLAIM_REFERENCE_EXPIRED_MESSAGE =
  "[DPG-110] انتهت صلاحية المطالبة التلقائية بهذه الحوالة. راجع الإدارة للتحقق اليدوي.";
const CLAIM_REFERENCE_RACE_MESSAGE =
  "[DPG-111] الحوالة قيد المعالجة أو تم ربطها بطلب آخر. حاول تحديث الصفحة.";

/**
 * Returns the stored-claim window in minutes.
 *
 * @param {Record<string, string | undefined>} env - Cloudflare bindings.
 * @returns {number} Window length in minutes.
 */
function resolveClaimWindowMinutes(env) {
  const rawValue = Number(env?.ORANGE_MONEY_STORED_CLAIM_WINDOW_MINUTES || "");
  return Number.isFinite(rawValue) && rawValue >= 5
    ? Math.floor(rawValue)
    : DEFAULT_CLAIM_WINDOW_MINUTES;
}

/**
 * Builds the ISO cutoff for one stored claim window.
 *
 * @param {{ env?: Record<string, string | undefined>, now?: number }} input - Window input.
 * @returns {string} ISO cutoff timestamp.
 */
export function buildStoredClaimCutoffIso({ env, now = Date.now() } = {}) {
  const windowMinutes = resolveClaimWindowMinutes(env);
  return new Date(now - windowMinutes * 60_000).toISOString();
}

/**
 * Returns whether one stored SMS log can be claimed by a later deposit request.
 *
 * @param {{ amount: number, cutoffIso: string, log: Record<string, unknown> | null, normalizedPhone: string }} input - Claim input.
 * @returns {string} Empty string when claimable, otherwise a public-safe error message.
 */
export function getStoredClaimValidationMessage({
  amount,
  cutoffIso,
  log,
  normalizedPhone,
}) {
  if (!log) {
    return CLAIM_REFERENCE_NOT_FOUND_MESSAGE;
  }

  if (log.target_id || log.wallet_transaction_id || !CLAIMABLE_LOG_STATUSES.has(String(log.status || ""))) {
    return CLAIM_REFERENCE_ALREADY_USED_MESSAGE;
  }

  if (Number(log.amount || 0) !== Number(amount) || String(log.normalized_phone || "") !== normalizedPhone) {
    return CLAIM_REFERENCE_MISMATCH_MESSAGE;
  }

  const createdAtMs = Date.parse(String(log.created_at || ""));
  if (!Number.isFinite(createdAtMs) || new Date(createdAtMs).toISOString() < cutoffIso) {
    return CLAIM_REFERENCE_EXPIRED_MESSAGE;
  }

  return "";
}

/**
 * Returns whether the user already has a pending Orange Money request with the same amount and phone.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, normalizedPhone: string, userId: string }} input - Duplicate lookup input.
 * @returns {Promise<string>} Duplicate error or an empty string.
 */
export async function findDuplicatePendingDepositMessage(input) {
  const { data } = await input.admin
    .from("deposits")
    .select("id, metadata")
    .eq("user_id", input.userId)
    .eq("method", "orange_money")
    .eq("status", "pending")
    .eq("amount", input.amount)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = Array.isArray(data) ? data : [];
  const conflict = rows.some((row) => {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    return String(metadata.orange_money_payer_phone || "") === input.normalizedPhone;
  });

  return conflict ? DUPLICATE_PENDING_DEPOSIT_MESSAGE : "";
}

/**
 * Loads one stored Orange Money SMS log by its reference id.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, referenceId: string }} input - Lookup input.
 * @returns {Promise<Record<string, unknown> | null>} Stored log row.
 */
export async function loadStoredClaimLog(input) {
  return loadExistingOrangeMoneyLog(input.admin, input.referenceId);
}

/**
 * Reserves one stored SMS log for a deposit before wallet crediting begins.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, depositId: string, logId: string, userId: string }} input - Reservation input.
 * @returns {Promise<boolean>} True when the reservation succeeds.
 */
export async function reserveStoredClaimLog(input) {
  const response = await input.admin
    .from("orange_money_logs")
    .update({
      error_message: null,
      target_id: input.depositId,
      target_type: "deposit",
      updated_at: new Date().toISOString(),
      user_id: input.userId,
    })
    .eq("id", input.logId)
    .in("status", [...CLAIMABLE_LOG_STATUSES])
    .is("target_id", null)
    .is("wallet_transaction_id", null)
    .select("id");

  return Array.isArray(response.data) && response.data.length > 0 && !response.error;
}

/**
 * Releases a stored-claim reservation when no wallet credit was applied.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, depositId: string, logId: string }} input - Release input.
 * @returns {Promise<void>}
 */
export async function releaseStoredClaimLog(input) {
  const { error } = await input.admin
    .from("orange_money_logs")
    .update({
      error_message: null,
      target_id: null,
      target_type: null,
      updated_at: new Date().toISOString(),
      user_id: null,
    })
    .eq("id", input.logId)
    .eq("target_id", input.depositId);

  if (error) {
    console.warn("[SMS-LOG] Failed to release reserved Orange Money log.", error);
  }
}

/**
 * Validates whether a stored-reference claim can proceed.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, env?: Record<string, string | undefined>, normalizedPhone: string, referenceId: string }} input - Claim validation input.
 * @returns {Promise<{ error: string, log: Record<string, unknown> | null }>} Validation result.
 */
export async function validateStoredClaim(input) {
  const log = await loadStoredClaimLog({ admin: input.admin, referenceId: input.referenceId });
  const error = getStoredClaimValidationMessage({
    amount: input.amount,
    cutoffIso: buildStoredClaimCutoffIso({ env: input.env }),
    log,
    normalizedPhone: input.normalizedPhone,
  });

  return { error, log };
}

export const orangeMoneyStoredClaimTestHooks = {
  buildStoredClaimCutoffIso,
  getStoredClaimValidationMessage,
};

export {
  CLAIM_REFERENCE_ALREADY_USED_MESSAGE,
  CLAIM_REFERENCE_EXPIRED_MESSAGE,
  CLAIM_REFERENCE_MISMATCH_MESSAGE,
  CLAIM_REFERENCE_NOT_FOUND_MESSAGE,
  CLAIM_REFERENCE_RACE_MESSAGE,
  DUPLICATE_PENDING_DEPOSIT_MESSAGE,
};
