'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DepositPage() {
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [deposits, setDeposits] = useState([]);

  useEffect(() => {
    async function loadDeposits() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('deposits').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setDeposits(data || []);
    }
    loadDeposits();
  }, [success]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('يجب تسجيل الدخول أولاً'); setLoading(false); return; }

    if (Number(amount) < 1) { setError('الحد الأدنى للشحن 1 د.أ'); setLoading(false); return; }

    let proofUrl = null;

    // Upload proof image if provided
    if (proofFile) {
      const ext = proofFile.name.split('.').pop();
      const fileName = `deposits/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('products').upload(fileName, proofFile);
      if (uploadErr) { setError('فشل رفع الصورة: ' + uploadErr.message); setLoading(false); return; }
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      proofUrl = publicUrl;
    }

    // Create deposit request
    const { error: insertErr } = await supabase.from('deposits').insert([{
      user_id: user.id,
      amount: Number(amount),
      method: 'manual',
      proof_url: proofUrl,
      status: 'pending'
    }]);

    if (insertErr) { setError('فشل إنشاء طلب الإيداع: ' + insertErr.message); setLoading(false); return; }

    setSuccess(true);
    setAmount('');
    setProofFile(null);
    setLoading(false);
    setTimeout(() => setSuccess(false), 4000);
  }

  const STATUS_MAP = {
    pending: { label: 'قيد المراجعة', color: '#f39c12' },
    approved: { label: 'تمت الموافقة', color: '#2ecc71' },
    rejected: { label: 'مرفوض', color: '#e74c3c' },
  };

  const presetAmounts = [5, 10, 25, 50, 100];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
      {/* Deposit Form */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: '20px', overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem' }}>💳 شحن الرصيد يدوياً</h3>
        </div>
        <div style={{ padding: '24px' }}>
          {/* Bank info */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(0,210,255,0.06))',
            borderRadius: '14px', padding: '18px', marginBottom: '20px',
            border: '1px solid rgba(108,92,231,0.15)'
          }}>
            <p style={{ fontWeight: '700', marginBottom: '10px', fontSize: '0.95rem' }}>📌 معلومات التحويل:</p>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
              <div>🏦 البنك: <strong>البنك العربي</strong></div>
              <div>👤 اسم الحساب: <strong>TechZone Store</strong></div>
              <div>🔢 رقم الحساب: <strong style={{ direction: 'ltr', display: 'inline-block' }}>JO94 ARAB 1234 5678 9012 3456 78</strong></div>
            </div>
          </div>

          {success && (
            <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '16px', color: '#2ecc71', textAlign: 'center', fontWeight: '600' }}>
              ✅ تم إرسال طلب الشحن بنجاح! سيتم مراجعته وإضافة رصيدك قريباً.
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '16px', color: '#e74c3c', textAlign: 'center' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>المبلغ (د.أ)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {presetAmounts.map(a => (
                <button key={a} type="button" onClick={() => setAmount(String(a))} style={{
                  padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                  border: amount === String(a) ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: amount === String(a) ? 'var(--primary)' : 'var(--bg-lighter)',
                  color: amount === String(a) ? '#fff' : 'var(--text-color)',
                  fontWeight: '700', fontSize: '0.9rem'
                }}>
                  {a} د.أ
                </button>
              ))}
            </div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" step="0.01" required placeholder="أو أدخل مبلغ مخصص"
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', color: 'var(--text-color)', fontSize: '1rem', marginBottom: '16px', outline: 'none' }}
            />

            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>📷 صورة إثبات التحويل</label>
            <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])}
              style={{ display: 'block', width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-lighter)', marginBottom: '20px' }}
            />

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ جاري الإرسال...' : '🚀 إرسال طلب الشحن'}
            </button>
          </form>
        </div>
      </div>

      {/* Deposit History */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: '20px', overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem' }}>📜 طلبات الشحن السابقة</h3>
        </div>
        {deposits.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد طلبات شحن سابقة</div>
        ) : (
          <div>
            {deposits.map(d => (
              <div key={d.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>{Number(d.amount).toFixed(2)} د.أ</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(d.created_at).toLocaleDateString('ar-JO')}</div>
                </div>
                <span style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', background: `${STATUS_MAP[d.status]?.color}22`, color: STATUS_MAP[d.status]?.color }}>
                  {STATUS_MAP[d.status]?.label || d.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
