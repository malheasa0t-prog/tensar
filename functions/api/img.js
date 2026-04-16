/**
 * Cloudflare Pages Function — Image Proxy.
 *
 * Proxies images from allowed external domains.
 *
 * @param {EventContext} context
 */

const ALLOWED_HOSTS = ['serva-s.com', 'www.serva-s.com'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const CACHE_MAX_AGE = 7 * 24 * 60 * 60;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const rawUrl = url.searchParams.get('url');

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
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechZone/1.0)',
        Accept: 'image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return Response.json({ error: `Upstream ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      return Response.json({ error: 'Image too large' }, { status: 413 });
    }

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
