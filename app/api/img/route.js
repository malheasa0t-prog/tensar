/**
 * Image Proxy API Route
 *
 * Proxies images from allowed external domains to avoid CORS issues.
 * Caches responses with a long Cache-Control header.
 *
 * Usage: /api/img?url=https://serva-s.com/assets/images/groups/instagram.png
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Allowed hostnames for proxying images. */
const ALLOWED_HOSTS = new Set(['serva-s.com', 'www.serva-s.com']);

/** Maximum image size in bytes (5 MB). */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** Cache duration in seconds (7 days). */
const CACHE_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * Validates and parses the target image URL.
 *
 * @param {string|null} rawUrl - The URL query parameter value
 * @returns {{ valid: true, url: URL } | { valid: false, error: string, status: number }}
 */
function validateImageUrl(rawUrl) {
  if (!rawUrl) {
    return { valid: false, error: 'Missing url parameter', status: 400 };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: 'Invalid URL', status: 400 };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed', status: 400 };
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { valid: false, error: 'Domain not allowed', status: 403 };
  }

  return { valid: true, url: parsed };
}

/**
 * GET /api/img?url=<encoded-image-url>
 *
 * Fetches the image from the external server and returns it with proper headers.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const validation = validateImageUrl(searchParams.get('url'));

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(validation.url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Referer': 'https://serva-s.com/',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Image proxy: upstream ${response.status} for ${validation.url.pathname}`);
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';

    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large' },
        { status: 413 }
      );
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(imageBuffer.byteLength),
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch (err) {
    console.error('Image proxy error:', err.message);
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
