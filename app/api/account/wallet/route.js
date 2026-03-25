import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getUserFromRequest } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request) {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: wallet, error: walletError } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (walletError) {
    return NextResponse.json({ success: false, error: 'Failed to load wallet' }, { status: 500 });
  }

  const { data: transactions, error: txError } = await supabaseAdmin
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (txError) {
    return NextResponse.json({ success: false, error: 'Failed to load transactions' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      wallet,
      transactions: transactions || [],
    },
  });
}
