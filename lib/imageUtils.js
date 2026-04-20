/**
 * Shared storefront image optimization helpers.
 */

const fallbackSupabaseUrl = 'http://127.0.0.1:54321';
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl;
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_QUALITY = 80;
const IMAGE_PROXY_PATH = '/api/img';
const SERVA_HOSTS = Object.freeze(['serva-s.com', 'www.serva-s.com']);
const UNSPLASH_HOST = 'images.unsplash.com';

/**
 * Builds the allowed remote-host list for browser image rendering.
 *
 * @returns {Set<string>}
 */
function collectAllowedHosts() {
  const hosts = new Set([UNSPLASH_HOST, ...SERVA_HOSTS]);

  try {
    hosts.add(new URL(rawSupabaseUrl).hostname.toLowerCase());
  } catch {}

  return hosts;
}

/**
 * Clamps a numeric parameter to a safe integer range.
 *
 * @param {number | string | undefined} value
 * @param {{ fallback: number, max: number, min: number }} options
 * @returns {number}
 */
function clampImageParam(value, { fallback, max, min }) {
  const numericValue = Math.round(Number(value) || fallback);
  return Math.min(max, Math.max(min, numericValue));
}

/**
 * Builds the same-origin proxy URL used for remote provider images.
 *
 * @param {{ quality?: number, src: string, width?: number }} options
 * @returns {string}
 */
function buildProxyImageUrl({ quality, src, width }) {
  const proxyUrl = new URL(IMAGE_PROXY_PATH, 'https://techzone.local');
  proxyUrl.searchParams.set('url', src);
  proxyUrl.searchParams.set(
    'w',
    String(clampImageParam(width, { fallback: DEFAULT_IMAGE_WIDTH, max: 2200, min: 320 }))
  );
  proxyUrl.searchParams.set(
    'q',
    String(clampImageParam(quality, { fallback: DEFAULT_IMAGE_QUALITY, max: 95, min: 50 }))
  );
  proxyUrl.searchParams.set('format', 'webp');
  return `${proxyUrl.pathname}${proxyUrl.search}`;
}

const allowedRemoteHosts = collectAllowedHosts();

/**
 * Determines whether a given image source can be optimized safely.
 *
 * @param {string} src
 * @returns {boolean}
 */
export function isOptimizableImageSrc(src) {
  if (!src || typeof src !== 'string') {
    return false;
  }

  if (src.startsWith('/')) {
    return true;
  }

  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return false;
  }

  try {
    const url = new URL(src);
    return allowedRemoteHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Normalizes remote image URLs before rendering them through the storefront.
 *
 * @param {{ quality?: number, src: string, width?: number }} options
 * @returns {string}
 */
export function optimizeImageSrc({
  quality = DEFAULT_IMAGE_QUALITY,
  src,
  width = DEFAULT_IMAGE_WIDTH,
}) {
  if (!src || typeof src !== 'string') {
    return '';
  }

  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();

    if (SERVA_HOSTS.includes(hostname)) {
      return buildProxyImageUrl({ quality, src, width });
    }

    if (hostname !== UNSPLASH_HOST) {
      return src;
    }

    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('fm', 'webp');
    url.searchParams.set(
      'q',
      String(clampImageParam(quality, { fallback: DEFAULT_IMAGE_QUALITY, max: 95, min: 50 }))
    );
    url.searchParams.set(
      'w',
      String(clampImageParam(width, { fallback: DEFAULT_IMAGE_WIDTH, max: 2200, min: 320 }))
    );
    return url.toString();
  } catch {
    return src;
  }
}
