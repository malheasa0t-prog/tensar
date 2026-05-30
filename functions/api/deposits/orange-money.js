/**
 * Cloudflare Pages Function for Orange Money deposit requests.
 */

import { handlePreflight, withCors } from "../../_lib/cors.js";
import { withIdempotency } from "../../_lib/idempotency.js";
import {
  createSupabaseAdmin,
  createSupabaseClient,
  errorResponse,
  extractBearerToken,
  successResponse,
} from "../../_lib/supabase.js";
import { validateDepositAmount } from "../../../lib/depositPageModel.js";
import {
  LOGIN_REQUIRED_MESSAGE,
  buildOrangeMoneyDepositMetadata,
  normalizeDepositPayerPhone,
  normalizeOrangeMoneyReferenceId,
  validateDepositPayerPhone,
  validateOrangeMoneyReferenceId,
} from "../../../lib/orangeMoneyDepositModel.js";
import {
  CLAIM_REFERENCE_ALREADY_USED_MESSAGE,
  CLAIM_REFERENCE_EXPIRED_MESSAGE,
  CLAIM_REFERENCE_MISMATCH_MESSAGE,
  CLAIM_REFERENCE_NOT_FOUND_MESSAGE,
  CLAIM_REFERENCE_RACE_MESSAGE,
  findDuplicatePendingDepositMessage,
  releaseStoredClaimLog,
  reserveStoredClaimLog,
  validateStoredClaim,
} from "../../_lib/orangeMoneyStoredClaim.js";
import {
  applyWalletDeposit,
  withOrangeMoneyMetadata,
} from "../../_lib/orangeMoneyPaymentMatcher.js";
import { finishOrangeMoneyProcessed } from "../../_lib/orangeMoneyLogs.js";

const ORANGE_MONEY_DEPOSIT_METHODS = "POST, OPTIONS";
const ORANGE_MONEY_DEPOSIT_MAX_BODY_BYTES = 4_000;
const INVALID_SESSION_MESSAGE = "[DPG-202] جلسة تسجيل الدخول غير صالحة.";
const INVALID_BODY_MESSAGE = "[DPG-203] بيانات الطلب غير صالحة.";
const CREATE_DEPOSIT_ERROR_MESSAGE = "[DPG-303] تعذر إنشاء طلب الإيداع حاليًا.";
const AUTO_APPROVE_ERROR_MESSAGE = "[DPG-304] تعذر اعتماد الحوالة المحفوظة تلقائيًا.";
const AUTO_APPROVED_ADMIN_NOTE = "تمت المطابقة تلقائيًا مع حوالة Orange Money محفوظة.";

/**
 * Maps stored-claim validation errors to HTTP statuses.
 *
 * @param {string} message - Public-safe error message.
 * @returns {number} HTTP status code.
 */
function getStoredClaimStatusCode(message) {
  if (message === CLAIM_REFERENCE_NOT_FOUND_MESSAGE) {
    return 404;
  }

  if (message === CLAIM_REFERENCE_EXPIRED_MESSAGE) {
    return 410;
  }

  if (
    message === CLAIM_REFERENCE_ALREADY_USED_MESSAGE
    || message === CLAIM_REFERENCE_MISMATCH_MESSAGE
    || message === CLAIM_REFERENCE_RACE_MESSAGE
  ) {
    return 409;
  }

  return 400;
}

/**
 * Reads the raw body and rejects oversized payloads.
 *
 * @param {Request} request - Incoming request.
 * @returns {Promise<string>} Raw request body.
 */
async function readOrangeMoneyDepositBody(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > ORANGE_MONEY_DEPOSIT_MAX_BODY_BYTES) {
    throw new Error("[DPG-204] حجم الطلب كبير جدًا.");
  }

  return request.text();
}

/**
 * Resolves the authenticated user from the bearer token.
 *
 * @param {{ createClient: typeof createSupabaseClient, env: Record<string, string>, request: Request }} input - Auth input.
 * @returns {Promise<{ error: string, user: Record<string, unknown> | null }>} Auth result.
 */
