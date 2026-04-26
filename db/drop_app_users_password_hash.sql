-- Removes the legacy password hash bridge column from app_users.
-- Supabase Auth is the only supported password source after this migration.

begin;

alter table if exists public.app_users
  drop column if exists password_hash;

commit;
