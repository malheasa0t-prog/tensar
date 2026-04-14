import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_SOCIAL_PROVIDERS,
  LOGIN_EXPERIENCE_PANEL,
  RECOVERY_EXPERIENCE_PANEL,
  isPasswordRecoveryUrl,
  mapLoginAuthError,
  mapOAuthProviderError,
  mapRecoveryAuthError,
  normalizeAuthEmail,
  validateLoginForm,
  validatePasswordResetForm,
  validateRecoveryEmail,
} from "./loginPageModel.js";

test("normalizeAuthEmail should trim and lowercase the email value", () => {
  assert.equal(normalizeAuthEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(normalizeAuthEmail(null), "");
});

test("validateLoginForm should require a valid email and password", () => {
  assert.equal(validateLoginForm({ email: "", password: "123456" }), "أدخل البريد الإلكتروني أولاً.");
  assert.equal(validateLoginForm({ email: "user", password: "123456" }), "أدخل بريدًا إلكترونيًا صحيحًا.");
  assert.equal(validateLoginForm({ email: "user@example.com", password: "" }), "أدخل كلمة المرور أولاً.");
  assert.equal(validateLoginForm({ email: "user@example.com", password: "123456" }), "");
});

test("validateRecoveryEmail and validatePasswordResetForm should cover missing and invalid values", () => {
  assert.equal(validateRecoveryEmail(""), "أدخل بريدك الإلكتروني لإرسال رابط الاستعادة.");
  assert.equal(validateRecoveryEmail("invalid"), "أدخل بريدًا إلكترونيًا صحيحًا.");
  assert.equal(validateRecoveryEmail("user@example.com"), "");

  assert.equal(validatePasswordResetForm({ password: "", confirmPassword: "" }), "أدخل كلمة المرور الجديدة أولاً.");
  assert.equal(validatePasswordResetForm({ password: "123", confirmPassword: "123" }), "يجب أن تكون كلمة المرور 6 أحرف على الأقل.");
  assert.equal(
    validatePasswordResetForm({ password: "123456", confirmPassword: "654321" }),
    "كلمتا المرور غير متطابقتين."
  );
  assert.equal(validatePasswordResetForm({ password: "123456", confirmPassword: "123456" }), "");
});

test("error mappers should return stable localized messages", () => {
  assert.equal(mapLoginAuthError(new Error("Invalid login credentials")), "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
  assert.equal(mapOAuthProviderError({ provider: "Apple", error: "Unsupported provider: provider is not enabled" }), "تسجيل الدخول عبر Apple غير مفعّل حالياً.");
  assert.equal(mapRecoveryAuthError({ context: "reset", error: "Auth session missing!" }), "رابط الاستعادة غير صالح أو انتهت صلاحيته.");
});

test("isPasswordRecoveryUrl should detect recovery links and panel constants should stay populated", () => {
  assert.equal(isPasswordRecoveryUrl("https://example.com/auth/recover#type=recovery&access_token=abc"), true);
  assert.equal(isPasswordRecoveryUrl("https://example.com/auth/login"), false);
  assert.equal(AUTH_SOCIAL_PROVIDERS.length, 3);
  assert.equal(LOGIN_EXPERIENCE_PANEL.features.length, 3);
  assert.equal(RECOVERY_EXPERIENCE_PANEL.stats.length, 3);
});