async function authenticateOrangeMoneyDepositRequest(input) {
  const token = extractBearerToken(input.request);
  if (!token) {
    return { error: LOGIN_REQUIRED_MESSAGE, user: null };
  }

  const client = input.createClient(input.env);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    return { error: INVALID_SESSION_MESSAGE, user: null };
  }

  return { error: "", user };
}

/**
 * Parses and normalizes the JSON request payload.
 *
 * @param {string} rawBody - Raw JSON body.
 * @returns {{ amount: number, payerPhone: string, referenceId: string }} Normalized payload.
 */
function parseOrangeMoneyDepositBody(rawBody) {
  const body = rawBody ? JSON.parse(rawBody) : {};
  return {
    amount: Number(body?.amount),
    payerPhone: String(body?.payerPhone || ""),
    referenceId: normalizeOrangeMoneyReferenceId(body?.referenceId),
  };
}

/**
 * Validates the normalized Orange Money deposit payload.
 *
 * @param {{ amount: number, payerPhone: string, referenceId: string }} input - Normalized payload.
 * @returns {string} Validation error or an empty string.
 */
function validateOrangeMoneyDepositInput(input) {
  return (
    validateDepositAmount(input.amount)
    || validateDepositPayerPhone(input.payerPhone)
    || validateOrangeMoneyReferenceId(input.referenceId)
  );
}

/**
 * Inserts one pending Orange Money deposit request.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, metadata: Record<string, string>, userId: string }} input - Insert input.
 * @returns {Promise<Record<string, unknown>>} Inserted deposit row.
 */
async function createPendingOrangeMoneyDeposit(input) {
  const response = await input.admin
    .from("deposits")
    .insert([{
      user_id: input.userId,
      amount: input.amount,
      method: "orange_money",
      proof_url: null,
      status: "pending",
      metadata: input.metadata,
    }])
    .select("id, metadata, status")
    .single();

  if (response.error || !response.data) {
    throw new Error(CREATE_DEPOSIT_ERROR_MESSAGE);
  }

  return response.data;
}

/**
 * Deletes one still-pending deposit after a failed stored-reference claim.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, depositId: string }} input - Delete input.
 * @returns {Promise<void>}
 */
async function deletePendingOrangeMoneyDeposit(input) {
  const { error } = await input.admin
    .from("deposits")
    .delete()
    .eq("id", input.depositId)
    .eq("status", "pending");

  if (error) {
    console.warn("[DPG-305] Failed to delete pending Orange Money deposit.", error);
  }
}

/**
 * Marks one deposit as approved after a successful stored-reference claim.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, deposit: Record<string, unknown>, normalizedPhone: string, referenceId: string, transactionId: string | null }} input - Approval input.
 * @returns {Promise<void>}
 */
async function markOrangeMoneyDepositApproved(input) {
  const { error } = await input.admin
    .from("deposits")
    .update({
      admin_note: AUTO_APPROVED_ADMIN_NOTE,
      metadata: withOrangeMoneyMetadata(input.deposit.metadata, input.referenceId, {
        orange_money_claim_source: "stored_sms",
        orange_money_confirmed_phone: input.normalizedPhone,
      }),
      reviewed_at: new Date().toISOString(),
      status: "approved",
    })
    .eq("id", input.deposit.id);

  if (error) {
    throw new Error(AUTO_APPROVE_ERROR_MESSAGE);
  }
}

/**
 * Builds the public response payload returned to the client.
 *
 * @param {{ autoApproved: boolean, claimOutcome: string, depositId: string, referenceId: string, status: string, userId: string }} input - Response input.
 * @returns {{ autoApproved: boolean, claimOutcome: string, depositId: string, referenceId: string, status: string, userId: string }}
 */
function buildOrangeMoneyDepositResponse(input) {
  return {
    autoApproved: input.autoApproved,
    claimOutcome: input.claimOutcome,
    depositId: input.depositId,
    referenceId: input.referenceId,
    status: input.status,
    userId: input.userId,
  };
}

