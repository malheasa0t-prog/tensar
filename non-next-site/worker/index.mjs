import { handleAdminOrderStatusRequest } from "./routes/adminOrderStatus.mjs";
import { handleAdminRuntimeRequest } from "./routes/adminRuntime.mjs";
import { handleChatRequest } from "./routes/chat.mjs";
import { handleCheckoutRequest } from "./routes/checkout.mjs";
import { handleDepositProofRequest } from "./routes/depositProof.mjs";
import { handleOrderLookupRequest } from "./routes/orderLookup.mjs";
import { handleOrderCreateRequest } from "./routes/orderCreate.mjs";
import { handleOrderSyncRequest } from "./routes/orderSync.mjs";
import { handlePasswordRequest } from "./routes/password.mjs";
import { handleProfileGetRequest, handleProfilePatchRequest } from "./routes/profile.mjs";
import { handleProviderBalanceRequest, handleProviderServicesRequest } from "./routes/provider.mjs";
import { errorResponse, jsonResponse } from "./lib/http.mjs";

/**
 * Dispatches API requests to the new Cloudflare Worker routes.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
async function handleApiRequest(request, env) {
  const { method } = request;
  const url = new URL(request.url);

  if (method === "GET" && url.pathname === "/api/health") {
    return jsonResponse({ success: true, runtime: "cloudflare-worker" });
  }
  if (method === "GET" && url.pathname === "/api/admin/runtime") {
    return handleAdminRuntimeRequest(env);
  }
  if (method === "POST" && url.pathname === "/api/chat") {
    return handleChatRequest(request, env);
  }
  if (method === "POST" && url.pathname === "/api/checkout") {
    return handleCheckoutRequest(request, env);
  }
  if (method === "POST" && url.pathname === "/api/deposits/proof") {
    return handleDepositProofRequest(request, env);
  }
  if (method === "GET" && url.pathname === "/api/account/profile") {
    return handleProfileGetRequest(request, env);
  }
  if (method === "PATCH" && url.pathname === "/api/account/profile") {
    return handleProfilePatchRequest(request, env);
  }
  if (method === "POST" && url.pathname === "/api/account/password") {
    return handlePasswordRequest(request, env);
  }
  if (method === "POST" && url.pathname === "/api/orders/lookup") {
    return handleOrderLookupRequest(request, env);
  }
  if (method === "POST" && url.pathname === "/api/orders/create") {
    return handleOrderCreateRequest(request, env);
  }
  if ((method === "GET" || method === "POST") && url.pathname === "/api/orders/sync") {
    return handleOrderSyncRequest(request, env);
  }
  if (method === "GET" && url.pathname === "/api/provider/services") {
    return handleProviderServicesRequest(request, env);
  }
  if (method === "GET" && url.pathname === "/api/provider/balance") {
    return handleProviderBalanceRequest(request, env);
  }
  if (method === "POST" && url.pathname === "/api/admin/orders/status") {
    return handleAdminOrderStatusRequest(request, env);
  }

  return errorResponse("Not found", 404);
}

export default {
  /**
   * Handles the main worker fetch flow.
   *
   * @param {Request} request
   * @param {Record<string, unknown> & { ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
