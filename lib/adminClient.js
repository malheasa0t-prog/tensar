'use client';

import { supabase } from '@/lib/supabaseClient';

export async function getAdminAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export async function adminFetch(path, options = {}) {
  const token = await getAdminAccessToken();
  if (!token) {
    throw new Error('يجب تسجيل الدخول أولاً.');
  }

  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, {
    ...options,
    headers,
  });

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }

  if (!response.ok || json?.success === false) {
    throw new Error(json?.error || 'تعذر تنفيذ الطلب.');
  }

  return json?.data;
}