/**
 * Builds a safe 500 response for unexpected Orange Money deposit failures.
 *
 * @param {string} fallbackMessage - Default public-safe message.
 * @param {unknown} error - Thrown error value.
 * @returns {Response} JSON error response.
 */
function buildOrangeMoneyDepositErrorResponse(fallbackMessage, error) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return errorResponse(message || fallbackMessage, 500);
}

/**
 * Handles POST /api/deposits/orange-money.
 *
 * @param {{
 *   authenticateRequest?: typeof authenticateOrangeMoneyDepositRequest,
 *   createAdminClient?: typeof createSupabaseAdmin,
 *   createPublicClient?: typeof createSupabaseClient,
 *   createPendingDeposit?: typeof createPendingOrangeMoneyDeposit,
 *   deletePendingDeposit?: typeof deletePendingOrangeMoneyDeposit,
 *   findDuplicatePendingDepositMessage?: typeof findDuplicatePendingDepositMessage,
 *   finalizeLog?: typeof finishOrangeMoneyProcessed,
 *   markDepositApproved?: typeof markOrangeMoneyDepositApproved,
 *   reserveStoredClaimLog?: typeof reserveStoredClaimLog,
 *   releaseStoredClaimLog?: typeof releaseStoredClaimLog,
 *   validateStoredClaim?: typeof validateStoredClaim,
 *   walletTopup?: typeof applyWalletDeposit,
 * }} dependencies - Optional test overrides.
 * @returns {{ onRequestOptions: (context: EventContext) => Response, onRequestPost: (context: EventContext) => Promise<Response> }} Route handlers.
 */
