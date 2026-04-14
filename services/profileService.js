import { supabase } from '@/lib/supabaseClient';

/**
 * Retrieves the current access token from Supabase auth.
 *
 * @returns {Promise<string | null>}
 */
export async function getProfileAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Loads the current user's profile snapshot from the account API.
 *
 * @returns {Promise<{ email: string, profile: Record<string, unknown> | null }>}
 */
export async function fetchProfileSnapshot() {
  const token = await getProfileAccessToken();
  if (!token) {
    return {
      email: '',
      profile: null,
    };
  }

  const response = await fetch('/api/account/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || 'تعذر تحميل الملف الشخصي');
  }

  return {
    email: json.data?.email || '',
    profile: json.data?.profile || null,
  };
}

/**
 * Persists profile edits through the account API.
 *
 * @param {Record<string, unknown>} form
 * @returns {Promise<string>}
 */
export async function saveProfileSnapshot(form) {
  const token = await getProfileAccessToken();
  if (!token) {
    throw new Error('انتهت الجلسة، سجل الدخول مرة أخرى');
  }

  const response = await fetch('/api/account/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(form),
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || 'تعذر حفظ البيانات');
  }

  return json?.message || 'تم حفظ التغييرات بنجاح';
}

/**
 * Updates the current user's password through the account API.
 *
 * @param {{ current_password: string, new_password: string, confirm_password: string }} form
 * @returns {Promise<string>}
 */
export async function saveProfilePassword(form) {
  const token = await getProfileAccessToken();
  if (!token) {
    throw new Error('انتهت الجلسة، سجل الدخول مرة أخرى');
  }

  const response = await fetch('/api/account/password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(form),
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || 'تعذر تغيير كلمة المرور');
  }

  return json?.message || 'تم تغيير كلمة المرور بنجاح';
}
