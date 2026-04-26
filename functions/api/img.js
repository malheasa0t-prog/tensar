import { buildCorsHeaders } from '../_lib/cors.js';
import { buildErrorPayload } from '../_lib/errorCodes.js';

/**
 * Cloudflare Pages Function - Image proxy and lightweight transformer.
 *
 * Proxies images from approved providers and requests a WebP transform when
 * Cloudflare image resizing is available.
 *
 * @param {EventContext} context
 */
const DEFAULT_ALLOWED_IMAGE_HOSTS = Object.freeze([
  'bayubxlmrgkquwoutwmn.supabase.co',
  'placehold.co',
  'serva-s.com',
]);
const ALLOWED_IMAGE_HOSTS_ENV_KEYS = Object.freeze([
  'IMAGE_PROXY_ALLOWED_HOSTS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
]);
const CACHE_MAX_AGE = 7 * 24 * 60 * 60;
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_QUALITY = 80;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const VALID_FORMATS = new Set(['avif', 'jpeg', 'png', 'webp']);

/**
 * Normalizes a hostname for reliable allow-list comparisons.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalizeHostname(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Extracts a hostname from a raw hostname or full URL string.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function extractHostname(value) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return '';
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    try {
      return normalizeHostname(new URL(normalizedValue).hostname);
    } catch (error) {
      console.warn('[IMG-001] Ignoring invalid allowed host value:', error);
      return '';
    }
  }

  return normalizeHostname(normalizedValue.split('/')[0]);
}

/**
 * Reads the approved external image hosts from defaults and environment.
 *
 * @param {Record<string, string | undefined> | undefined} env
 * @returns {Set<string>}
 */
export function readAllowedImageHosts(env) {
  const hosts = new Set(DEFAULT_ALLOWED_IMAGE_HOSTS.map(normalizeHostname));

  ALLOWED_IMAGE_HOSTS_ENV_KEYS.forEach((envKey) => {
    const rawValue = String(env?.[envKey] ?? '').trim();
    if (!rawValue) {
      return;
    }

    rawValue.split(',').forEach((entry) => {
      const hostname = extractHostname(entry);
      if (hostname) {
        hosts.add(hostname);
      }
    });
  });

  return hosts;
}

/**
 * Parses a bounded integer search parameter.
 *
 * @param {string | null} value
 * @param {{ fallback: number, max: number, min: number }} options
 * @returns {number}
 */
function readIntegerParam(value, { fallback, max, min }) {
  const numericValue = Math.round(Number(value) || fallback);
  return Math.min(max, Math.max(min, numericValue));
}

/**
 * Parses the requested output format while falling back safely to WebP.
 *
 * @param {string | null} value
 * @returns {string}
 */
function readImageFormat(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return VALID_FORMATS.has(normalizedValue) ? normalizedValue : 'webp';
}

/**
 * Builds the Cloudflare image transformation options for the upstream fetch.
 *
 * @param {URL} url
 * @returns {{ fit: string, format: string, metadata: string, quality: number, width: number }}
 */
function buildImageTransformOptions(url) {
  return {
    fit: 'scale-down',
    format: readImageFormat(url.searchParams.get('format')),
    metadata: 'none',
    quality: readIntegerParam(url.searchParams.get('q'), {
      fallback: DEFAULT_IMAGE_QUALITY,
      max: 95,
      min: 50,
    }),
    width: readIntegerParam(url.searchParams.get('w'), {
      fallback: DEFAULT_IMAGE_WIDTH,
      max: 2200,
      min: 320,
    }),
  };
}

/**
 * Fetches the approved upstream image with optional Cloudflare transforms.
 *
 * @param {string} imageUrl
 * @param {URL} requestUrl
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<Response>}
 */
async function fetchUpstreamImage(imageUrl, requestUrl, fetchImpl) {
  return fetchImpl(imageUrl, {
    headers: {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; TechZone/1.0)',
    },
    cf: {
      cacheEverything: true,
      cacheTtl: CACHE_MAX_AGE,
      image: buildImageTransformOptions(requestUrl),
    },
  });
}

/**
 * Builds a JSON error response for the image proxy route.
 *
 * @param {string} errorMessage
 * @param {number} status
 * @returns {Response}
 */
function imageErrorResponse(errorMessage, status) {
  return Response.json(buildErrorPayload(errorMessage), { status });
}

/**
 * Creates the image proxy handler with injectable dependencies for tests.
 *
 * @param {{ fetchImpl?: typeof fetch }} [options={}]
 * @returns {(context: EventContext) => Promise<Response>}
 */
export function createImageProxyHandler(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function onRequestGet(context) {
    const requestUrl = new URL(context.request.url);
    const rawUrl = requestUrl.searchParams.get('url');
    const allowedHosts = readAllowedImageHosts(context.env);

    if (!rawUrl) {
      return imageErrorResponse('[IMG-101] Missing url parameter', 400);
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (error) {
      console.error('[IMG-102] Invalid image proxy URL:', error);
      return imageErrorResponse('[IMG-102] Invalid URL', 400);
    }

    if (parsed.protocol !== 'https:') {
      return imageErrorResponse('[IMG-103] Only HTTPS allowed', 400);
    }

    if (!allowedHosts.has(normalizeHostname(parsed.hostname))) {
      return imageErrorResponse('[IMG-201] Domain not allowed', 403);
    }

    try {
      const response = await fetchUpstreamImage(parsed.toString(), requestUrl, fetchImpl);
      if (!response.ok) {
        return imageErrorResponse(`[IMG-401] Upstream ${response.status}`, 502);
      }

      const contentType = response.headers.get('content-type') || 'image/webp';
      const imageBuffer = await response.arrayBuffer();
      if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
        return imageErrorResponse('[IMG-402] Image too large', 413);
      }

      return new Response(imageBuffer, {
        headers: {
          'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
          'Content-Type': contentType,
          ...buildCorsHeaders(context.request, 'GET, OPTIONS'),
        },
      });
    } catch (error) {
      console.error('[IMG-500] Failed to fetch image:', error);
      return imageErrorResponse('[IMG-500] Failed to fetch image', 500);
    }
  };
}

export const onRequestGet = createImageProxyHandler();
