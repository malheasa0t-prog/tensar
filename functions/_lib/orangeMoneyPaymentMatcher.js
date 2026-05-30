/**
 * Orange Money payment matching and fulfillment helpers.
 */

import { getPhoneSearchTail } from "../../lib/orangeMoneySmsModel.js";
import { normalizeOrangeMoneyReferenceId } from "../../lib/orangeMoneyDepositModel.js";

const MAX_AMOUNT_MATCH_ROWS = 25;

/**
 * Finds the authenticated user whose stored phone matches the SMS payer phone.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} admin - Service role client.
 * @param {string} phone - Normalized phone.
 * @returns {Promise<{ userId: string, phone: string } | null>} Matched user or null.
 */
async function findUserByPhone(admin, phone) {
  const tail = getPhoneSearchTail(phone);
  if (!tail) return null;

  const [profilesResult, legacyResult] = await Promise.all([
    admin.from("user_profiles").select("user_id, phone").ilike("phone", `%${tail}%`).limit(10),
    admin.from("app_users").select("auth_user_id, phone").ilike("phone", `%${tail}%`).limit(10),
  ]);
  const candidates = [
    ...(profilesResult.data || []).map((row) => ({ userId: row.user_id, phone: row.phone })),
    ...(legacyResult.data || []).map((row) => ({ userId: row.auth_user_id, phone: row.phone })),
  ].filter((row) => row.userId);

  // Require an exact phone-tail match. The previous `|| candidates[0]` fallback
  // could credit an arbitrary substring match to the WRONG user's account.
  return candidates.find((row) => getPhoneSearchTail(row.phone) === tail) || null;
}

/**
 * Reads the Orange Money reference id stored on a record's metadata.
 *
 * @param {Record<string, unknown> | null} metadata - Record metadata.
 * @returns {string} Normalized reference id or empty string.
 */
function getMetadataReferenceId(metadata) {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  return normalizeOrangeMoneyReferenceId(source.orange_money_reference_id);
}

/**
 * Builds a metadata object with Orange Money confirmation details.
 *
 * @param {Record<string, unknown> | null} metadata - Current metadata.
 * @param {string} referenceId - Orange Money reference id.
 * @param {Record<string, unknown>} [extraMetadata={}] - Extra metadata to merge.
 * @returns {Record<string, unknown>} Merged metadata.
 */
export function withOrangeMoneyMetadata(metadata, referenceId, extraMetadata = {}) {
  return {
    ...(metadata && typeof metadata === "object" ? metadata : {}),
    ...extraMetadata,
    orange_money_paid_at: new Date().toISOString(),
    orange_money_ref: referenceId,
  };
}

/**
 * Returns the searchable phone suffix stored in deposit metadata.
 *
 * @param {Record<string, unknown> | null} metadata - Deposit metadata.
 * @returns {string} Searchable phone suffix.
 */
function getDepositMetadataPhoneTail(metadata) {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  return getPhoneSearchTail(source.orange_money_payer_phone || source.orange_money_payer_phone_tail);
}

/**
 * Picks the newest candidate by created_at.
 *
 * @param {Array<Record<string, unknown> | null>} candidates - Candidate rows.
 * @returns {Record<string, unknown> | null} Newest candidate.
 */
function pickNewestCandidate(candidates) {
  return candidates
    .filter(Boolean)
    .sort((first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0))[0] || null;
}

/**
 * Finds a pending physical order that matches amount and customer phone.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, phone: string }} input - Lookup input.
 * @returns {Promise<Record<string, unknown> | null>} Matching order or null.
 */
