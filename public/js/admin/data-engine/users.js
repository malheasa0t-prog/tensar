// ===== TechZone Admin Data Engine - Users =====
// User mapping, role checks, and admin access helpers.

import { ADMIN_SECTIONS, ROLES, db } from './core.js?v=20260530-2';

const ALLOWED_ADMIN_SECTIONS = new Set([
    'dashboard',
    'orders',
    'product-orders',
    'service-orders',
    'accessory-orders',
    'repair-orders',
    'products',
    'categories',
    'main-categories',
    'subcategories',
    'services',
    'repair-services',
    'customers',
    'messages',
    'contact-messages',
    'chats',
    'support-chats',
    'notifications',
    'deposits',
    'orange-money',
    'coupons',
    'refunds',
    'sellers',
    'provider-alerts',
    'platform-updates',
    'serva-catalog',
    'settings',
    'logs',
    'audit-logs',
    'staff'
]);

function normalizeRole(role) {
    const normalizedRole = String(role || 'user').toLowerCase();
    return normalizedRole === 'customer' ? 'user' : normalizedRole;
}

function normalizeUserMergeKey(user) {
    const authUserId = String(user?.authUserId || user?.id || '').trim().toLowerCase();
    if (authUserId) return authUserId;

    const email = String(user?.email || '').trim().toLowerCase();
    if (email) return email;

    return String(user?.profileId || '').trim().toLowerCase();
}

export function mapUser(row) {
    const authUserId = row.user_id || row.auth_user_id || row.id;

    return {
        id: authUserId,
        profileId: row.id,
        authUserId: authUserId,
        fullName: row.full_name || row.name || row.email || 'مستخدم',
        email: row.email || '',
        phone: row.phone || '',
        country: row.country || '',
        bio: row.bio || '',
        avatarUrl: row.avatar_url || '',
        preferredLanguage: row.preferred_language || 'ar',
        preferredCurrency: row.preferred_currency || 'JOD',
        lastLoginAt: row.last_login_at || null,
        role: normalizeRole(row.role),
        status: row.status || 'active',
        createdAt: row.created_at,
        updatedAt: row.updated_at || null
    };
}

export function mergeUsers(profileRows = [], legacyRows = []) {
    const mergedUsers = new Map();

    profileRows.forEach((row) => {
        const mappedUser = mapUser(row);
        mergedUsers.set(normalizeUserMergeKey(mappedUser), mappedUser);
    });

    legacyRows.forEach((row) => {
        const mappedUser = mapUser(row);
        const mergeKey = normalizeUserMergeKey(mappedUser);
        const existingUser = mergedUsers.get(mergeKey);
        if (!existingUser) {
            mergedUsers.set(mergeKey, mappedUser);
            return;
        }

        mergedUsers.set(mergeKey, {
            ...mappedUser,
            ...existingUser,
            id: existingUser.id || mappedUser.id,
            authUserId: existingUser.authUserId || mappedUser.authUserId,
            profileId: existingUser.profileId || mappedUser.profileId,
            email: existingUser.email || mappedUser.email || '',
            phone: existingUser.phone || mappedUser.phone || '',
            fullName: existingUser.fullName || mappedUser.fullName,
            role: existingUser.role || mappedUser.role,
            status: existingUser.status || mappedUser.status
        });
    });

    return Array.from(mergedUsers.values());
}

export function getUserById(userId) {
    return db.users.find((user) => user.id === userId);
}

export function findUserByAuthUser(authUser) {
    if (!authUser) return null;
    return db.users.find((user) => (
        user.authUserId === authUser.id
        || (user.email && authUser.email && user.email.toLowerCase() === authUser.email.toLowerCase())
    )) || null;
}

export function isCustomerUser(user) {
    if (!user) return false;
    return !['admin', 'super_admin', 'employee', 'technician'].includes(user.role);
}

export function canAccessAdmin(user) {
    if (!user || user.status !== 'active') return false;
    return Boolean(ROLES[user.role]?.level >= 3);
}

export function canAccessSection(user, sectionId) {
    if (!user || user.status !== 'active') return false;
    if (!ALLOWED_ADMIN_SECTIONS.has(sectionId)) return false;
    const role = ROLES[user.role];
    const section = ADMIN_SECTIONS.find((entry) => entry.id === sectionId);
    return Boolean(role && section && role.level >= section.minLevel);
}
