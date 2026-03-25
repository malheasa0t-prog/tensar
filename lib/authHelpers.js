import { supabase } from './supabaseClient';
import { canAccessAdminRecord } from './adminRoles';

// Get current authenticated user
export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Get user profile with wallet info
export async function getUserProfile(userId) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return profile;
}

// Get legacy app user by email
export async function getLegacyAppUser(email) {
  if (!email) return null;

  const { data: legacyUser } = await supabase
    .from('app_users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  return legacyUser;
}

// Get user wallet
export async function getUserWallet(userId) {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  return wallet;
}

// Check if user is admin
export async function isAdmin(userId, userEmail = '') {
  const profile = await getUserProfile(userId);
  if (canAccessAdminRecord(profile)) {
    return true;
  }

  const legacyUser = await getLegacyAppUser(userEmail);
  return canAccessAdminRecord(legacyUser);
}

// Require auth - returns user or null
export async function requireAuth() {
  const user = await getUser();
  return user;
}

// Format price in Arabic
export function formatPrice(amount) {
  return Number(amount).toLocaleString('ar-JO', { minimumFractionDigits: 2 }) + ' د.أ';
}

// Order status labels in Arabic
export const ORDER_STATUS = {
  pending: { label: 'قيد الانتظار', color: '#f39c12', icon: '⏳' },
  processing: { label: 'جاري المعالجة', color: '#3498db', icon: '🔄' },
  in_progress: { label: 'قيد التنفيذ', color: '#9b59b6', icon: '⚙️' },
  completed: { label: 'مكتمل', color: '#2ecc71', icon: '✅' },
  partial: { label: 'تنفيذ جزئي', color: '#e67e22', icon: '⚠️' },
  failed: { label: 'فشل', color: '#e74c3c', icon: '❌' },
  cancelled: { label: 'ملغي', color: '#95a5a6', icon: '🚫' },
  refunded: { label: 'مسترجع', color: '#1abc9c', icon: '💰' },
};

// Deposit status labels
export const DEPOSIT_STATUS = {
  pending: { label: 'قيد المراجعة', color: '#f39c12', icon: '⏳' },
  approved: { label: 'تمت الموافقة', color: '#2ecc71', icon: '✅' },
  rejected: { label: 'مرفوض', color: '#e74c3c', icon: '❌' },
};
