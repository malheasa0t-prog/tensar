'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppIcon from '@/components/AppIcon';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';
import {
  mapRegisterAuthError,
  normalizeRegisterProfileData,
  validateRegisterForm,
} from '@/lib/registerModel';

export default function RegisterPage() {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const withAuthCode = (code, message) => String(message || '').startsWith('[') ? message : `[${code}] ${message}`;

  /**
   * Creates a new auth account after validating the registration form.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleRegister(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const validationError = validateRegisterForm({
      fullName,
      phone,
      country,
      password,
      confirmPassword,
    });
    if (validationError) {
      setError(validationError);
      showToast(withAuthCode('AUS-105', validationError), { type: 'warning', title: 'تحقق من البيانات' });
      setLoading(false);
      return;
    }

    try {
      const supabase = await loadSupabaseClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: normalizeRegisterProfileData({ fullName, phone, country }),
          emailRedirectTo: `${window.location.origin}/auth/callback/`,
        },
      });

      if (authError) {
        const nextError = mapRegisterAuthError(authError);
        setError(nextError);
        showToast(withAuthCode('AUS-306', nextError), { type: 'error', title: 'تعذر إنشاء الحساب' });
        setLoading(false);
        return;
      }
    } catch (err) {
      const nextError = mapRegisterAuthError(err);
      setError(nextError);
      showToast(withAuthCode('AUS-306', nextError), { type: 'error', title: 'تعذر إنشاء الحساب' });
      setLoading(false);
      return;
    }

    setSuccess(true);
    showToast('أرسلنا رسالة التفعيل إلى بريدك الإلكتروني.', {
      type: 'success',
      title: 'تم إنشاء الحساب',
    });
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
              required
              minLength={2}
              maxLength={80}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="الاسم الكامل"
              className="form-input"
              autoComplete="name"
            />
          </div>

          <div className="field-grid">
            <div className="form-field">
              <label htmlFor="register_phone">رقم الهاتف</label>
              <input
                id="register_phone"
                type="tel"
                required
                minLength={8}
                maxLength={18}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="07XXXXXXXX"
                className="form-input"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            <div className="form-field">
              <label htmlFor="register_country">الدولة</label>
              <input
                id="register_country"
                type="text"
                maxLength={56}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="الأردن"
                className="form-input"
                autoComplete="country-name"
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
              autoComplete="email"
            />
          </div>

          <div className="field-grid">
            <div className="form-field">
              <label htmlFor="register_password">كلمة المرور</label>
              <input
                id="register_password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6 أحرف على الأقل"
                className="form-input"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirm_password">تأكيد كلمة المرور</label>
              <input
                id="confirm_password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="أعد كتابة كلمة المرور"
                className="form-input"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
          </div>

          <Button type="submit" loading={loading} fullWidth loadingLabel="جاري التسجيل...">
            إنشاء الحساب
          </Button>
        </form>

        <p className="auth-footer-copy">
          لديك حساب بالفعل؟ <Link href="/auth/login">تسجيل الدخول</Link>
        </p>
      </div>
    </section>
  );
}
