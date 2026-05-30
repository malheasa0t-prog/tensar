# Database Setup

`complete_database_setup.sql` is the canonical full schema for new Supabase
environments. The other full-schema-looking files are legacy snapshots kept for
reference only, are guarded to abort immediately, and should not be applied to
production.

For an existing environment, apply migrations in chronological filename order
after the canonical setup file. The current Orange Money and admin hardening
sequence is:

1. `2026-05-25-01-orange-money-operations.sql`
2. `2026-05-29-01-orange-money-deposit-race-fix.sql`
3. `2026-05-29-02-admin-refund-and-seller-rpcs.sql`
4. `2026-05-29-03-definer-hardening.sql`
5. `2026-05-30-01-service-order-idempotency.sql`
6. `2026-05-30-02-refund-rls-and-definer-guards.sql`
7. `2026-05-30-03-all-order-display-numbers.sql`
8. `2026-05-30-04-products-schema-fixes.sql`
9. `2026-05-30-05-staff-permissions.sql`
10. `2026-05-30-06-security-hardening.sql`
11. `2026-05-30-07-fk-covering-indexes.sql`
12. `2026-05-30-08-rls-initplan-optimization.sql`

> **Note:** `2026-05-30-05` tightens `is_admin_role()` to `super_admin`/`admin`
> only. `complete_database_setup.sql` already matches this, so re-running the
> canonical setup will not re-grant blanket RLS access to staff roles.

Before applying a migration to production, run it on a staging Supabase project
or review it in the Supabase SQL editor, then verify the affected RPCs and RLS
policies.
