'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  useEffect(() => {
    async function load() {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/account/wallet', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        setError(json?.error || 'تعذر تحميل بيانات المحفظة');
      } else {
        setWallet(json.data?.wallet || null);
        setTransactions(json.data?.transactions || []);
      }

      setLoading(false);
    }
    load();
  }, []);

  const TYPE_MAP = {
    deposit: { label: 'شحن', icon: '💰', color: '#2ecc71' },
    purchase: { label: 'شراء', icon: '🛒', color: '#e74c3c' },
    refund: { label: 'استرجاع', icon: '↩️', color: '#3498db' },
    admin_adjustment: { label: 'تعديل إداري', icon: '⚙️', color: '#9b59b6' },
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>جاري التحميل...</div>;

  return (
    <div>
      {error && (
        <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '16px', color: '#e74c3c', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Wallet Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0a0e27, #1a1e3a)', borderRadius: '20px',
        padding: '32px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(108,92,231,0.2)' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,210,255,0.15)' }} />
        
        <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '8px' }}>💰 رصيدك الحالي</p>
        <div style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '16px' }}>
          {wallet ? Number(wallet.balance).toFixed(2) : '0.00'} <span style={{ fontSize: '1rem', opacity: 0.7 }}>د.أ</span>
        </div>
        
        <div style={{ display: 'flex', gap: '24px', fontSize: '0.85rem' }}>
          <div>
            <span style={{ opacity: 0.6 }}>إجمالي الشحن: </span>
            <strong>{wallet ? Number(wallet.total_deposited).toFixed(2) : '0.00'} د.أ</strong>
          </div>
          <div>
            <span style={{ opacity: 0.6 }}>إجمالي المصروف: </span>
            <strong>{wallet ? Number(wallet.total_spent).toFixed(2) : '0.00'} د.أ</strong>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: '16px', overflow: 'hidden'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem' }}>📋 سجل الحركات المالية</h3>
        </div>

        {transactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
            لا توجد حركات مالية بعد
          </div>
        ) : (
          <div>
            {transactions.map(txn => {
              const t = TYPE_MAP[txn.type] || { label: txn.type, icon: '•', color: '#666' };
              const isPositive = txn.type === 'deposit' || txn.type === 'refund' || (txn.type === 'admin_adjustment' && txn.amount > 0);
              return (
                <div key={txn.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', borderBottom: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: `${t.color}18`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1.2rem'
                    }}>
                      {t.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{t.label}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {txn.description || '-'} • {new Date(txn.created_at).toLocaleDateString('ar-JO')}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontWeight: '800', fontSize: '1rem',
                    color: isPositive ? '#2ecc71' : '#e74c3c'
                  }}>
                    {isPositive ? '+' : '-'}{Math.abs(txn.amount).toFixed(2)} د.أ
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
