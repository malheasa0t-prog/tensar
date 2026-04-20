import { buildCorsHeaders } from '../_lib/cors.js';

/**
 * Cloudflare Pages Function - Image proxy and lightweight transformer.
 *
 * Proxies images from approved providers and requests a WebP transform when
 * Cloudflare image resizing is available.
 *
 * @param {EventContext} context
 */

const ALLOWED_HOSTS = ['serva-s.com', 'www.serva-s.com'];
const CACHE_MAX_AGE = 7 * 24 * 60 * 60;
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_QUALITY = 80;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const VALID_FORMATS = new Set(['avif', 'jpeg', 'png', 'webp']);

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
 * @returns {Promise<Response>}
 */
async function fetchUpstreamImage(imageUrl, requestUrl) {
  return fetch(imageUrl, {
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

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const rawUrl = requestUrl.searchParams.get('url');

  if (!rawUrl) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return Response.json({ error: 'Only HTTPS allowed' }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return Response.json({ error: 'Domain not allowed' }, { status: 403 });
  }

  try {
    const response = await fetchUpstreamImage(parsed.toString(), requestUrl);

    if (!response.ok) {
      return Response.json({ error: `Upstream ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || 'image/webp';
    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      return Response.json({ error: 'Image too large' }, { status: 413 });
    }

    return new Response(imageBuffer, {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
        'Content-Type': contentType,
        ...buildCorsHeaders(context.request, 'GET, OPTIONS'),
      },
    });
  } catch {
    return Response.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
