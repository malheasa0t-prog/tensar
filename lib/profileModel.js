export const PROFILE_FORM_DEFAULTS = {
  full_name: '',
  phone: '',
  country: '',
  preferred_language: 'ar',
  preferred_currency: 'JOD',
};

export const PASSWORD_FORM_DEFAULTS = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

/**
 * Normalizes the profile payload returned by the account API.
 *
 * @param {Record<string, unknown> | null | undefined} profile
 * @returns {typeof PROFILE_FORM_DEFAULTS}
 */
export function createProfileFormState(profile) {
  return {
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    country: profile?.country || '',
    preferred_language: profile?.preferred_language || 'ar',
    preferred_currency: profile?.preferred_currency || 'JOD',
  };
}

/**
 * Detects whether the password message is a success variant.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isProfileSuccessMessage(value) {
  return String(value || '').includes('تم');
}
