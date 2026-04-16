/**
 * Next.js Navigation Compatibility Shim for React Router DOM.
 *
 * Provides usePathname, useRouter, useSearchParams, useParams,
 * notFound, redirect, and ReadonlyURLSearchParams.
 */

import { useLocation, useNavigate, useParams, useSearchParams as useSearchParamsRRD } from 'react-router-dom';

/**
 * Returns the current pathname string.
 *
 * @returns {string}
 */
export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

/**
 * Returns a router-like object matching Next.js useRouter API.
 *
 * @returns {{ push: Function, replace: Function, back: Function, forward: Function, refresh: Function, prefetch: Function }}
 */
export function useRouter() {
  const navigate = useNavigate();

  return {
    push: (url) => navigate(url),
    replace: (url) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}

/**
 * Throws a 404-like error to trigger the not-found boundary.
 *
 * @throws {Error}
 */
export function notFound() {
  const error = new Error('NEXT_NOT_FOUND');
  error.digest = 'NEXT_NOT_FOUND';
  throw error;
}

/**
 * Performs a client-side redirect.
 *
 * @param {string} url
 */
export function redirect(url) {
  window.location.href = url;
}

export { useParams };

/**
 * Returns the current URL search params object (Next.js compatible).
 *
 * React Router returns [params, setter] but Next.js returns params directly.
 *
 * @returns {URLSearchParams}
 */
export function useSearchParams() {
  const [params] = useSearchParamsRRD();
  return params;
}

/**
 * Re-export ReadonlyURLSearchParams as a no-op class for compatibility.
 */
export class ReadonlyURLSearchParams extends URLSearchParams {}
