# Security Post-Deploy Checklist

This checklist covers the production steps that must be completed after the security fixes are merged so the hardening is not left local-only.

## 1. Apply the production database migration

Run the following file against the live database before reopening the admin area:

```text
db/2026-04-26-01-security-lockdown.sql
```

Use the Supabase SQL Editor or your team's approved production migration path. Do not run one of the large snapshot files instead of this targeted migration.

If you have a Supabase management token available locally, you can also apply the migration with:

```bash
SUPABASE_MANAGEMENT_TOKEN=sbp_xxx npm run security:apply-db-lockdown
```

PowerShell:

```powershell
$env:SUPABASE_MANAGEMENT_TOKEN = "sbp_xxx"
npm run security:apply-db-lockdown
```

## 2. Redeploy the site

Redeploy the frontend and server functions after the migration is applied:

```bash
npm run build
npm run deploy:cloudflare
```

If deployment runs through GitHub Actions, the current workflow will also execute the post-deploy security smoke check by using `NEXT_PUBLIC_SITE_URL`.

## 3. Run the post-deploy security check manually

Minimum run:

```bash
TARGET_BASE_URL=https://tensr.systems npm run security:postdeploy
```

PowerShell:

```powershell
$env:TARGET_BASE_URL = "https://tensr.systems"
npm run security:postdeploy
```

## 4. Verify signed deposit-proof URLs

If you also want to verify signed storage URLs, pass one valid signed URL:

```powershell
$env:TARGET_BASE_URL = "https://tensr.systems"
$env:TARGET_SIGNED_DEPOSIT_PROOF_URL = "https://<project>.supabase.co/storage/v1/object/sign/deposits/..."
npm run security:postdeploy
```

The script will verify that the signed URL works and the unsigned variant does not.

## 5. Supported environment variables

- `TARGET_BASE_URL`
  - Required. Live deployment URL.
- `TARGET_ADMIN_PATHS`
  - Optional. Paths to probe, for example `/admin,/admin.html`.
- `TARGET_RATE_LIMIT_PATH`
  - Optional. Default: `/api/checkout`.
- `TARGET_RATE_LIMIT_METHOD`
  - Optional. Default: `POST`.
- `TARGET_RATE_LIMIT_BODY`
  - Optional. Safe JSON body that does not create side effects. Default: `{"items":[]}`.
- `TARGET_RATE_LIMIT_ATTEMPTS`
  - Optional. Number of repeated requests. Default: `6`.
- `TARGET_SIGNED_DEPOSIT_PROOF_URL`
  - Optional. Used to verify signed storage access.
- `POSTDEPLOY_FAIL_ON_WARNINGS`
  - Optional. When set to `true`, warnings also fail the script.

## 6. What the script checks automatically

- HTTPS and successful TLS negotiation
- `CSP`, `HSTS`, `X-Frame-Options`, and `X-Content-Type-Options`
- absence of `Access-Control-Allow-Origin: *` or reflected untrusted origins
- `/admin` and `/admin.html`
- public source-map exposure for discovered same-origin JS and CSS assets
- practical rate-limiting behavior on the configured route
- signed deposit-proof URL behavior, when provided

## 7. Manual platform checks

These items still require verification inside Cloudflare or Supabase after deployment:

- Confirm there are no bypass rules on `/api/*` or `/admin*`.
- If you want `/admin` hidden at the edge, create a Cloudflare Access policy for the admin path and then set:
  - `ADMIN_SHELL_ACCESS_MODE=cf-access`
  - `ADMIN_SHELL_ALLOWED_EMAILS=admin@example.com` or `ADMIN_SHELL_ALLOWED_DOMAINS=example.com`
- Leave `ADMIN_SHELL_ACCESS_MODE=public` until the Access policy is actually live, otherwise the shell will return `404`.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` exists only as a server-side secret.
- Confirm the `deposits` bucket remains private in Supabase.
- Review `429` and `403` events after deployment to confirm the protections are active.
- Add Cloudflare WAF or Rate Limiting rules for `/api/*` and a stricter rule for `/api/checkout`.

## 8. Cloudflare rate-limiting notes

This project deploys through `wrangler pages deploy`, and in this environment Cloudflare rejects the `ratelimits` key in the Pages production configuration. Because of that, the application now falls back to an in-process limiter instead of returning `503` when no edge limiter binding is available.

Current application policy:

- General API: `100` requests per `60` seconds per actor key.
- Guest checkout: `5` requests per `60` seconds per actor key.

For stronger production enforcement:

- configure Cloudflare WAF or Rate Limiting rules in the dashboard,
- monitor for `429` events after deploy, and
- set `REQUIRE_EDGE_RATE_LIMIT=true` only if you later provide a supported external rate-limiting layer and want strict failure when it is missing.

## 9. Expected success signal

Healthy output after deployment should look like:

- `Failing checks: 0`
- `Warnings: 0`, or one clearly understood operational warning

If `headers`, `cors`, `source-maps`, or `tls` fail, hold the rollout until the issue is resolved.
