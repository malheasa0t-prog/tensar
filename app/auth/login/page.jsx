'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppIcon from '@/components/AppIcon';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import AuthProviderButton from '@/components/auth/AuthProviderButton';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import shellStyles from '@/components/auth/AuthAccessShell.module.css';
import { getPostAuthDestination, syncProfileFromAuthUser } from '@/lib/authProfileSync';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';
import {
  AUTH_SOCIAL_PROVIDERS,
  LOGIN_EXPERIENCE_PANEL,
  mapLoginAuthError,
  mapOAuthProviderError,
  validateLoginForm,
} from '@/lib/loginPageModel';

/**
 * Renders the account login page and starts email or OAuth authentication.
 *
 * @returns {import('react').JSX.Element}
 */
export default function LoginPage() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState('');
  const [error, setError] = useState('');
  const hasSocialProviders = AUTH_SOCIAL_PROVIDERS.length > 0;
  const withAuthCode = (code, message) =>
    String(message || '').startsWith('[') ? message : `[${code}] ${message}`;
  const loginSuccessMessage = useMemo(
    () =>
      searchParams.get('reset') === 'success'
        ? 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.'
        : '',
    [searchParams]
  );

  /**
   * Authenticates the user with email and password credentials.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleLogin(event) {
    event.preventDefault();
    const validationError = validateLoginForm({ email, password });

    if (validationError) {
      setError(validationError);
      showToast(withAuthCode('AUS-101', validationError), {
        type: 'warning',
        title: 'تحقق من البيانات',
      });
      return;
    }

    setLoading(true);
    setError('');

    const supabase = await loadSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const nextError = mapLoginAuthError(authError);
      setError(nextError);
      showToast(withAuthCode('AUS-301', nextError), {
        type: 'error',
        title: 'تعذر تسجيل الدخول',
      });
      setLoading(false);
      return;
    }

    await syncProfileFromAuthUser(authData?.user);
    window.location.href = await getPostAuthDestination(authData?.user);
  }

  /**
   * Starts one OAuth login flow through the configured provider.
   *
   * @param {string} provider
   * @returns {Promise<void>}
   */
  async function handleProviderLogin(provider) {
    setActiveProvider(provider);
    setError('');

    const supabase = await loadSupabaseClient();
    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (providerError) {
      const providerLabel =
        AUTH_SOCIAL_PROVIDERS.find((item) => item.provider === provider)?.label.split(' ').pop() ||
        provider;
      const nextError = mapOAuthProviderError({ provider: providerLabel, error: providerError });
      setError(nextError);
      showToast(withAuthCode('AUS-302', nextError), {
        type: 'error',
        title: 'تعذر المتابعة',
      });
      setActiveProvider('');
    }
  }

  return (
    <AuthSplitLayout
      badgeIcon="lock"
      title="تسجيل الدخول"
      description="أدخل بريدك الإلكتروني وكلمة المرور للمتابعة."
      panel={LOGIN_EXPERIENCE_PANEL}
      footer={
        <p className="auth-footer-copy">
          ليس لديك حساب؟ <Link href="/auth/register">إنشاء حساب جديد</Link>
        </p>
      }
      formChildren={
        <>
          {loginSuccessMessage ? <div className="form-alert success">{loginSuccessMessage}</div> : null}
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
                autoComplete="email"
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
                autoComplete="current-password"
              />
            </div>

            <div className={shellStyles.helperRow}>
              <span className={shellStyles.inlineHint}>
                <AppIcon name="shield-check" size={14} />
                دخول آمن إلى حسابك
              </span>

              <Link
                href={email.trim() ? `/auth/recover?email=${encodeURIComponent(email.trim())}` : '/auth/recover'}
                className={shellStyles.forgotLink}
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            <Button
              type="submit"
              disabled={Boolean(activeProvider)}
              loading={loading}
              fullWidth
              loadingLabel="جارٍ تسجيل الدخول..."
            >
              دخول إلى الحساب
            </Button>
          </form>

          {hasSocialProviders ? <div className="auth-divider">أو</div> : null}

          {hasSocialProviders ? (
            <div className={shellStyles.socialSection}>
              <div className={shellStyles.socialGrid}>
                {AUTH_SOCIAL_PROVIDERS.map((provider) => (
                  <AuthProviderButton
                    key={provider.provider}
                    provider={provider.provider}
                    label={provider.label}
                    isLoading={activeProvider === provider.provider}
                    disabled={loading}
                    onClick={() => void handleProviderLogin(provider.provider)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      }
    />
  );
}
