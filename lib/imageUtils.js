/**
 * Shared storefront image optimization helpers.
 */

const fallbackSupabaseUrl = 'http://127.0.0.1:54321';
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl;
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_QUALITY = 80;
const UNSPLASH_HOST = 'images.unsplash.com';
// Supabase image transformations require the Pro plan's render endpoint, so they
// are opt-in. Set NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM=true once available.
const SUPABASE_IMAGE_TRANSFORM_ENABLED =
  String(process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM || '').toLowerCase() === 'true';
const SUPABASE_OBJECT_PATH = '/storage/v1/object/public/';
const SUPABASE_RENDER_PATH = '/storage/v1/render/image/public/';
const RESPONSIVE_IMAGE_WIDTHS = [320, 640, 960, 1280, 1600];

let supabaseHost = '';
try {
  supabaseHost = new URL(rawSupabaseUrl).hostname.toLowerCase();
} catch {}

/**
 * Builds the allowed remote-host list for browser image rendering.
 *
 * @returns {Set<string>}
 */
function collectAllowedHosts() {
  const hosts = new Set([UNSPLASH_HOST]);

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
    const clampedWidth = clampImageParam(width, { fallback: DEFAULT_IMAGE_WIDTH, max: 2200, min: 320 });
    const clampedQuality = clampImageParam(quality, { fallback: DEFAULT_IMAGE_QUALITY, max: 95, min: 50 });

    if (hostname === UNSPLASH_HOST) {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('fm', 'webp');
      url.searchParams.set('q', String(clampedQuality));
      url.searchParams.set('w', String(clampedWidth));
      return url.toString();
    }

    // Supabase Storage: rewrite to the render/image endpoint (WebP + width).
    if (
      SUPABASE_IMAGE_TRANSFORM_ENABLED &&
      hostname === supabaseHost &&
      url.pathname.includes(SUPABASE_OBJECT_PATH)
    ) {
      url.pathname = url.pathname.replace(SUPABASE_OBJECT_PATH, SUPABASE_RENDER_PATH);
      url.searchParams.set('width', String(clampedWidth));
      url.searchParams.set('quality', String(clampedQuality));
      url.searchParams.set('format', 'webp');
      return url.toString();
    }

    return src;
  } catch {
    return src;
  }
}

/**
 * Whether a source can be re-rendered at different widths (worth a srcSet).
 *
 * @param {string} src
 * @returns {boolean}
 */
export function isTransformableImageSrc(src) {
  if (!src || typeof src !== 'string') return false;
  try {
    const hostname = new URL(src).hostname.toLowerCase();
    if (hostname === UNSPLASH_HOST) return true;
    if (SUPABASE_IMAGE_TRANSFORM_ENABLED && hostname === supabaseHost) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Builds a responsive srcSet string for a transformable image source.
 *
 * @param {{ src: string, quality?: number, widths?: number[] }} options
 * @returns {string} A srcSet string, or '' when the source can't be transformed.
 */
export function buildImageSrcSet({ src, quality, widths = RESPONSIVE_IMAGE_WIDTHS }) {
  if (!isTransformableImageSrc(src)) return '';
  return widths
    .map((width) => `${optimizeImageSrc({ quality, src, width })} ${width}w`)
    .join(', ');
}
