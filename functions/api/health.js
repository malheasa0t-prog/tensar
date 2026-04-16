/**
 * Cloudflare Pages Function — Health Check.
 *
 * @param {EventContext} context
 */
export async function onRequestGet() {
  return Response.json({
    status: 'ok',
    runtime: 'cloudflare-pages',
    platform: 'web',
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
