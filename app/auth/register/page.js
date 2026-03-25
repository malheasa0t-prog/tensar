'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import AppIcon from '@/components/AppIcon';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function mapAuthError(err) {
    const message = err?.message || '';
    if (message === 'User already registered') return 'هذا البريد مسجل بالفعل';
    if (message.includes('Failed to fetch')) {
      return 'تعذر الاتصال بخدمة المصادقة. تأكد من إعدادات Supabase ثم أعد المحاولة.';
    }
    return message || 'حدث خطأ غير متوقع أثناء إنشاء الحساب';
  }

  async function handleRegister(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      setLoading(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName?.trim() || null,
            phone: phone?.trim() || null,
            country: country?.trim() || null,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(mapAuthError(authError));
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(mapAuthError(err));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <section className="auth-shell">
        <div className="surface-panel auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-icon">
            <AppIcon name="mail" size={28} />
          </div>
          <h2 style={{ marginBottom: '0.75rem' }}>تحقق من بريدك الإلكتروني</h2>
          <p className="auth-subcopy" style={{ marginBottom: '1.25rem' }}>
            تم إرسال رابط التفعيل إلى <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
          </p>
          <Link href="/auth/login" className="btn btn-secondary">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-shell">
      <div className="surface-panel auth-card">
        <div className="auth-head">
          <div className="auth-icon">
            <AppIcon name="badge-check" size={28} />
          </div>
          <h1>إنشاء حساب جديد</h1>
          <p className="auth-subcopy">أنشئ حسابك للوصول إلى الطلبات والمحفظة وخدمات المتابعة.</p>
        </div>

        {error ? <div className="form-alert error">{error}</div> : null}

        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-field">
            <label htmlFor="full_name">الاسم الكامل</label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="الاسم الكامل"
              className="form-input"
            />
          </div>

          <div className="field-grid">
            <div className="form-field">
              <label htmlFor="register_phone">رقم الهاتف</label>
              <input
                id="register_phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="07XXXXXXXX"
                className="form-input"
                dir="ltr"
              />
            </div>

            <div className="form-field">
              <label htmlFor="register_country">الدولة</label>
              <input
                id="register_country"
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="الأردن"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="register_email">البريد الإلكتروني</label>
            <input
              id="register_email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@email.com"
              className="form-input"
              dir="ltr"
            />
          </div>

          <div className="field-grid">
            <div className="form-field">
              <label htmlFor="register_password">كلمة المرور</label>
              <input
                id="register_password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6 أحرف على الأقل"
                className="form-input"
                dir="ltr"
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirm_password">تأكيد كلمة المرور</label>
              <input
                id="confirm_password"
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="أعد كتابة كلمة المرور"
                className="form-input"
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={loading ? 'btn btn-primary btn-block is-loading' : 'btn btn-primary btn-block'}
          >
            <AppIcon name="badge-check" size={16} />
            {loading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
          </button>
        </form>

        <p className="auth-footer-copy">
          لديك حساب بالفعل؟ <Link href="/auth/login">تسجيل الدخول</Link>
        </p>
      </div>
    </section>
  );
}