export function createOrangeMoneyDepositHandlers(dependencies = {}) {
  const authenticateRequest = dependencies.authenticateRequest || authenticateOrangeMoneyDepositRequest;
  const createAdminClient = dependencies.createAdminClient || createSupabaseAdmin;
  const createPendingDeposit = dependencies.createPendingDeposit || createPendingOrangeMoneyDeposit;
  const deletePendingDeposit = dependencies.deletePendingDeposit || deletePendingOrangeMoneyDeposit;
  const finalizeLog = dependencies.finalizeLog || finishOrangeMoneyProcessed;
  const markDepositApproved = dependencies.markDepositApproved || markOrangeMoneyDepositApproved;
  const publicClientFactory = dependencies.createPublicClient || createSupabaseClient;
  const releaseReservedLog = dependencies.releaseStoredClaimLog || releaseStoredClaimLog;
  const reserveClaimLog = dependencies.reserveStoredClaimLog || reserveStoredClaimLog;
  const validateClaim = dependencies.validateStoredClaim || validateStoredClaim;
  const walletTopup = dependencies.walletTopup || applyWalletDeposit;
  const findPendingConflict = dependencies.findDuplicatePendingDepositMessage || findDuplicatePendingDepositMessage;

  return {
    onRequestOptions(context) {
      return handlePreflight(context.request, ORANGE_MONEY_DEPOSIT_METHODS);
    },

    async onRequestPost(context) {
      const { env, request } = context;
      let rawBody = "";

      try {
        rawBody = await readOrangeMoneyDepositBody(request);
      } catch (error) {
        return withCors(errorResponse(error instanceof Error ? error.message : INVALID_BODY_MESSAGE, 413), request, ORANGE_MONEY_DEPOSIT_METHODS);
      }

      const response = await withIdempotency({
        env,
        request,
        requestBody: rawBody,
        scope: "orange-money-deposit",
        handler: async () => {
          const auth = await authenticateRequest({
            createClient: publicClientFactory,
            env,
            request,
          });
          if (auth.error || !auth.user) {
            return errorResponse(auth.error || INVALID_SESSION_MESSAGE, 401);
          }

          let input;
          try {
            input = parseOrangeMoneyDepositBody(rawBody);
          } catch (error) {
            void error;
            return errorResponse(INVALID_BODY_MESSAGE, 400);
          }

          const validationError = validateOrangeMoneyDepositInput(input);
          if (validationError) {
            return errorResponse(validationError, 400);
          }

          const admin = createAdminClient(env);
          const normalizedPhone = normalizeDepositPayerPhone(input.payerPhone);
          const pendingConflict = await findPendingConflict({
            admin,
            amount: input.amount,
            normalizedPhone,
            userId: auth.user.id,
          });
          if (pendingConflict) {
            return errorResponse(pendingConflict, 409);
          }

          let storedLog = null;
          if (input.referenceId) {
            const storedClaim = await validateClaim({
              admin,
              amount: input.amount,
              env,
              normalizedPhone,
              referenceId: input.referenceId,
            });
            if (storedClaim.error) {
              return errorResponse(storedClaim.error, getStoredClaimStatusCode(storedClaim.error));
            }
            storedLog = storedClaim.log;
          }

          let deposit = null;
          try {
            deposit = await createPendingDeposit({
              admin,
              amount: input.amount,
              metadata: buildOrangeMoneyDepositMetadata({
                payerPhone: normalizedPhone,
                referenceId: input.referenceId,
              }),
              userId: auth.user.id,
            });
          } catch (error) {
            console.error("[DPG-303] Orange Money deposit creation failed.", error);
            return buildOrangeMoneyDepositErrorResponse(CREATE_DEPOSIT_ERROR_MESSAGE, error);
          }

          if (!deposit?.id) {
            return buildOrangeMoneyDepositErrorResponse(CREATE_DEPOSIT_ERROR_MESSAGE, null);
          }

          if (!input.referenceId || !storedLog?.id) {
            return successResponse({
              data: buildOrangeMoneyDepositResponse({
                autoApproved: false,
                claimOutcome: "pending_waiting_sms",
                depositId: deposit.id,
                referenceId: input.referenceId,
                status: "pending",
                userId: auth.user.id,
              }),
            }, 201);
          }

          const reserved = await reserveClaimLog({
            admin,
            depositId: deposit.id,
            logId: storedLog.id,
            userId: auth.user.id,
          });
          if (!reserved) {
            await deletePendingDeposit({ admin, depositId: deposit.id });
            return errorResponse(CLAIM_REFERENCE_RACE_MESSAGE, 409);
          }

          let transactionId = null;
          try {
            transactionId = await walletTopup({
              admin,
              amount: input.amount,
              referenceId: input.referenceId,
              userId: auth.user.id,
            });
          } catch (error) {
            await releaseReservedLog({ admin, depositId: deposit.id, logId: storedLog.id });
            await deletePendingDeposit({ admin, depositId: deposit.id });
            return errorResponse(error instanceof Error ? error.message : AUTO_APPROVE_ERROR_MESSAGE, 500);
          }

          try {
            await markDepositApproved({
              admin,
              deposit,
              normalizedPhone,
              referenceId: input.referenceId,
              transactionId,
            });
            await finalizeLog({
              admin,
              logId: storedLog.id,
              result: {
                targetId: deposit.id,
                targetType: "deposit",
                transactionId,
                userId: auth.user.id,
              },
            });
          } catch (error) {
            console.error("[DPG-304] Orange Money stored-claim finalization failed.", error);
            return buildOrangeMoneyDepositErrorResponse(AUTO_APPROVE_ERROR_MESSAGE, error);
          }

          return successResponse({
            data: buildOrangeMoneyDepositResponse({
              autoApproved: true,
              claimOutcome: "stored_reference_matched",
              depositId: deposit.id,
              referenceId: input.referenceId,
              status: "approved",
              userId: auth.user.id,
            }),
          }, 201);
        },
      });

      return withCors(response, request, ORANGE_MONEY_DEPOSIT_METHODS);
    },
  };
}

const handlers = createOrangeMoneyDepositHandlers();

export const onRequestOptions = handlers.onRequestOptions;
export const onRequestPost = handlers.onRequestPost;
