/**
 * Shared admin database operations for the secured admin API route.
 */

import { hydrateDepositProofUrls } from "./depositProofUrls.js";
import {
  RPC_ACTOR_ARG_KEYS,
  hasSectionAccess,
  requirementForRpc,
  sectionForTable,
} from "../../../lib/adminPermissions.js";

const PERMISSION_DENIED_MESSAGE = "[ADB-403] لا تملك صلاحية للوصول إلى هذا القسم.";

/**
 * Asserts the caller's permission context grants the requested section + level.
 *
 * A null/undefined context means "no enforcement" — this only happens on the
 * legacy/test path; the real admin proxy always supplies a resolved context.
 *
 * @param {{ isFullAdmin?: boolean, permissions?: Record<string, unknown> } | null | undefined} context
 * @param {string | null} section
 * @param {"view" | "manage"} level
 * @returns {void}
 * @throws {Error}
 */
function assertSectionAccess(context, section, level) {
  if (!context) return;
  if (!section || !hasSectionAccess(context, section, level)) {
    throw createRouteError(PERMISSION_DENIED_MESSAGE, 403);
  }
}

const ALLOWED_FILTER_TYPES = new Set(["eq", "ilike", "in", "not"]);
const ALLOWED_MUTATION_ACTIONS = new Set(["delete", "insert", "update", "upsert"]);
const APP_USERS_SAFE_COLUMNS = Object.freeze([
  "id",
  "auth_user_id",
  "full_name",
  "email",
  "phone",
  "role",
  "status",
  "created_at",
  "updated_at",
]);
const APP_USERS_SAFE_COLUMNS_SELECT = APP_USERS_SAFE_COLUMNS.join(",");
const ALLOWED_ADMIN_READ_TABLES = new Set([
  "app_users",
  "audit_logs",
  "categories",
  "contact_messages",
  "coupons",
  "deposits",
  "notifications",
  "order_items",
  "orange_money_logs",
  "orders",
  "products",
  "refund_requests",
  "repair_bookings",
  "repair_services",
  "seller_category_discounts",
  "service_orders",
  "services",
  "settings",
  "staff_permissions",
  "support_chat_messages",
  "support_conversations",
  "user_profiles",
  "wallet_transactions",
  "wallets",
]);
const ALLOWED_ADMIN_MUTATION_TABLES = new Set([
  "audit_logs",
  "categories",
  "contact_messages",
  "coupons",
  "deposits",
  "notifications",
  "order_items",
  "orders",
  "products",
  "refund_requests",
  "repair_bookings",
  "repair_services",
  "seller_category_discounts",
  "service_orders",
  "services",
  "settings",
  "support_chat_messages",
  "support_conversations",
]);
const ALLOWED_RPC_FUNCTIONS = new Set([
  "admin_adjust_wallet_balance",
  "admin_approve_deposit",
  "admin_approve_refund",
  "admin_set_order_status",
  "admin_set_seller_role",
  "admin_set_staff_permission",
  "admin_set_staff_role",
  "admin_toggle_customer_status",
]);
/**
 * Builds one normalized route validation error.
 *
 * @param {string} message
 * @param {number} [status=400]
 * @returns {Error & { statusCode: number }}
 */
export function createRouteError(message, status = 400) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

/**
 * Parses one JSON request body for admin DB operations.
 *
 * @param {Request} request
 * @returns {Promise<Record<string, unknown>>}
 * @throws {Error}
 */
export async function parseAdminDbBody(request) {
  try {
    return await request.json();
  } catch (error) {
    void error;
    throw createRouteError("[ADB-101] بيانات عملية الإدارة غير صالحة.", 400);
  }
}

/**
 * Normalizes admin read columns for tables that require explicit field allowlists.
 *
 * @param {{ columns?: unknown, table: string }} input
 * @returns {string} Safe column selection string.
 * @throws {Error}
 */
function resolveReadColumns(input) {
  const table = String(input?.table || "").trim();
  const requestedColumns = String(input?.columns || "*").trim() || "*";
  if (table !== "app_users") {
    return requestedColumns;
  }

  if (requestedColumns === "*" || !requestedColumns) {
    return APP_USERS_SAFE_COLUMNS_SELECT;
  }

  const requestedList = requestedColumns.split(",").map((value) => value.trim()).filter(Boolean);
  const hasUnsafeColumn = requestedList.some((column) => (
    column === "*"
    || !APP_USERS_SAFE_COLUMNS.includes(column)
  ));
  if (hasUnsafeColumn) {
    throw createRouteError("[ADB-113] Unsupported app_users column selection.", 400);
  }

  return requestedList.join(",");
}

/**
 * Applies supported chained filters to one Supabase query builder.
 *
 * @param {Record<string, unknown>} builder
 * @param {Array<{ column?: string, operator?: string, type?: string, value?: unknown }>} filters
 * @returns {Record<string, unknown>}
 * @throws {Error}
 */
