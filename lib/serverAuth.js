import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabaseServer';
import { ADMIN_DEV_BYPASS } from '@/lib/adminFeature';
import { canAccessAdminRecord } from '@/lib/adminRoles';

export async function getUserFromRequest(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) {
    return { user: null, error: 'Missing bearer token' };
  }

  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }

  return { user, error: null };
}

export async function getUserProfileByUserId(userId) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return { profile: data || null, error };
}

export async function getLegacyAppUserByEmail(email) {
  if (!email) {
    return { legacyUser: null, error: null };
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, full_name, email, role, status')
    .ilike('email', email)
    .maybeSingle();

  return { legacyUser: data || null, error };
}

export async function isAdminUser(userId, userEmail = '') {
  if (ADMIN_DEV_BYPASS) {
    return true;
  }

  const { profile } = await getUserProfileByUserId(userId);
  if (canAccessAdminRecord(profile)) {
    return true;
  }

  const { legacyUser } = await getLegacyAppUserByEmail(userEmail);
  return canAccessAdminRecord(legacyUser);
}

export async function requireAdminRequest(request) {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const admin = await isAdminUser(user.id, user.email || '');
  if (!admin) {
    return {
      user,
      errorResponse: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, errorResponse: null };
}
