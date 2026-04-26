import { loadSiteSettingsClient } from "../lib/siteSettingsClient.js";
import { validateDepositAmount } from "../lib/depositPageModel.js";
import { uploadDepositProof } from "./depositProofService.js";

export const LOGIN_REQUIRED_MESSAGE = "[DPG-201] يجب تسجيل الدخول أولاً";
const LOAD_DEPOSITS_ERROR_MESSAGE = "[DPG-301] تعذر تحميل سجل الإيداعات.";

/**
 * Loads the authenticated user's deposit history and current deposit settings.
 *
 * @param {{ client: { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }, from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data?: unknown[], error?: { message?: string } | null }> } } } }, loadSettings?: typeof loadSiteSettingsClient }} input
 * @returns {Promise<{ userId: string, deposits: unknown[], depositTransfer: Record<string, unknown> }>}
 * @throws {Error}
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
  };
}

/**
 * Creates a manual deposit request for the authenticated user.
 *
 * @param {{ client: { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }, from: (table: string) => { insert: (rows: unknown[]) => Promise<{ error?: { message?: string } | null }> } }, amount: unknown, proofFile?: File | null, uploadProof?: typeof uploadDepositProof }} input
 * @returns {Promise<{ userId: string }>}
 * @throws {Error}
 */
export async function createDepositRequest({
  client,
  amount,
  proofFile,
  uploadProof = uploadDepositProof,
}) {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error(LOGIN_REQUIRED_MESSAGE);
  }

  const amountValidationError = validateDepositAmount(amount);
  if (amountValidationError) {
    throw new Error(amountValidationError);
  }
  const numericAmount = Number(amount);

  const proofReference = await uploadProof({
    client,
    proofFile,
    userId: user.id,
  });
  const { error } = await client.from("deposits").insert([
    {
        user_id: user.id,
        amount: numericAmount,
        method: "manual",
        proof_url: proofReference,
        status: "pending",
      },
    ]);

  if (error) {
    throw new Error(`[DPG-302] فشل إنشاء طلب الإيداع: ${error.message || "خطأ غير معروف."}`);
  }

  return { userId: user.id };
}
