import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppIcon from "@/components/AppIcon";
import AuthProviderButton from "@/components/auth/AuthProviderButton";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import shellStyles from "@/components/auth/AuthAccessShell.module.css";
import { supabase } from "@/lib/supabaseClient";
import { getPostAuthDestination, syncProfileFromAuthUser } from "@/lib/authProfileSync";
import {
  AUTH_SOCIAL_PROVIDERS,
  LOGIN_EXPERIENCE_PANEL,
  mapLoginAuthError,
  mapOAuthProviderError,
  validateLoginForm
} from "@/lib/loginPageModel";

/**
 * Renders the customer login route in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function AuthLoginRoute() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState("");
  const [error, setError] = useState("");
  const loginSuccessMessage = useMemo(
    () => (searchParams.get("reset") === "success" ? "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن." : ""),
    [searchParams]
  );

  /**
   * Authenticates the user with email and password credentials.
   *
   * @param {import("react").FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleLogin(event) {
    event.preventDefault();
    const validationError = validateLoginForm({ email, password });

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(mapLoginAuthError(authError));
      setLoading(false);
      return;
    }

    await syncProfileFromAuthUser(authData?.user);
    window.location.href = await getPostAuthDestination(authData?.user);
  }

  /**
   * Starts the OAuth login flow with the selected provider.
   *
   * @param {string} provider
   * @returns {Promise<void>}
   */
  async function handleProviderLogin(provider) {
    setActiveProvider(provider);
    setError("");

    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });

    if (providerError) {
      const providerLabel =
        AUTH_SOCIAL_PROVIDERS.find((item) => item.provider === provider)?.label.split(" ").pop() || provider;
      setError(mapOAuthProviderError({ provider: providerLabel, error: providerError }));
      setActiveProvider("");
    }
  }

  return (
    <AuthSplitLayout
      badgeIcon="lock"
      title="تسجيل الدخول"
      description="ادخل إلى حسابك للوصول إلى الطلبات والمفضلة والإشعارات ومتابعة الصيانة من مكان واحد."
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
                href={email.trim() ? `/auth/recover?email=${encodeURIComponent(email.trim())}` : "/auth/recover"}
                className={shellStyles.forgotLink}
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(activeProvider)}
              className={loading ? "btn btn-primary btn-block is-loading" : "btn btn-primary btn-block"}
            >
              <AppIcon name="arrow-left" size={16} />
              {loading ? "جارٍ تسجيل الدخول..." : "دخول إلى الحساب"}
            </button>
          </form>

          <div className="auth-divider">أو</div>

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
        </>
      }
    />
  );
}
