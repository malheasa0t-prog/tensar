begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'deposits',
  'deposits',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read deposit proofs" on storage.objects;
create policy "Public can read deposit proofs"
on storage.objects for select
using (bucket_id = 'deposits');

drop policy if exists "Authenticated users can upload own deposit proofs" on storage.objects;
create policy "Authenticated users can upload own deposit proofs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can update own deposit proofs" on storage.objects;
create policy "Authenticated users can update own deposit proofs"
on storage.objects for update
to authenticated
using (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can delete own deposit proofs" on storage.objects;
create policy "Authenticated users can delete own deposit proofs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into public.settings (id, data)
values (
  1,
  jsonb_build_object(
    'depositTransfer',
    jsonb_build_object(
      'bankName', '',
      'accountHolder', '',
      'iban', '',
      'instructions', ''
    )
  )
)
on conflict (id) do update
set
  data = case
    when coalesce(public.settings.data, '{}'::jsonb) ? 'depositTransfer' then public.settings.data
    else jsonb_set(
      coalesce(public.settings.data, '{}'::jsonb),
      '{depositTransfer}',
      excluded.data -> 'depositTransfer',
      true
    )
  end,
  updated_at = now();

commit;