function applyFilters(builder, filters) {
  return (Array.isArray(filters) ? filters : []).reduce((query, filter) => {
    const filterType = String(filter?.type || "").trim();
    const column = String(filter?.column || "").trim();

    if (!ALLOWED_FILTER_TYPES.has(filterType) || !column || typeof query?.[filterType] !== "function") {
      throw createRouteError("[ADB-104] فلتر طلب الإدارة غير مدعوم.", 400);
    }

    if (filterType === "not") {
      const operator = String(filter?.operator || "").trim();
      if (!operator) {
        throw createRouteError("[ADB-104] فلتر طلب الإدارة غير مدعوم.", 400);
      }

      return query.not(column, operator, filter?.value);
    }

    return query[filterType](column, filter?.value);
  }, builder);
}

/**
 * Applies supported sort modifiers to one read query.
 *
 * @param {Record<string, unknown>} builder
 * @param {Array<{ ascending?: boolean, column?: string }>} orders
 * @returns {Record<string, unknown>}
 * @throws {Error}
 */
function applyOrders(builder, orders) {
  return (Array.isArray(orders) ? orders : []).reduce((query, orderConfig) => {
    const column = String(orderConfig?.column || "").trim();
    if (!column || typeof query?.order !== "function") {
      throw createRouteError("[ADB-110] ترتيب القراءة المطلوب غير صالح.", 400);
    }

    return query.order(column, { ascending: orderConfig?.ascending !== false });
  }, builder);
}

/**
 * Applies supported read modifiers to one query.
 *
 * @param {Record<string, unknown>} builder
 * @param {Record<string, unknown>} operation
 * @returns {Record<string, unknown>}
 * @throws {Error}
 */
function applyReadModifiers(builder, operation) {
  let query = applyOrders(builder, operation?.orders);
  const limit = Number(operation?.limit);

  if (Number.isFinite(limit) && limit > 0) {
    if (typeof query?.limit !== "function") {
      throw createRouteError("[ADB-111] الحد المطلوب غير مدعوم لهذا الاستعلام.", 400);
    }
    query = query.limit(limit);
  }

  if (operation?.single === true) {
    return query.single();
  }

  if (operation?.maybeSingle === true) {
    return query.maybeSingle();
  }

  return query;
}

/**
 * Validates one admin read target table.
 *
 * @param {string} table
 * @returns {void}
 * @throws {Error}
 */
function validateAllowedReadTable(table) {
  if (!ALLOWED_ADMIN_READ_TABLES.has(table)) {
    throw createRouteError("[ADB-103] الجدول المطلوب غير مسموح لعمليات الأدمن.", 403);
  }
}

/**
 * Validates one admin mutation target table.
 *
 * @param {string} table
 * @returns {void}
 * @throws {Error}
 */
function validateAllowedMutationTable(table) {
  if (!ALLOWED_ADMIN_MUTATION_TABLES.has(table)) {
    throw createRouteError("[ADB-103] الجدول المطلوب غير مسموح لعمليات الأدمن.", 403);
  }
}

const ORDERS_TABLE = "orders";
const ORDER_STATUS_GUARDED_COLUMNS = Object.freeze(["status"]);

/**
 * Asserts that an admin mutation does not bypass the state-machine RPC.
 *
 * Updates and upserts on the `orders` table must NOT touch the `status`
 * column directly — those go through `admin_set_order_status` so legal
 * transitions and audit logging are enforced consistently. Insert paths
 * are still allowed so legacy seeders keep working.
 *
 * @param {{ action: string, table: string, values: unknown }} input - Mutation input.
 * @returns {void}
 * @throws {Error}
 */
function assertOrderStatusGuard({ action, table, values }) {
  if (table !== ORDERS_TABLE) return;
  if (action !== "update" && action !== "upsert") return;

  const candidate = Array.isArray(values) ? values[0] : values;
  if (!candidate || typeof candidate !== "object") return;
  const violating = ORDER_STATUS_GUARDED_COLUMNS.some((column) => column in candidate);
  if (violating) {
    throw createRouteError(
      "[ADB-114] لا يمكن تحديث حالة الطلب مباشرة. استخدم /api/admin/orders/status.",
      400
    );
  }
}

/**
 * Validates one mutation payload before it reaches the database.
 *
 * @param {Record<string, unknown>} operation
 * @returns {void}
 * @throws {Error}
 */
function validateMutation(operation) {
  const action = String(operation?.action || "").trim();
  const table = String(operation?.table || "").trim();

  if (!ALLOWED_MUTATION_ACTIONS.has(action)) {
    throw createRouteError("[ADB-102] نوع عملية الإدارة غير مدعوم.", 400);
  }

  validateAllowedMutationTable(table);
  assertOrderStatusGuard({ action, table, values: operation?.values });
}

