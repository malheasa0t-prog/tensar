/**
 * Deposit page data loading and Orange Money request submission.
 */

import { createIdempotencyKey } from "../lib/idempotencyKey.js";
import { loadSiteSettingsClient } from "../lib/siteSettingsClient.js";
import { validateDepositAmount } from "../lib/depositPageModel.js";
import {
  LOGIN_REQUIRED_MESSAGE,
  PAYER_PHONE_INVALID_MESSAGE,
  PAYER_PHONE_REQUIRED_MESSAGE,
  REFERENCE_ID_INVALID_MESSAGE,
  buildOrangeMoneyDepositSuccessMessage,
  validateDepositPayerPhone,
  validateOrangeMoneyReferenceId,
} from "../lib/orangeMoneyDepositModel.js";

export {
  LOGIN_REQUIRED_MESSAGE,
  PAYER_PHONE_INVALID_MESSAGE,
  PAYER_PHONE_REQUIRED_MESSAGE,
  REFERENCE_ID_INVALID_MESSAGE,
  buildOrangeMoneyDepositSuccessMessage,
  normalizeDepositPayerPhone,
  normalizeOrangeMoneyReferenceId,
  validateDepositPayerPhone,
  validateOrangeMoneyReferenceId,
} from "../lib/orangeMoneyDepositModel.js";

const LOAD_DEPOSITS_ERROR_MESSAGE = "[DPG-301] تعذر تحميل سجل الإيداعات.";
const SUBMIT_DEPOSIT_ERROR_MESSAGE = "[DPG-302] تعذر إنشاء طلب الإيداع حاليًا.";
const ORANGE_MONEY_DEPOSIT_ENDPOINT = "/api/deposits/orange-money";

/**
 * Loads the authenticated user's deposit history and current deposit settings.
 *
 * @param {{ client: { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }, from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data?: unknown[], error?: { message?: string } | null }> } } } }, loadSettings?: typeof loadSiteSettingsClient }} input
 * @returns {Promise<{ userId: string, deposits: unknown[], depositTransfer: Record<string, unknown>, walletTransferNumber: string }>}
 * @throws {Error} When the deposit query fails.
 */
export async function fetchDepositPageSnapshot({
  client,
  loadSettings = loadSiteSettingsClient,
}) {
  const [
    {
      data: { user },
    },
    siteSettings,
  ] = await Promise.all([client.auth.getUser(), loadSettings(client)]);

  if (!user) {
    return {
      userId: "",
      deposits: [],
      depositTransfer: siteSettings.depositTransfer,
      walletTransferNumber: siteSettings.walletTransferNumber || "",
    };
  }

  const { data, error } = await client
    .from("deposits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(LOAD_DEPOSITS_ERROR_MESSAGE);
  }

  return {
    userId: user.id,
    deposits: Array.isArray(data) ? data : [],
    depositTransfer: siteSettings.depositTransfer,
    walletTransferNumber: siteSettings.walletTransferNumber || "",
  };
}

/**
 * Resolves one authenticated access token from the browser client session.
 *
 * @param {{ auth: { getSession: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } }} client - Browser client.
 * @returns {Promise<string>} Access token or an empty string.
 */
async function resolveDepositAccessToken(client) {
  const sessionResponse = await client.auth.getSession();
  return String(sessionResponse?.data?.session?.access_token || "").trim();
}

/**
 * Sends the authenticated Orange Money deposit request to the server gate.
 *
 * @param {{
 *   accessToken: string,
 *   amount: number,
 *   idempotencyKey?: string,
 *   payerPhone: string,
 *   referenceId: string,
 * }} input - Request payload.
 * @returns {Promise<Record<string, unknown>>} Parsed response payload.
 * @throws {Error} When the request fails.
 */
async function postOrangeMoneyDepositRequest(input) {
  const requestIdempotencyKey =
    String(input?.idempotencyKey || "").trim() || createIdempotencyKey();
  const response = await fetch(ORANGE_MONEY_DEPOSIT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": requestIdempotencyKey,
    },
    body: JSON.stringify({
      amount: input.amount,
      payerPhone: input.payerPhone,
      referenceId: input.referenceId || "",
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || SUBMIT_DEPOSIT_ERROR_MESSAGE);
  }

  return payload?.data || {};
}

/**
 * Creates an Orange Money deposit request for the authenticated user.
 *
 * @param {{
 *   amount: unknown,
 *   client: { auth: { getSession: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } },
 *   idempotencyKey?: string,
 *   payerPhone: unknown,
 *   referenceId?: unknown,
 * }} input
 * @returns {Promise<{ autoApproved: boolean, claimOutcome: string, depositId: string, status: string, userId: string, referenceId: string }>}
 * @throws {Error} When authentication, validation, or submission fails.
 */
export async function createDepositRequest({
  client,
  idempotencyKey = "",
  amount,
  payerPhone,
  referenceId = "",
}) {
  const amountValidationError = validateDepositAmount(amount);
  if (amountValidationError) {
    throw new Error(amountValidationError);
  }

  const phoneValidationError = validateDepositPayerPhone(payerPhone);
  if (phoneValidationError) {
    throw new Error(phoneValidationError);
  }

  const referenceValidationError = validateOrangeMoneyReferenceId(referenceId);
  if (referenceValidationError) {
    throw new Error(referenceValidationError);
  }

  const accessToken = await resolveDepositAccessToken(client);
  if (!accessToken) {
    throw new Error(LOGIN_REQUIRED_MESSAGE);
  }

  const payload = await postOrangeMoneyDepositRequest({
    accessToken,
    amount: Number(amount),
    idempotencyKey,
    payerPhone: String(payerPhone || ""),
    referenceId: String(referenceId || ""),
  });

  return {
    autoApproved: payload?.autoApproved === true,
    claimOutcome: String(payload?.claimOutcome || "").trim(),
    depositId: String(payload?.depositId || "").trim(),
    referenceId: String(payload?.referenceId || "").trim(),
    status: String(payload?.status || "pending").trim(),
    userId: String(payload?.userId || "").trim(),
  };
}
