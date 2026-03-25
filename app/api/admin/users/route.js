import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest, isAdminUser } from '@/lib/serverAuth';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';

export const runtime = 'nodejs';

export async function GET(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isAdminUser(user.id);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profileError) {
    return NextResponse.json({ success: false, error: 'Failed to load users' }, { status: 500 });
  }

  const userIds = (profiles || []).map(p => p.user_id);
  const { data: wallets, error: walletError } = await supabaseAdmin
    .from('wallets')
    .select('id,user_id,balance,reserved,total_deposited,total_spent,updated_at')
    .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  if (walletError) {
    return NextResponse.json({ success: false, error: 'Failed to load wallets' }, { status: 500 });
  }

  const walletMap = new Map((wallets || []).map(w => [w.user_id, w]));

  const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailMap = new Map((authUsersData?.users || []).map((u) => [u.id, u.email || null]));

  const result = (profiles || []).map(profile => ({
    ...profile,
    email: emailMap.get(profile.user_id) || null,
    wallet: walletMap.get(profile.user_id) || null,
  }));

  return NextResponse.json({ success: true, data: result });
}
