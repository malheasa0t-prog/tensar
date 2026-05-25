/**
 * Registration form helpers.
 */

export const FULL_NAME_REQUIRED_MESSAGE = 'أدخل الاسم الكامل';
export const FULL_NAME_INVALID_MESSAGE = 'الاسم يجب أن يحتوي على حرفين على الأقل';
export const PHONE_REQUIRED_MESSAGE = 'أدخل رقم الهاتف';
export const PHONE_INVALID_MESSAGE = 'أدخل رقم هاتف صحيح';
export const COUNTRY_INVALID_MESSAGE = 'اسم الدولة غير صالح';
export const PASSWORD_MISMATCH_MESSAGE = 'كلمتا المرور غير متطابقتين';
// Increased from 6 → 10 to match the login form policy. The minimum is also
// enforced by Supabase via the `password_min_length` Auth setting.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_TOO_SHORT_MESSAGE = `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
export const DEFAULT_REGISTER_ERROR_MESSAGE = 'حدث خطأ غير متوقع أثناء إنشاء الحساب';
export const REGISTER_SUBMISSION_ACCEPTED_MESSAGE =
  'إذا كان البريد صالحاً ولم يكن هناك حساب نشط، ستصلك رسالة التفعيل إليه.';

const PHONE_PATTERN = /^\+?\d{8,15}$/;
const COUNTRY_PATTERN = /^[\p{L}\s.'-]{2,56}$/u;

/**
 * Normalizes a registration phone number to a compact transport-safe value.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeRegisterPhone(value) {
  const trimmedValue = typeof value === 'string' ? value.trim() : '';
  if (!trimmedValue) {
    return '';
  }

  const compactValue = trimmedValue.replace(/[\s()-]+/g, '');
  return compactValue.startsWith('00') ? `+${compactValue.slice(2)}` : compactValue;
}

/**
 * Normalizes profile metadata sent with the registration request.
 *
 * @param {{ fullName?: unknown, phone?: unknown, country?: unknown }} form
 * @returns {{ full_name: string | null, phone: string | null, country: string | null }}
 */
export function normalizeRegisterProfileData(form) {
  const fullName = typeof form?.fullName === 'string' ? form.fullName.trim() : '';
  const phone = normalizeRegisterPhone(form?.phone);
  const country = typeof form?.country === 'string' ? form.country.trim() : '';

  return {
    full_name: fullName || null,
    phone: phone || null,
    country: country || null,
  };
}

/**
 * Validates a registration payload before attempting the auth mutation.
 *
 * @param {{
 *   fullName?: unknown,
 *   phone?: unknown,
 *   country?: unknown,
 *   password?: unknown,
 *   confirmPassword?: unknown,
 * }} form
 * @returns {string | null}
 */
export function validateRegisterForm(form) {
  const fullName = typeof form?.fullName === 'string' ? form.fullName.trim() : '';
  const phone = normalizeRegisterPhone(form?.phone);
  const country = typeof form?.country === 'string' ? form.country.trim() : '';
  const password = typeof form?.password === 'string' ? form.password : '';
  const confirmPassword = typeof form?.confirmPassword === 'string' ? form.confirmPassword : '';

  if (!fullName) {
    return FULL_NAME_REQUIRED_MESSAGE;
  }
  if (fullName.length < 2) {
    return FULL_NAME_INVALID_MESSAGE;
  }
  if (!phone) {
    return PHONE_REQUIRED_MESSAGE;
  }
  if (!PHONE_PATTERN.test(phone)) {
    return PHONE_INVALID_MESSAGE;
  }
  if (country && !COUNTRY_PATTERN.test(country)) {
    return COUNTRY_INVALID_MESSAGE;
  }
  if (password !== confirmPassword) {
    return PASSWORD_MISMATCH_MESSAGE;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }

  return null;
}

/**
 * Detects auth errors that would reveal whether an email is registered.
 *
 * @param {{ message?: unknown } | null | undefined} err
 * @returns {boolean}
 */
export function isRegisterAccountEnumerationError(err) {
  const message = typeof err?.message === 'string' ? err.message.trim().toLowerCase() : '';

  return (
    message === 'user already registered' ||
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('email address is already')
  );
}

/**
 * Maps Supabase auth errors into user-facing Arabic copy.
 *
 * @param {{ message?: unknown } | null | undefined} err
 * @returns {string}
 */
export function mapRegisterAuthError(err) {
  const message = typeof err?.message === 'string' ? err.message.trim() : '';
  const normalizedMessage = message.toLowerCase();

  if (!message) {
    return DEFAULT_REGISTER_ERROR_MESSAGE;
  }
  if (isRegisterAccountEnumerationError(err)) {
    return REGISTER_SUBMISSION_ACCEPTED_MESSAGE;
  }
  if (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('networkerror') ||
    normalizedMessage.includes('load failed')
  ) {
    return 'تعذر الاتصال بخدمة المصادقة. تأكد من إعدادات Supabase ثم أعد المحاولة.';
  }
  if (normalizedMessage.includes('invalid email')) {
    return 'أدخل بريدًا إلكترونيًا صحيحًا';
  }
  if (normalizedMessage.includes('password should be at least')) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }
  if (
    normalizedMessage.includes('signup is disabled') ||
    normalizedMessage.includes('signups not allowed') ||
    normalizedMessage.includes('email provider is disabled')
  ) {
    return 'إنشاء الحسابات الجديدة غير متاح حاليًا';
  }
  if (
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests') ||
    normalizedMessage.includes('over_email_send_rate_limit')
  ) {
    return 'تم تجاوز عدد المحاولات المسموح. انتظر قليلًا ثم أعد المحاولة.';
  }

  return message || DEFAULT_REGISTER_ERROR_MESSAGE;
}
