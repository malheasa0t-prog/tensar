/**
 * Password change form helpers.
 */

export const INVALID_CURRENT_PASSWORD_MESSAGE = 'كلمة المرور الحالية غير صحيحة';
export const MISSING_CURRENT_PASSWORD_MESSAGE = 'أدخل كلمة المرور الحالية';
export const PASSWORD_MISMATCH_MESSAGE = 'كلمتا المرور غير متطابقتين';
export const PASSWORD_REQUIREMENTS_MESSAGE = 'كلمة المرور يجب أن تحتوي على أحرف وأرقام';
export const PASSWORD_TOO_SHORT_MESSAGE = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';

/**
 * Validates a password change request payload before any auth mutation.
 *
 * @param {{
 *   current_password?: unknown,
 *   new_password?: unknown,
 *   confirm_password?: unknown,
 * }} form
 * @returns {string | null}
 */
export function validatePasswordChangeForm(form) {
  const currentPassword = typeof form?.current_password === 'string' ? form.current_password.trim() : '';
  const newPassword = typeof form?.new_password === 'string' ? form.new_password : '';
  const confirmPassword = typeof form?.confirm_password === 'string' ? form.confirm_password : '';

  if (!currentPassword) {
    return MISSING_CURRENT_PASSWORD_MESSAGE;
  }

  if (newPassword.length < 8) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }

  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  if (newPassword !== confirmPassword) {
    return PASSWORD_MISMATCH_MESSAGE;
  }

  return null;
}
