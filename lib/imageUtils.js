const fallbackSupabaseUrl = "http://127.0.0.1:54321";
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl;
const DEFAULT_UNSPLASH_WIDTH = 1200;
const DEFAULT_IMAGE_QUALITY = 80;
const UNSPLASH_HOST = "images.unsplash.com";

function collectAllowedHosts() {
  const hosts = new Set([UNSPLASH_HOST]);

  try {
    hosts.add(new URL(rawSupabaseUrl).hostname.toLowerCase());
  } catch {}

  return hosts;
}

const allowedRemoteHosts = collectAllowedHosts();

/**
 * Determines whether a given image source can be optimized by Next/Image.
 *
 * @param {string} src
 * @returns {boolean}
 */
export function isOptimizableImageSrc(src) {
  if (!src || typeof src !== "string") {
    return false;
  }

  if (src.startsWith("/")) {
    return true;
  }

  if (src.startsWith("data:") || src.startsWith("blob:")) {
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
 * Normalizes remote image URLs before rendering them through Next/Image.
 *
 * @param {{ quality?: number, src: string, width?: number }} options
 * @returns {string}
 */
export function optimizeImageSrc({
  quality = DEFAULT_IMAGE_QUALITY,
  src,
  width = DEFAULT_UNSPLASH_WIDTH,
}) {
  if (!src || typeof src !== "string") {
    return "";
  }

  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  try {
    const url = new URL(src);

    if (url.hostname.toLowerCase() !== UNSPLASH_HOST) {
      return src;
    }

    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    url.searchParams.set("q", String(Math.max(1, Math.round(Number(quality) || DEFAULT_IMAGE_QUALITY))));
    url.searchParams.set("w", String(Math.max(320, Math.round(Number(width) || DEFAULT_UNSPLASH_WIDTH))));
    return url.toString();
  } catch {
    return src;
  }
}
