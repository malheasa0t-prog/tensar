/**
 * Cloudflare Pages Function — Repair Booking gate.
 *
 * Re-validates the form payload server-side so a malicious client cannot
 * bypass the in-browser checks (past dates, malformed phone, unsupported
 * modes, oversized description). The actual DB insert uses the service-role
 * client so RLS does not have to be loosened on `repair_bookings`.
 */

import { handlePreflight, withCors } from "../_lib/cors.js";
import { withIdempotency } from "../_lib/idempotency.js";
import {
  createSupabaseAdmin,
  createSupabaseClient,
  errorResponse,
  extractBearerToken,
  successResponse,
} from "../_lib/supabase.js";
import {
  buildRepairBookingPayload,
  validateRepairBookingForm,
} from "../../lib/repairBookingModel.mjs";

const REPAIR_BOOKING_METHODS = "POST, OPTIONS";
const REPAIR_BOOKING_MAX_BODY_BYTES = 8_000;

/**
 * Reads the optional authenticated user id from the request.
 *
 * @param {Request} request - Incoming request.
 * @param {Record<string, string>} env - Cloudflare bindings.
 * @returns {Promise<string>} Authenticated user id or empty string for guests.
 */
async function resolveOptionalUserId(request, env) {
  const token = extractBearerToken(request);
  if (!token) return "";
  try {
    const client = createSupabaseClient(env);
    const {
      data: { user },
    } = await client.auth.getUser(token);
    return user?.id || "";
  } catch (resolveError) {
    console.warn("[RBK-201] Could not resolve repair booking user.", resolveError);
    return "";
  }
}

/**
 * Generates a stable booking id matching the legacy `bk-xxxxxxxxx` pattern.
 *
 * @returns {string} New booking identifier.
 */
function buildBookingId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `bk-${crypto.randomUUID().replace(/-/g, "").slice(0, 9)}`;
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `bk-${hex.slice(0, 9)}`;
}

/**
 * Maps a repair booking validation/build error to an HTTP response.
 *
 * @param {Error} error - Thrown error.
 * @returns {Response} Public-safe error response.
 */
function mapRepairBookingError(error) {
  const message = String(error?.message || "").trim();
  if (/^\[RBK-10[1-7]\]/.test(message)) {
    return errorResponse(message, 400);
  }
  console.error("[RBK-500] Repair booking failed.", error);
  return errorResponse("[RBK-500] تعذر إرسال طلب الصيانة حاليا. حاول مرة أخرى.", 500);
}

/**
 * Loads the catalog service row associated with the requested id (when any).
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, serviceId: string }} input - Lookup input.
 * @returns {Promise<{ name: string } | null>} Service snapshot or null.
 */
async function loadRepairService({ admin, serviceId }) {
  if (!serviceId) return null;
  const { data } = await admin
    .from("repair_services")
    .select("id,name,status")
    .eq("id", serviceId)
    .maybeSingle();
  if (!data || (data.status && String(data.status).toLowerCase() !== "active")) {
    return null;
  }
  return { name: String(data.name || "").trim() };
}

/**
 * Inserts the booking, optionally tagged with the authenticated user id.
 *
 * @param {{
 *   admin: import("@supabase/supabase-js").SupabaseClient,
 *   payload: Record<string, unknown>,
 *   userId: string,
 * }} input - Insert input.
 * @returns {Promise<{ id: string, display_number?: number | null }>} Inserted row.
 * @throws {Error}
 */
async function persistRepairBooking({ admin, payload, userId }) {
  const insertPayload = userId ? { ...payload, user_id: userId } : payload;
  const { data, error } = await admin
    .from("repair_bookings")
    .insert([insertPayload])
    .select("id, display_number")
    .single();
  if (error) {
    console.error("[RBK-301] Failed to insert repair booking.", error);
    throw new Error("[RBK-301] تعذر إرسال طلب الصيانة حاليا. حاول مرة أخرى.");
  }
  return data || { id: insertPayload.id };
}

/**
 * Runs the validated pipeline.
 *
 * @param {{ env: Record<string, unknown>, rawBody: string, request: Request }} input - Pipeline input.
 * @returns {Promise<Response>} Pipeline response.
 */
async function runRepairBookingPipeline({ env, rawBody, request }) {
  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (parseError) {
    void parseError;
    return errorResponse("[RBK-108] هيكل الطلب غير صالح.", 400);
  }

  const form = {
    name: body?.name,
    phone: body?.phone,
    serviceId: body?.serviceId || body?.service_id,
    description: body?.description,
    mode: body?.mode,
    address: body?.address,
    preferredDate: body?.preferredDate || body?.preferred_date,
  };

  const validationError = validateRepairBookingForm(form);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  try {
    const admin = createSupabaseAdmin(env);
    const service = await loadRepairService({ admin, serviceId: form.serviceId });
    const payload = buildRepairBookingPayload({
      bookingId: buildBookingId(),
      form,
      selectedService: service ? { name: service.name } : null,
    });

    const userId = await resolveOptionalUserId(request, env);
    const inserted = await persistRepairBooking({ admin, payload, userId });

    return successResponse(
      {
        data: {
          id: inserted.id,
          display_number: inserted.display_number || null,
        },
      },
      201
    );
  } catch (error) {
    return mapRepairBookingError(error);
  }
}

/**
 * POST /api/repair-booking — server-side gate for repair bookings.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Promise<Response>} Final response.
 */
export async function onRequestPost(context) {
  const { env, request } = context;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > REPAIR_BOOKING_MAX_BODY_BYTES) {
    return withCors(
      errorResponse("[RBK-109] حجم الطلب كبير جدا.", 413),
      request,
      REPAIR_BOOKING_METHODS
    );
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch (readError) {
    console.error("[RBK-110] Failed to read repair booking body.", readError);
    return withCors(
      errorResponse("[RBK-110] تعذر قراءة بيانات الطلب.", 400),
      request,
      REPAIR_BOOKING_METHODS
    );
  }

  const response = await withIdempotency({
    env,
    request,
    requestBody: rawBody,
    scope: "repair-booking",
    handler: () => runRepairBookingPipeline({ env, rawBody, request }),
  });

  return withCors(response, request, REPAIR_BOOKING_METHODS);
}

/**
 * OPTIONS /api/repair-booking — CORS preflight.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Response} Preflight response.
 */
export function onRequestOptions(context) {
  return handlePreflight(context.request, REPAIR_BOOKING_METHODS);
}
