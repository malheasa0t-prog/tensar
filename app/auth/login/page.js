'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getPostAuthDestination, syncProfileFromAuthUser } from '@/lib/authProfileSync';
import AppIcon from '@/components/AppIcon';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : authError.message
      );
      setLoading(false);
      return;
    }

    await syncProfileFromAuthUser(authData?.user);
    window.location.href = await getPostAuthDestination(authData?.user);
  }

  async function handleGoogleLogin() {
    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (providerError) {
      setError(providerError.message);
    }
  }

  return (
    <section className="auth-shell">
      <div className="surface-panel auth-card">
        <div className="auth-head">
          <div className="auth-icon">
            <AppIcon name="lock" size={28} />
          </div>
          <h1>تسجيل الدخول</h1>
          <p className="auth-subcopy">أدخل بياناتك للوصول إلى حسابك ومتابعة الطلبات بسهولة.</p>
        </div>

        {error ? <div className="form-alert error">{error}</div> : null}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@email.com"
              className="form-input"
              dir="ltr"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="form-input"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={loading ? 'btn btn-primary btn-block is-loading' : 'btn btn-primary btn-block'}
          >
            <AppIcon name="arrow-left" size={16} />
            {loading ? 'جاري تسجيل الدخول...' : 'دخول إلى الحساب'}
          </button>
        </form>

        <div className="auth-divider">أو</div>

        <button
          onClick={handleGoogleLogin}
          className="btn btn-ghost btn-block"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          الدخول عبر Google
        </button>

        <p className="auth-footer-copy">
          ليس لديك حساب؟ <Link href="/auth/register">إنشاء حساب جديد</Link>
        </p>
      </div>
    </section>
  );
}
