/**
 * Orange Money SMS webhook for automated payment confirmation.
 */

import {
  createSupabaseAdmin,
  errorResponse,
  successResponse,
} from "../../_lib/supabase.js";
import { timingSafeEqualStrings } from "../../_lib/timingSafeEqual.js";
import {
  createOrReuseOrangeMoneyLog,
  finishOrangeMoneyProcessed,
  updateOrangeMoneyLog,
} from "../../_lib/orangeMoneyLogs.js";
import { processOrangeMoneyPayment } from "../../_lib/orangeMoneyPaymentMatcher.js";
import {
  isIncomingOrangeMoneyTransfer,
  isOrangeMoneySender,
  normalizePhoneForSearch,
  parseOrangeMoneySms,
} from "../../../lib/orangeMoneySmsModel.js";

const SECRET_ENV_KEYS = Object.freeze([
  "SMS_WEBHOOK_SECRET",
  "SERVA_WEBHOOK_SECRET",
  "PROVIDER_API_KEY",
]);

/**
 * Resolves the configured webhook secret from supported environment names.
 *
 * @param {Record<string, string | undefined>} env - Cloudflare bindings.
 * @returns {string} Configured secret or an empty string.
 */
function getExpectedSecret(env) {
  for (const key of SECRET_ENV_KEYS) {
    const value = String(env?.[key] || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * Checks whether the request carries the expected webhook secret.
 *
 * @param {Request} request - Incoming webhook request.
 * @param {Record<string, string | undefined>} env - Cloudflare bindings.
 * @returns {boolean} True when the secret is valid.
 */
function isValidSecret(request, env) {
  const incomingSecret = String(
    request.headers.get("x-sms-secret") || new URL(request.url).searchParams.get("secret") || "",
  );
  const expectedSecret = getExpectedSecret(env);
  return Boolean(expectedSecret) && timingSafeEqualStrings(incomingSecret, expectedSecret);
}

/**
 * Extracts normalized message fields from supported forwarder payload shapes.
 *
 * @param {Record<string, unknown>} body - Parsed webhook body.
 * @returns {{ sender: string, text: string }}
 */
function getSmsPayload(body) {
  return {
    sender: String(body?.sender || body?.from || ""),
    text: String(body?.message || body?.text || body?.content || ""),
  };
}

/**
 * Safely parses the request body as JSON.
 *
 * @param {Request} request - Incoming webhook request.
 * @returns {Promise<Record<string, unknown> | null>} Parsed body or null.
 */
async function readWebhookBody(request) {
  try {
    return await request.json();
  } catch (parseError) {
    void parseError;
    return null;
  }
}

/**
 * Builds the operation log state before fulfillment starts.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, normalizedPhone: string, phone: string, referenceId: string, sender: string, text: string }} input - Log input.
 * @returns {Promise<{ duplicate: boolean, logId: string | null }>} Log state.
 */
async function initializeOperationLog(input) {
  return createOrReuseOrangeMoneyLog(input);
}

/**
 * Handles POST /api/webhooks/sms-receiver.
 *
 * @param {EventContext} context - Cloudflare Pages context.
 * @returns {Promise<Response>} Webhook response.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isValidSecret(request, env)) {
    return errorResponse("[SMS-401] غير مصرح بالوصول.", 401);
  }

  const body = await readWebhookBody(request);
  if (!body) {
    return errorResponse("[SMS-400] تنسيق البيانات غير صالح. يجب أن يكون JSON.", 400);
  }

  const { sender, text } = getSmsPayload(body);
  if (!isOrangeMoneySender(sender)) {
    return successResponse({ ignored: true, reason: "not_orange_money_sender" });
  }

  if (!isIncomingOrangeMoneyTransfer(text)) {
    return successResponse({ ignored: true, reason: "not_incoming_transfer" });
  }

  const { amount, phone, referenceId } = parseOrangeMoneySms(text);
  if (!amount || !phone || !referenceId) {
    return errorResponse("[SMS-422] لم يتم العثور على المبلغ أو رقم الهاتف أو الرقم المرجعي.", 422);
  }

  const admin = createSupabaseAdmin(env);
  const normalizedPhone = normalizePhoneForSearch(phone);
  const logState = await initializeOperationLog({
    admin,
    amount,
    normalizedPhone,
    phone,
    referenceId,
    sender,
    text,
  });

  if (logState.duplicate) {
    return successResponse({ ignored: true, reason: "duplicate_reference" });
  }

  try {
    const result = await processOrangeMoneyPayment({
      admin,
      amount,
      phone: normalizedPhone,
      referenceId,
    });

    if (result.matched) {
      return finishOrangeMoneyProcessed({ admin, logId: logState.logId, result });
    }

    await updateOrangeMoneyLog(admin, logState.logId, {
      error_message: result.errorMessage,
      status: "unmatched",
    });
    return errorResponse("[SMS-404] لم يتم العثور على طلب أو مستخدم يطابق رقم الهاتف والمبلغ.", 404);
  } catch (processingError) {
    const message =
      processingError instanceof Error ? processingError.message : "[SMS-500] فشل معالجة رسالة الدفع.";
    console.error("[SMS-500] Orange Money processing failed.", processingError);
    await updateOrangeMoneyLog(admin, logState.logId, {
      error_message: message,
      status: "failed",
    });
    return errorResponse(message, 500);
  }
}
