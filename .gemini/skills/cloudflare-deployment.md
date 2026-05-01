# ☁️ TechZone — Cloudflare & Deployment Skill

## Build & Deploy Pipeline
```
GitHub Push → GitHub Actions → vite build → wrangler pages deploy dist
```

## Key Commands
```bash
npm run dev                  # Local dev server (port 5173)
npm run build                # Production build → dist/
npm run preview:cloudflare   # Local CF Pages preview
npm run deploy:cloudflare    # Manual deploy
npm test                     # Run all unit tests
```

## Cloudflare Pages Functions

### File-based Routing
```
functions/api/health.js      → GET /api/health
functions/api/checkout.js    → POST /api/checkout
functions/api/chat.js        → POST /api/chat
functions/api/img.js         → GET /api/img
```

### Function Signature
```js
export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
}
```

### Middleware
`functions/_middleware.js` — Blocks direct access to admin files.

### Security
- `functions/_lib/securityHeaders.js` — Standard response headers
- `functions/_lib/rateLimit.js` — IP-based rate limiting
- `functions/_lib/adminShellGate.js` — Admin auth gate
- Admin panel hidden at `__tz-panel.html` (protected by middleware)

## Environment Variables

### Build-time (GitHub Secrets)
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`

### Runtime (Cloudflare Secrets)
`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `CRON_SECRET`

## Post-Deploy Check
```bash
TARGET_BASE_URL=https://tensr.systems npm run security:postdeploy
```