/**
 * Executes one privileged admin read query.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {Record<string, unknown>} operation
 * @returns {Promise<{ count: number | null, data: unknown, error: { message: string } | null }>}
 */
async function executeReadOperation(client, operation, context) {
  const table = String(operation?.table || "").trim();
  validateAllowedReadTable(table);
  assertSectionAccess(context, sectionForTable(table), "view");

  const columns = resolveReadColumns({ columns: operation?.columns, table });
  let query = client.from(table).select(columns);
  query = applyFilters(query, operation?.filters);
  query = applyReadModifiers(query, operation);

  const result = await query;
  if (result?.error) {
    console.error("[ADB-112] Admin read failed.", { table, error: result.error });
  }
  return {
    count: Number.isFinite(result?.count) ? result.count : null,
    data: table === "deposits"
      ? await hydrateDepositProofUrls(client, result?.data ?? null)
      : result?.data ?? null,
    error: result?.error
      ? { message: "[ADB-112] فشلت عملية القراءة الآمنة." }
      : null,
  };
}

/**
 * Executes one privileged admin mutation.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {Record<string, unknown>} operation
 * @returns {Promise<{ count: number | null, data: unknown, error: { message: string } | null }>}
 */
async function executeMutationOperation(client, operation, context) {
  validateMutation(operation);

  const action = String(operation.action);
  const table = String(operation.table);

  // audit_logs inserts are a logging side effect of other actions — any panel
  // user that reached this point may write them. Every other mutation requires
  // `manage` on the table's governing section.
  const isAuditLogSideEffect = table === "audit_logs" && action === "insert";
  if (!isAuditLogSideEffect) {
    assertSectionAccess(context, sectionForTable(table), "manage");
  }
  const values = operation.values ?? null;
  const options = operation.options && typeof operation.options === "object" ? operation.options : undefined;
  let query = client.from(table);

  query = action === "delete"
    ? query.delete()
    : action === "insert"
      ? query.insert(values, options)
      : action === "update"
        ? query.update(values, options)
        : query.upsert(values, options);

  query = applyFilters(query, operation.filters);

  const selectColumns = String(operation?.select || "").trim();
  if (selectColumns) {
    query = query.select(selectColumns);
  }

  if (operation?.single === true) {
    query = query.single();
  } else if (operation?.maybeSingle === true) {
    query = query.maybeSingle();
  }

  const result = await query;
  if (result?.error) {
    console.error("[ADB-105] Admin mutation failed.", { action, table, error: result.error });
  }
  return {
    count: Number.isFinite(result?.count) ? result.count : null,
    data: result?.data ?? null,
    error: result?.error
      ? { message: "[ADB-105] فشلت عملية الكتابة الآمنة." }
      : null,
  };
}

/**
 * Executes one whitelisted admin RPC call.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {Record<string, unknown>} operation
 * @returns {Promise<{ count: number | null, data: unknown, error: { message: string } | null }>}
 * @throws {Error}
 */
async function executeRpcOperation(client, operation, context) {
  const functionName = String(operation?.functionName || "").trim();
  if (!ALLOWED_RPC_FUNCTIONS.has(functionName)) {
    throw createRouteError("[ADB-106] دالة الإدارة المطلوبة غير مسموح بها.", 403);
  }

  const requirement = requirementForRpc(functionName);
  assertSectionAccess(context, requirement?.section || null, requirement?.level || "manage");

  const args = { ...(operation?.args && typeof operation.args === "object" ? operation.args : {}) };
  // Bind the verified caller id to the audited actor argument so attribution
  // cannot be spoofed by a crafted request body (SECURITY-AUDIT follow-up).
  const actorId = String(context?.userId || "").trim();
  if (actorId) {
    for (const key of RPC_ACTOR_ARG_KEYS) {
      if (key in args) {
        args[key] = actorId;
      }
    }
  }
  const result = await client.rpc(functionName, args);
  if (result?.error) {
    console.error("[ADB-107] Admin RPC failed.", { functionName, error: result.error });
  }
  return {
    count: null,
    data: result?.data ?? null,
    error: result?.error
      ? { message: "[ADB-107] فشل تنفيذ إجراء الإدارة الحالي." }
      : null,
  };
}

/**
 * Executes one normalized admin DB operation.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {Record<string, unknown>} operation
 * @returns {Promise<{ count: number | null, data: unknown, error: { message: string } | null }>}
 * @throws {Error}
 */
export async function executeAdminOperation(client, operation, context) {
  const operationType = String(operation?.type || "").trim();
  if (operationType === "read") {
    return executeReadOperation(client, operation, context);
  }

  if (operationType === "rpc") {
    return executeRpcOperation(client, operation, context);
  }

  if (operationType !== "mutation") {
    throw createRouteError("[ADB-100] نوع طلب الإدارة غير معروف.", 400);
  }

  return executeMutationOperation(client, operation, context);
}
