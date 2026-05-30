/**
 * Canonical admin permission catalog shared by the server (Cloudflare Functions)
 * and the admin dashboard. Defines the grantable "sections", how database tables
 * and RPCs map onto them, and the access-decision helpers.
 *
 * Access model:
 *   - super_admin / admin  -> full access to every section (cannot be limited).
 *   - employee / technician -> only the sections granted in public.staff_permissions,
 *     each with a `view` and/or `manage` level.
 *
 * Enforcement lives at the service-role admin proxy (functions/api/admin/db.js):
 * reads require `view`, mutations and RPCs require `manage`.
 */

/** Roles that always have full, unrestricted panel access. */
export const FULL_ACCESS_ROLES = Object.freeze(["super_admin", "admin"]);

/** Roles allowed to enter the panel at all (full admins + granular staff). */
export const PANEL_STAFF_ROLES = Object.freeze([
  "super_admin",
  "admin",
  "employee",
  "technician",
]);

/**
 * The grantable permission sections, in display order. `key` is the stable
 * identifier persisted in staff_permissions.section and used in grant checks.
 * `manageable: false` marks read-only sections (no meaningful "manage" level).
 * `adminOnly: true` marks sections that can never be delegated to staff.
 */
export const PERMISSION_SECTIONS = Object.freeze([
  { key: "dashboard", label: "لوحة المعلومات", manageable: false },
  { key: "orders", label: "الطلبات", manageable: true },
  { key: "products", label: "المنتجات", manageable: true },
  { key: "categories", label: "الفئات", manageable: true },
  { key: "services", label: "الخدمات", manageable: true },
  { key: "customers", label: "العملاء والمحافظ", manageable: true },
  { key: "sellers", label: "البائعون", manageable: true },
  { key: "deposits", label: "الإيداعات", manageable: true },
  { key: "coupons", label: "الكوبونات", manageable: true },
  { key: "refunds", label: "طلبات الاسترجاع", manageable: true },
  { key: "messages", label: "رسائل التواصل", manageable: true },
  { key: "chats", label: "الدردشات المباشرة", manageable: true },
  { key: "notifications", label: "الإشعارات", manageable: true },
  { key: "settings", label: "الإعدادات والمنصة", manageable: true },
  { key: "logs", label: "سجل العمليات", manageable: false },
  { key: "staff", label: "إدارة الموظفين", manageable: true, adminOnly: true },
]);

const SECTION_KEYS = new Set(PERMISSION_SECTIONS.map((section) => section.key));

/** Maps each proxy-accessible table to the section that governs it. */
export const TABLE_SECTION_MAP = Object.freeze({
  orders: "orders",
  order_items: "orders",
  service_orders: "orders",
  repair_bookings: "orders",
  products: "products",
  categories: "categories",
  services: "services",
  repair_services: "services",
  app_users: "customers",
  user_profiles: "customers",
  wallets: "customers",
  wallet_transactions: "customers",
  seller_category_discounts: "sellers",
  deposits: "deposits",
  orange_money_logs: "deposits",
  coupons: "coupons",
  refund_requests: "refunds",
  contact_messages: "messages",
  support_conversations: "chats",
  support_chat_messages: "chats",
  notifications: "notifications",
  settings: "settings",
  platform_updates: "settings",
  audit_logs: "logs",
  staff_permissions: "staff",
});

/** Maps each whitelisted RPC to the section + level it requires. */
export const RPC_SECTION_MAP = Object.freeze({
  admin_set_order_status: { section: "orders", level: "manage" },
  admin_approve_deposit: { section: "deposits", level: "manage" },
  admin_adjust_wallet_balance: { section: "customers", level: "manage" },
  admin_approve_refund: { section: "refunds", level: "manage" },
  admin_set_seller_role: { section: "sellers", level: "manage" },
  admin_toggle_customer_status: { section: "customers", level: "manage" },
  admin_set_staff_role: { section: "staff", level: "manage" },
  admin_set_staff_permission: { section: "staff", level: "manage" },
});

/**
 * RPC argument keys that name the acting admin. The proxy overwrites these with
 * the server-verified user id so audit attribution cannot be spoofed.
 */
export const RPC_ACTOR_ARG_KEYS = Object.freeze(["p_admin_user_id", "p_actor_id"]);

/**
 * Returns true when a role string is a full (unrestricted) admin role.
 *
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function isFullAdminRole(role) {
  return FULL_ACCESS_ROLES.includes(String(role || "").trim().toLowerCase());
}

/**
 * Returns true when a role string may enter the panel at all.
 *
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function isPanelStaffRole(role) {
  return PANEL_STAFF_ROLES.includes(String(role || "").trim().toLowerCase());
}

/**
 * Returns true when a section key is part of the canonical catalog.
 *
 * @param {string | null | undefined} section
 * @returns {boolean}
 */
export function isKnownSection(section) {
  return SECTION_KEYS.has(String(section || "").trim().toLowerCase());
}

/**
 * Resolves the governing section for a table name.
 *
 * @param {string | null | undefined} table
 * @returns {string | null}
 */
export function sectionForTable(table) {
  return TABLE_SECTION_MAP[String(table || "").trim()] || null;
}

/**
 * Resolves the section + level requirement for an RPC name.
 *
 * @param {string | null | undefined} functionName
 * @returns {{ section: string, level: string } | null}
 */
export function requirementForRpc(functionName) {
  return RPC_SECTION_MAP[String(functionName || "").trim()] || null;
}

/**
 * Builds a full-access permission context (every section, view + manage).
 *
 * @param {string} [role="admin"]
 * @returns {{ isFullAdmin: true, role: string, permissions: Record<string, { view: boolean, manage: boolean }> }}
 */
export function buildFullAdminContext(role = "admin") {
  const permissions = {};
  for (const section of PERMISSION_SECTIONS) {
    permissions[section.key] = { view: true, manage: true };
  }
  return { isFullAdmin: true, role: String(role || "admin"), permissions };
}

/**
 * Normalizes raw staff_permissions rows into a permission map.
 *
 * @param {Array<{ section?: string, can_view?: boolean, can_manage?: boolean }>} rows
 * @returns {Record<string, { view: boolean, manage: boolean }>}
 */
export function buildPermissionMap(rows) {
  const permissions = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row?.section || "").trim().toLowerCase();
    if (!key) continue;
    const manage = row?.can_manage === true;
    permissions[key] = { view: manage || row?.can_view === true, manage };
  }
  return permissions;
}

/**
 * Decides whether a permission context grants the requested section + level.
 *
 * @param {{ isFullAdmin?: boolean, permissions?: Record<string, { view?: boolean, manage?: boolean }> } | null | undefined} context
 * @param {string} section
 * @param {"view" | "manage"} level
 * @returns {boolean}
 */
export function hasSectionAccess(context, section, level) {
  if (!context) return false;
  if (context.isFullAdmin) return true;

  const grant = context.permissions?.[String(section || "").trim().toLowerCase()];
  if (!grant) return false;
  return level === "manage" ? grant.manage === true : grant.view === true;
}
