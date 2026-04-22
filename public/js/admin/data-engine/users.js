// ===== TechZone Admin Data Engine - Users =====
// User mapping, role checks, and admin access helpers.

import { ADMIN_SECTIONS, ROLES, db } from './core.js';

const ALLOWED_ADMIN_SECTIONS = new Set([
    'dashboard',
    'orders',
    'product-orders',
    'accessory-orders',
    'products',
    'accessories',
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
    'coupons',
    'settings',
    'logs',
    'audit-logs'
]);

function normalizeRole(role) {
    const normalizedRole = String(role || 'user').toLowerCase();
    return normalizedRole === 'customer' ? 'user' : normalizedRole;
}

export function mapUser(row) {
    return {
        id: row.user_id || row.id,
        profileId: row.id,
        authUserId: row.user_id || row.id,
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
        passwordHash: row.password_hash,
        createdAt: row.created_at,
        updatedAt: row.updated_at || null
    };
}

export function mergeUsers(profileRows = [], legacyRows = []) {
    const mergedUsers = new Map();

    profileRows.forEach((row) => {
        const mappedUser = mapUser(row);
        mergedUsers.set(mappedUser.id, mappedUser);
    });

    legacyRows.forEach((row) => {
        const mappedUser = mapUser(row);
        const mergeKey = mappedUser.authUserId || mappedUser.email || mappedUser.id;
        const existingUser = mergedUsers.get(mergeKey);
        if (!existingUser) {
            mergedUsers.set(mergeKey, mappedUser);
            return;
        }

        mergedUsers.set(mergeKey, {
            ...mappedUser,
            ...existingUser,
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
