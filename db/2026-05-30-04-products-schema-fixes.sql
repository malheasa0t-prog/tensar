-- Migration: 2026-05-30-04 - Products schema fixes
--
-- Purpose:
--   Add missing columns `review_count` and `icon` to the `products` table 
--   that the frontend codebase expects to be present.

begin;

alter table public.products
  add column if not exists review_count integer not null default 0;

alter table public.products
  add column if not exists icon text;

commit;
