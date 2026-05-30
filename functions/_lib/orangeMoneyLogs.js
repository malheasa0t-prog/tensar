/**
 * Orange Money operation-log helpers for the SMS webhook.
 */

import { successResponse } from "./supabase.js";

const FINAL_LOG_STATUSES = new Set(["processed", "duplicate"]);

/**
 * Returns whether one log is no longer safe to reuse.
 *
 * @param {Record<string, unknown> | null} log - Existing log row.
 * @returns {boolean} True when the log is processed or reserved already.
 */
function isReservedOrFinalOrangeMoneyLog(log) {
  if (!log || typeof log !== "object") {
    return false;
  }

  return Boolean(
    FINAL_LOG_STATUSES.has(String(log.status || ""))
    || log.target_id
    || log.wallet_transaction_id,
  );
}

/**
 * Loads an existing Orange Money log for one reference id.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} admin - Service role client.
 * @param {string} referenceId - Orange Money reference id.
 * @returns {Promise<Record<string, unknown> | null>} Existing log row or null.
 */
export async function loadExistingOrangeMoneyLog(admin, referenceId) {
  const { data, error } = await admin
    .from("orange_money_logs")
    .select("*")
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (error) {
    console.warn("[SMS-LOG] Orange Money log lookup failed.", error);
    return null;
  }

  return data || null;
}

/**
 * Updates an Orange Money operation log when the table is available.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} admin - Service role client.
 * @param {string | null} logId - Operation log id.
 * @param {Record<string, unknown>} patch - Columns to update.
 * @returns {Promise<void>}
 */
export async function updateOrangeMoneyLog(admin, logId, patch) {
  if (!logId) {
    return;
  }

  const { error } = await admin
    .from("orange_money_logs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", logId);

  if (error) {
    console.warn("[SMS-LOG] Orange Money log update failed.", error);
  }
}

/**
 * Inserts a fresh Orange Money operation log.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, normalizedPhone: string, phone: string, referenceId: string, sender: string, text: string }} input
 * @returns {Promise<string | null>} New log id or null when logging is unavailable.
 */
async function insertOrangeMoneyLog(input) {
  const { data, error } = await input.admin
    .from("orange_money_logs")
    .insert([{
      amount: input.amount,
      normalized_phone: input.normalizedPhone,
      payer_phone: input.phone,
      reference_id: input.referenceId,
      sender: input.sender,
      sms_text: input.text,
      status: "received",
    }])
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[SMS-LOG] Orange Money log insert failed.", error);
  }

  return data?.id || null;
}

/**
 * Creates or reuses the operation log for this SMS.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, normalizedPhone: string, phone: string, referenceId: string, sender: string, text: string }} input
 * @returns {Promise<{ duplicate: boolean, logId: string | null }>}
 */
export async function createOrReuseOrangeMoneyLog(input) {
  const existingLog = await loadExistingOrangeMoneyLog(input.admin, input.referenceId);
  if (isReservedOrFinalOrangeMoneyLog(existingLog)) {
    return { duplicate: true, logId: existingLog.id || null };
  }

  if (existingLog?.id) {
    await updateOrangeMoneyLog(input.admin, existingLog.id, {
      error_message: null,
      status: "received",
    });
    return { duplicate: false, logId: existingLog.id };
  }

  return {
    duplicate: false,
    logId: await insertOrangeMoneyLog(input),
  };
}

export const orangeMoneyLogsTestHooks = {
  isReservedOrFinalOrangeMoneyLog,
};

/**
 * Writes a successful operation log update and returns a webhook response.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, logId: string | null, result: { targetId: string, targetType: string, transactionId?: string | null, userId?: string | null } }} input
 * @returns {Promise<Response>} JSON success response.
 */
export async function finishOrangeMoneyProcessed(input) {
  await updateOrangeMoneyLog(input.admin, input.logId, {
    status: "processed",
    target_id: input.result.targetId,
    target_type: input.result.targetType,
    user_id: input.result.userId || null,
    wallet_transaction_id: input.result.transactionId || null,
  });

  return successResponse({
    processed: true,
    target_id: input.result.targetId,
    type: input.result.targetType,
  });
}
