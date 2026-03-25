const ADMIN_PANEL_ROLES = new Set(['super_admin', 'admin', 'technician', 'employee']);

/**
 * Returns true when the provided role is allowed to enter the admin panel.
 *
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function canAccessAdminRole(role) {
  return ADMIN_PANEL_ROLES.has(String(role || '').trim().toLowerCase());
}

/**
 * Returns true when a user-like record is active and has an admin-capable role.
 *
 * @param {{ role?: string | null, status?: string | null } | null | undefined} record
 * @returns {boolean}
 */
export function canAccessAdminRecord(record) {
  if (!record) {
    return false;
  }

  const status = String(record.status || 'active').trim().toLowerCase();
  if (status && status !== 'active') {
    return false;
  }

  return canAccessAdminRole(record.role);
}

/**
 * Picks the best display name for the current admin user.
 *
 * @param {{
 *   profile?: { full_name?: string | null } | null,
 *   legacyUser?: { full_name?: string | null } | null,
 *   fallbackEmail?: string | null,
 * }} params
 * @returns {string}
 */
export function getAdminDisplayName({ profile, legacyUser, fallbackEmail }) {
  return profile?.full_name || legacyUser?.full_name || fallbackEmail || 'Admin';
}
