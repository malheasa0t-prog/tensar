export const runtime = 'nodejs';

export async function GET() {
  const now = new Date();

  return Response.json({
    status: 'ok',
    runtime: 'server',
    platform: 'web',
    version: process.env.npm_package_version || 'unknown',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: now.toISOString(),
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
