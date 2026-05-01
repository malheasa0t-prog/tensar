# 🏗️ TechZone — Project Architecture Skill

## Project Identity

- **Name**: TechZone (Tensar)
- **Type**: Arabic e-commerce + tech services platform
- **Language**: Arabic (RTL) — all UI text MUST be in Arabic
- **Direction**: `dir="rtl"` — always use physical CSS properties (`padding-right` not `padding-inline-start`)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3 + Vite 8 (SPA) |
| Routing | React Router DOM v7 |
| Styling | Vanilla CSS + CSS Modules (`.module.css`) |
| Icons | Lucide React |
| Backend | Cloudflare Pages Functions (`functions/`) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Deployment | Cloudflare Pages via GitHub Actions |
| AI Chat | Groq API |

## Critical Architecture Rules

### 1. SPA with Next.js Shims
This project migrated from Next.js to Vite SPA. Shims exist in `src/shims/` for:
- `next/link` → React Router `<Link>`
- `next/navigation` → React Router hooks
- `next/image` → native `<img>`
- `next/dynamic` → React `lazy()`
- `next/script` → native `<script>`
- `next/font/google` → no-op

**NEVER** import directly from `next/*`. Always use the actual React/Vite equivalents or the existing shims.

### 2. File Structure Convention
```
src/           → Vite entry point, React Router, App shell
app/           → Page components (Next.js-style file structure, but SPA)
components/    → Shared UI components (each with .jsx + .module.css)
lib/           → Business logic models, utilities, pure functions
services/      → Data access layer (Supabase queries, API calls)
hooks/         → Custom React hooks (useXxx.js)
functions/     → Cloudflare Pages Functions (serverless API)
functions/api/ → REST API endpoints
functions/_lib/→ Shared server-side utilities
db/            → SQL migrations and schema files
public/        → Static assets, admin panel, service workers
```

### 3. Layered Architecture (MANDATORY)
```
Component (UI) → Hook (state) → Service (data) → Model (logic)
```
- **Components** (`components/`): React UI only. No direct Supabase calls.
- **Hooks** (`hooks/`): State management, compose services + models.
- **Services** (`services/`): Supabase queries, fetch calls. Return raw data.
- **Models** (`lib/`): Pure business logic, validation, transformation. No side effects.

### 4. Environment Variables
All public env vars use the `NEXT_PUBLIC_` prefix (legacy convention):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `NEXT_PUBLIC_SITE_URL` — Production site URL

Server-only (Cloudflare Functions):
- `SUPABASE_SERVICE_ROLE_KEY` — Admin Supabase key
- `GROQ_API_KEY` — AI chat API key
- `CRON_SECRET` — Cron job authentication

**NEVER** expose server-only keys in client-side code. The `clientBundleSecurity.js` plugin will block the build if leaked.

### 5. Vite Build Security
- `lib/clientBundleSecurity.js` contains a Vite plugin that scans the bundle for leaked secrets
- `lib/requiredPublicEnv.js` validates required env vars at build time
- Build will FAIL if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing

### 6. Route Configuration
All routes are defined in `src/router.jsx` using lazy loading via `src/routePrefetch.js`.
When adding a new page:
1. Create the page component in `app/[route-name]/page.jsx`
2. Add a loader entry in `src/routePrefetch.js`
3. Add the lazy import and `<Route>` in `src/router.jsx`

### 7. CSS Convention
- Use CSS Modules for component-scoped styles: `ComponentName.module.css`
- Global theme styles live in `app/techfix-*.css` files
- Design tokens in `app/techfix-tokens.css`
- Use physical CSS properties for RTL safety: `right`/`left` not `inline-start`/`inline-end`
- Dark mode by default — the site uses a dark purple/neon aesthetic