async function findMatchingOrder(input) {
  const tail = getPhoneSearchTail(input.phone);
  if (!tail) return null;

  const { data } = await input.admin
    .from("orders")
    .select("id, user_id, metadata, created_at")
    .eq("payment_method", "wallet")
    .eq("payment_status", "pending")
    .eq("total", input.amount)
    .in("status", ["pending", "awaiting_delivery"])
    .ilike("customer_phone", `%${tail}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  return data?.[0] ? { ...data[0], matchType: "order" } : null;
}

/**
 * Marks a physical order as paid by Orange Money.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, order: Record<string, unknown>, referenceId: string }} input - Update input.
 * @returns {Promise<void>}
 * @throws {Error} When the update fails.
 */
async function markOrderPaid(input) {
  const { error } = await input.admin
    .from("orders")
    .update({
      metadata: withOrangeMoneyMetadata(input.order.metadata, input.referenceId),
      payment_status: "paid",
      status: "processing",
    })
    .eq("id", input.order.id);

  if (error) throw new Error("[SMS-501] فشل تحديث طلب المنتج.");
}

/**
 * Finds a pending digital service order that matches amount and user.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, userId: string }} input - Lookup input.
 * @returns {Promise<Record<string, unknown> | null>} Matching service order or null.
 */
async function findMatchingServiceOrder(input) {
  const { data } = await input.admin
    .from("service_orders")
    .select("id, metadata, user_id, created_at")
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .eq("total", input.amount)
    .order("created_at", { ascending: false })
    .limit(1);

  return data?.[0] || null;
}

/**
 * Marks a digital service order as paid by Orange Money.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, order: Record<string, unknown>, referenceId: string }} input - Update input.
 * @returns {Promise<void>}
 * @throws {Error} When the update fails.
 */
async function markServiceOrderPaid(input) {
  const { error } = await input.admin
    .from("service_orders")
    .update({
      metadata: withOrangeMoneyMetadata(input.order.metadata, input.referenceId),
      status: "processing",
    })
    .eq("id", input.order.id);

  if (error) throw new Error("[SMS-502] فشل تحديث طلب الخدمة.");
}

/**
 * Finds a pending wallet deposit request that matches amount and entered phone.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, phone: string }} input - Lookup input.
 * @returns {Promise<Record<string, unknown> | null>} Matching deposit or null.
 */
async function findMatchingDeposit(input) {
  const tail = getPhoneSearchTail(input.phone);
  if (!tail) return null;

  const { data } = await input.admin
    .from("deposits")
    .select("id, metadata, user_id, created_at")
    .eq("method", "orange_money")
    .eq("status", "pending")
    .eq("amount", input.amount)
    .order("created_at", { ascending: false })
    .limit(MAX_AMOUNT_MATCH_ROWS);

  const rows = Array.isArray(data) ? data : [];

  // 1. Strongest signal: an exact reference-id match is unambiguous. Prefer it
  //    over amount/phone heuristics whenever the SMS carried a reference.
  const smsReference = normalizeOrangeMoneyReferenceId(input.referenceId);
  if (smsReference) {
    const byReference = rows.filter((row) => getMetadataReferenceId(row.metadata) === smsReference);
    if (byReference.length === 1) {
      return { ...byReference[0], matchType: "deposit" };
    }
  }

  // 2. Fall back to amount + phone-tail. If MORE THAN ONE pending deposit shares
  //    the same amount and phone tail the match is ambiguous — skip auto-approval
  //    and leave it for manual review rather than crediting the wrong request.
  const byPhone = rows.filter((row) => getDepositMetadataPhoneTail(row.metadata) === tail);
  if (byPhone.length !== 1) {
    return null;
  }
  return { ...byPhone[0], matchType: "deposit" };
}

/**
 * Applies an Orange Money top-up through the service-role RPC.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, referenceId: string, userId: string }} input - Top-up input.
 * @returns {Promise<string | null>} Wallet transaction id.
 * @throws {Error} When the wallet update fails.
 */
export async function applyWalletDeposit(input) {
  const { data, error } = await input.admin.rpc("apply_orange_money_wallet_deposit", {
    p_amount: input.amount,
    p_description: `Orange Money transfer - Ref: ${input.referenceId}`,
    p_reference_id: input.referenceId,
    p_user_id: input.userId,
  });

  if (error) throw new Error("[SMS-503] فشل شحن المحفظة عبر Orange Money.");

  const row = Array.isArray(data) ? data[0] : data;
  return row?.transaction_id || null;
}

/**
 * Approves a matching deposit and credits the user's wallet.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, deposit: Record<string, unknown>, phone: string, referenceId: string, userId: string }} input - Approval input.
 * @returns {Promise<string | null>} Wallet transaction id.
 * @throws {Error} When the update fails.
 */
async function approveDeposit(input) {
  const transactionId = await applyWalletDeposit(input);
  const { error } = await input.admin
    .from("deposits")
    .update({
      admin_note: "تمت الموافقة تلقائيًا عبر Orange Money SMS",
      metadata: withOrangeMoneyMetadata(input.deposit.metadata, input.referenceId, {
        orange_money_confirmed_phone: input.phone,
      }),
      method: "orange_money",
      reviewed_at: new Date().toISOString(),
      status: "approved",
    })
    .eq("id", input.deposit.id);

  if (error) throw new Error("[SMS-504] فشل اعتماد طلب الإيداع.");
  return transactionId;
}

/**
 * Builds a normalized process result.
 *
 * @param {{ targetId: string, targetType: string, transactionId?: string | null, userId?: string | null }} result - Raw result fields.
 * @returns {{ matched: true, targetId: string, targetType: string, transactionId: string | null, userId: string | null }}
 */
function createMatchedResult(result) {
  return {
    matched: true,
    targetId: result.targetId,
    targetType: result.targetType,
    transactionId: result.transactionId || null,
    userId: result.userId || null,
  };
}

/**
 * Attempts to match and fulfill an Orange Money payment.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, amount: number, phone: string, referenceId: string }} input - Payment input.
 * @returns {Promise<{ matched: false, errorMessage: string } | ReturnType<typeof createMatchedResult>>}
 */
export async function processOrangeMoneyPayment(input) {
  const order = await findMatchingOrder(input);
  const deposit = await findMatchingDeposit(input);
  const newestPayment = pickNewestCandidate([order, deposit]);

  if (newestPayment?.matchType === "order") {
    await markOrderPaid({ admin: input.admin, order: newestPayment, referenceId: input.referenceId });
    return createMatchedResult({ targetId: newestPayment.id, targetType: "order", userId: newestPayment.user_id });
  }

  if (newestPayment?.matchType === "deposit") {
    const transactionId = await approveDeposit({ ...input, deposit: newestPayment, userId: newestPayment.user_id });
    return createMatchedResult({ targetId: newestPayment.id, targetType: "deposit", transactionId, userId: newestPayment.user_id });
  }

  const userMatch = await findUserByPhone(input.admin, input.phone);
  if (userMatch?.userId) {
    const serviceOrder = await findMatchingServiceOrder({ ...input, userId: userMatch.userId });
    if (serviceOrder) {
      await markServiceOrderPaid({ admin: input.admin, order: serviceOrder, referenceId: input.referenceId });
      return createMatchedResult({ targetId: serviceOrder.id, targetType: "service_order", userId: userMatch.userId });
    }
  }

  return { matched: false, errorMessage: "لم يتم العثور على طلب دفع أو طلب إيداع مطابق." };
}

export const orangeMoneyPaymentMatcherTestHooks = {
  createMatchedResult,
  findMatchingDeposit,
  getDepositMetadataPhoneTail,
  getMetadataReferenceId,
  pickNewestCandidate,
  withOrangeMoneyMetadata,
};
