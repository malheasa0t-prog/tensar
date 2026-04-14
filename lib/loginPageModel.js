/**
 * Shared view-model helpers for authentication entry pages.
 */

const LOGIN_ERROR_MESSAGE = "تعذر إكمال تسجيل الدخول حالياً. حاول مرة أخرى بعد قليل.";
const PROVIDER_ERROR_MESSAGE = "تعذر بدء تسجيل الدخول عبر المزود المختار حالياً.";
const RECOVERY_ERROR_MESSAGE = "تعذر تنفيذ طلب استعادة كلمة المرور حالياً.";
const RESET_ERROR_MESSAGE = "تعذر تحديث كلمة المرور حالياً.";
const MINIMUM_PASSWORD_LENGTH = 6;

export const AUTH_SOCIAL_PROVIDERS = Object.freeze([
  Object.freeze({ provider: "google", label: "الدخول عبر Google" }),
  Object.freeze({ provider: "facebook", label: "الدخول عبر Facebook" }),
  Object.freeze({ provider: "apple", label: "الدخول عبر Apple" }),
]);

export const LOGIN_EXPERIENCE_PANEL = Object.freeze({
  eyebrow: "وصول أسرع",
  title: "الدخول يفتح لك الطلبات والمفضلة والإشعارات في مكان واحد.",
  description: "تابع الطلبات، راجع عمليات الإيداع، واستلم تحديثات الصيانة فور حدوثها من لوحة واحدة.",
  stats: Object.freeze([
    Object.freeze({ value: "24/7", label: "إشعارات ومتابعة" }),
    Object.freeze({ value: "3", label: "قنوات دخول جاهزة" }),
    Object.freeze({ value: "1", label: "لوحة موحدة لكل خدماتك" }),
  ]),
  features: Object.freeze([
    Object.freeze({
      icon: "shopping-bag",
      title: "متابعة الطلبات لحظة بلحظة",
      description: "حالة الطلب، الشحن، والتحديثات المهمة تظهر مباشرة داخل حسابك.",
    }),
    Object.freeze({
      icon: "heart",
      title: "مفضلة وسلة محفوظتان",
      description: "عد لاحقاً وستجد المنتجات التي راقبتها أو أضفتها جاهزة للمتابعة.",
    }),
    Object.freeze({
      icon: "message-circle",
      title: "دردشة وإشعارات فورية",
      description: "ردود الإدارة والتنبيهات الخاصة بحسابك تصلك من نفس الواجهة.",
    }),
  ]),
});

export const RECOVERY_EXPERIENCE_PANEL = Object.freeze({
  eyebrow: "استعادة آمنة",
  title: "استرجع الوصول إلى حسابك بخطوات واضحة وسريعة.",
  description: "سنرسل رابطاً آمنًا إلى بريدك الإلكتروني، وبعدها يمكنك اختيار كلمة مرور جديدة وإكمال الدخول.",
  stats: Object.freeze([
    Object.freeze({ value: "1", label: "رابط آمن إلى بريدك" }),
    Object.freeze({ value: "2", label: "خطوتان فقط للاستعادة" }),
    Object.freeze({ value: "100%", label: "جلسة مشفّرة وآمنة" }),
  ]),
  features: Object.freeze([
    Object.freeze({
      icon: "mail",
      title: "رابط استعادة خاص بك",
      description: "لا نرسل كلمة المرور نفسها، بل رابطًا مؤقتًا وآمنًا لإعادة تعيينها.",
    }),
    Object.freeze({
      icon: "shield-check",
      title: "حماية أفضل للحساب",
      description: "بمجرد حفظ الكلمة الجديدة يمكنك العودة للدخول من أي جهاز بشكل طبيعي.",
    }),
    Object.freeze({
      icon: "lock",
      title: "تحقق قبل التغيير",
      description: "يتم تحديث كلمة المرور فقط داخل جلسة الاستعادة الصالحة القادمة من البريد.",
    }),
  ]),
});

/**
 * Trims and normalizes an authentication email input.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAuthEmail(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Validates the login form before contacting the auth provider.
 *
 * @param {{ email?: unknown, password?: unknown }} input
 * @returns {string}
 */
export function validateLoginForm(input) {
  const email = normalizeAuthEmail(input?.email);
  const password = String(input?.password || "");

  if (!email) return "أدخل البريد الإلكتروني أولاً.";
  if (!email.includes("@")) return "أدخل بريدًا إلكترونيًا صحيحًا.";
  if (!password) return "أدخل كلمة المرور أولاً.";
  return "";
}

/**
 * Validates the email field used for password recovery requests.
 *
 * @param {unknown} email
 * @returns {string}
 */
export function validateRecoveryEmail(email) {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return "أدخل بريدك الإلكتروني لإرسال رابط الاستعادة.";
  if (!normalizedEmail.includes("@")) return "أدخل بريدًا إلكترونيًا صحيحًا.";
  return "";
}

/**
 * Validates the new password form shown after opening a recovery link.
 *
 * @param {{ password?: unknown, confirmPassword?: unknown }} input
 * @returns {string}
 */
export function validatePasswordResetForm(input) {
  const password = String(input?.password || "");
  const confirmPassword = String(input?.confirmPassword || "");

  if (!password) return "أدخل كلمة المرور الجديدة أولاً.";
  if (password.length < MINIMUM_PASSWORD_LENGTH) return "يجب أن تكون كلمة المرور 6 أحرف على الأقل.";
  if (!confirmPassword) return "أعد كتابة كلمة المرور الجديدة للتأكيد.";
  if (password !== confirmPassword) return "كلمتا المرور غير متطابقتين.";
  return "";
}

/**
 * Maps login errors from Supabase to user-friendly Arabic copy.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function mapLoginAuthError(error) {
  const message = String(error instanceof Error ? error.message : error || "").trim();
  if (!message) return LOGIN_ERROR_MESSAGE;
  if (message === "Invalid login credentials") return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (message.toLowerCase().includes("email not confirmed")) return "يرجى تفعيل بريدك الإلكتروني قبل تسجيل الدخول.";
  return message;
}

/**
 * Maps OAuth provider errors into stable user-facing text.
 *
 * @param {{ provider?: string, error?: unknown }} input
 * @returns {string}
 */
export function mapOAuthProviderError(input) {
  const provider = String(input?.provider || "").trim();
  const message = String(input?.error instanceof Error ? input.error.message : input?.error || "").trim();

  if (!message) return PROVIDER_ERROR_MESSAGE;
  if (message.toLowerCase().includes("provider is not enabled")) {
    return `تسجيل الدخول عبر ${provider} غير مفعّل حالياً.`;
  }

  return message;
}

/**
 * Maps recovery and reset errors from Supabase to Arabic copy.
 *
 * @param {{ error?: unknown, context?: "recovery" | "reset" }} input
 * @returns {string}
 */
export function mapRecoveryAuthError(input) {
  const message = String(input?.error instanceof Error ? input.error.message : input?.error || "").trim();

  if (!message) {
    return input?.context === "reset" ? RESET_ERROR_MESSAGE : RECOVERY_ERROR_MESSAGE;
  }

  if (message.toLowerCase().includes("same password")) return "اختر كلمة مرور جديدة مختلفة عن الحالية.";
  if (message.toLowerCase().includes("session")) return "رابط الاستعادة غير صالح أو انتهت صلاحيته.";
  return message;
}

/**
 * Detects whether the current URL belongs to a Supabase password recovery flow.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPasswordRecoveryUrl(value) {
  const input = String(value || "");
  return input.includes("type=recovery") || input.includes("access_token=");
}
