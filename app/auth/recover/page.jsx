'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppIcon from '@/components/AppIcon';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import shellStyles from '@/components/auth/AuthAccessShell.module.css';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';
import {
  RECOVERY_EXPERIENCE_PANEL,
  isPasswordRecoveryUrl,
  mapRecoveryAuthError,
  normalizeAuthEmail,
  validatePasswordResetForm,
  validateRecoveryEmail,
} from '@/lib/loginPageModel';

export default function RecoverPasswordPage() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const initialEmail = useMemo(() => normalizeAuthEmail(searchParams.get('email')), [searchParams]);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const withAuthCode = (code, message) => String(message || '').startsWith('[') ? message : `[${code}] ${message}`;

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    if (typeof window !== 'undefined' && isPasswordRecoveryUrl(window.location.href)) {
      setMode('reset');
    }

    /**
     * Attaches the password-recovery auth listener after loading Supabase.
     *
     * @returns {Promise<void>}
     */
    async function attachRecoveryListener() {
      const supabase = await loadSupabaseClient();

      if (!active) {
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMode('reset');
          setError('');
        }
      });

      unsubscribe = () => subscription.unsubscribe();
    }

    void attachRecoveryListener();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /**
   * Sends the password recovery link to the submitted email address.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleRecoveryRequest(event) {
    event.preventDefault();
    const validationError = validateRecoveryEmail(email);

    if (validationError) {
      setError(validationError);
      showToast(withAuthCode('AUS-103', validationError), { type: 'warning', title: 'تحقق من البريد' });
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    const supabase = await loadSupabaseClient();
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/recover`,
    });

    if (recoveryError) {
      const nextError = mapRecoveryAuthError({ context: 'recovery', error: recoveryError });
      setError(nextError);
      showToast(withAuthCode('AUS-303', nextError), { type: 'error', title: 'تعذر إرسال الرابط' });
      setLoading(false);
      return;
    }

    const nextSuccessMessage = `أرسلنا رابط الاستعادة إلى ${email}. افتح بريدك الإلكتروني ثم عد لإكمال التغيير.`;
    setSuccessMessage(nextSuccessMessage);
    showToast(`أرسلنا رابط الاستعادة إلى ${email}.`, {
      type: 'success',
      title: 'تم إرسال الرابط',
    });
    setLoading(false);
  }

  /**
   * Updates the password after a valid recovery session has been established.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handlePasswordReset(event) {
    event.preventDefault();
    const validationError = validatePasswordResetForm({ password, confirmPassword });

    if (validationError) {
      setError(validationError);
      showToast(withAuthCode('AUS-104', validationError), { type: 'warning', title: 'تحقق من كلمة المرور' });
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    const supabase = await loadSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      const nextError = 'رابط الاستعادة غير صالح أو انتهت صلاحيته.';
      setError(nextError);
      showToast(withAuthCode('AUS-304', nextError), { type: 'error', title: 'تعذر التحقق من الرابط' });
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      const nextError = mapRecoveryAuthError({ context: 'reset', error: updateError });
      setError(nextError);
      showToast(withAuthCode('AUS-305', nextError), { type: 'error', title: 'تعذر تحديث كلمة المرور' });
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.href = '/auth/login?reset=success';
  }

  return (
    <AuthSplitLayout
      badgeIcon={mode === 'reset' ? 'shield-check' : 'mail'}
      title={mode === 'reset' ? 'اختيار كلمة مرور جديدة' : 'استعادة كلمة المرور'}
      description={
        mode === 'reset'
          ? 'أدخل كلمة المرور الجديدة مرتين ثم احفظ التغيير للعودة إلى حسابك بأمان.'
          : 'أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور.'
      }
      panel={RECOVERY_EXPERIENCE_PANEL}
      footer={
        <div className={shellStyles.actionRow}>
          <Link href="/auth/login" className={shellStyles.backLink}>
            العودة إلى تسجيل الدخول
          </Link>
          <Link href="/auth/register" className={shellStyles.backLink}>
            إنشاء حساب جديد
          </Link>
        </div>
      }
      formChildren={
        <>
          {error ? <div className="form-alert error">{error}</div> : null}
          {successMessage ? <div className="form-alert success">{successMessage}</div> : null}

          {mode === 'reset' ? (
            <form onSubmit={handlePasswordReset} className={shellStyles.resetGrid}>
              <div className="form-field">
                <label htmlFor="new_password">كلمة المرور الجديدة</label>
                <input
                  id="new_password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="form-input"
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-field">
                <label htmlFor="confirm_new_password">تأكيد كلمة المرور الجديدة</label>
                <input
                  id="confirm_new_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  className="form-input"
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" loading={loading} fullWidth loadingLabel="جارٍ حفظ كلمة المرور...">
                حفظ كلمة المرور الجديدة
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRecoveryRequest} className={shellStyles.resetGrid}>
              <div className="form-field">
                <label htmlFor="recovery_email">البريد الإلكتروني</label>
                <input
                  id="recovery_email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@email.com"
                  className="form-input"
                  dir="ltr"
                  autoComplete="email"
                />
              </div>

              <span className={shellStyles.inlineHint}>
                <AppIcon name="mail" size={14} />
                سنرسل الرابط إلى هذا البريد فقط.
              </span>

              <Button type="submit" loading={loading} fullWidth loadingLabel="جارٍ إرسال الرابط...">
                إرسال رابط الاستعادة
              </Button>
            </form>
          )}
        </>
      }
    />
  );
}
