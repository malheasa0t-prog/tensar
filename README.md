# Tensar

Live site: https://tensr.systems

Tensar is an Arabic (RTL) storefront for digital cards, online services and device repair bookings. It is a React single-page application built with Vite, backed by Supabase (Postgres, Auth, Realtime, Storage) and a set of Cloudflare Pages Functions that handle anything that needs a server-side secret: checkout, wallet deposits, order syncing with an upstream service provider, the admin API and an AI chat assistant powered by the Groq API. Every push to `main` is built and deployed to Cloudflare Pages by GitHub Actions.

## Features

- Catalog of digital cards and services, with category pages, search, comparison and favorites (including shareable favorites lists)
- Cart and checkout with server-side validation, inventory checks, idempotency keys and rate limiting for guest checkout
- Customer accounts with Supabase Auth: email/password sign-up, Google sign-in, password recovery
- Customer dashboard: orders, wallet balance, deposits, notifications, profile, printable order receipts
- Wallet top-ups via Orange Money, including deposit-proof uploads and SMS-based payment matching
- Integration with the Serva-S provider API: service import, order status sync (cron endpoint) and a webhook receiver
- Repair booking form, order tracking, back-in-stock alerts and a help center page
- Live support chat between customers and staff (Supabase tables + Realtime)
- AI chat assistant that answers questions about the store's services and categories
- Admin panel (vanilla JS) with role-based staff permissions, served behind a gated Pages Function
- Security headers (CSP, HSTS), row-level security migrations and a post-deploy security smoke check

## Tech stack

- Frontend: React 18, Vite 8, React Router 7, CSS Modules, Lucide icons
- Backend: Cloudflare Pages Functions, Cloudflare KV (idempotency store), Wrangler
- Data and auth: Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- AI: Groq API (`llama-3.3-70b-versatile`)
- Tests: Node.js built-in test runner (`node:test`)
- CI/CD: GitHub Actions deploying to Cloudflare Pages

## Architecture

- **Frontend (`src/`, `app/`, `components/`, `hooks/`, `services/`, `lib/`)**: a Vite SPA routed with React Router. Pages live in `app/` using a Next.js-style folder layout; small shims in `src/shims/` map `next/link`, `next/navigation` and similar imports onto React Router, so there is no Next.js runtime. The browser only receives the public Supabase URL and anon key; a build plugin guards against server secrets leaking into the client bundle.
- **Edge functions (`functions/`)**: Cloudflare Pages Functions under `/api/*` for checkout, orders, deposits, provider sync, webhooks, image proxying, the admin API and chat. They verify the caller's Supabase session and use the service-role key only on the server. Shared helpers (CORS, rate limiting, security headers, idempotency) are in `functions/_lib/`.
- **Supabase**: Postgres schema, RLS policies and RPCs are in `db/` (see `db/README.md` for the apply order). Auth handles customer accounts; Realtime powers live notifications and support chat.
- **AI chat (`functions/api/chat.js`, `components/AiChatbot.jsx`)**: for signed-in users, the function loads active services and categories from Supabase, puts them in the system prompt, and sends the recent conversation to Groq's chat completions API. Requests are rate-limited and history and response length are capped.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run dev                  # frontend only, http://localhost:3000
```

`npm run dev` runs the Vite dev server, which does not execute the Pages Functions. To run the frontend and the `/api/*` functions together, build and serve with Wrangler:

```bash
npm run preview:cloudflare
```

Server-only variables from `.env.example` (`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `PROVIDER_API_KEY`, `CRON_SECRET`, ...) are read by the functions at runtime; for local Wrangler runs put them in a `.dev.vars` file, and in production set them in the Cloudflare Pages project settings.

Other scripts:

- `npm test` runs the unit tests
- `npm run build` produces the production build in `dist/`
- `npm run security:postdeploy` runs the post-deploy security check against `TARGET_BASE_URL`

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm ci` and `npm run build`, with the public `NEXT_PUBLIC_*` values taken from GitHub Secrets
2. `wrangler pages deploy dist` to the `tensar` Cloudflare Pages project
3. `npm run security:postdeploy` against the live URL

A manual deploy is also possible with `npm run deploy:cloudflare`. Database migrations are applied separately; see `db/README.md` and `docs/security-postdeploy-checklist.md`.
