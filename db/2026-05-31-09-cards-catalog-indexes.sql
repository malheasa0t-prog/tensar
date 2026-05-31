-- Cards catalog support indexes for the shared services table.
-- Read-only repository migration; apply manually on Supabase when approved.

create index if not exists idx_services_category_id
  on public.services (category_id);

create index if not exists idx_services_subcategory_id
  on public.services (subcategory_id);
