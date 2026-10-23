-- =====================================================================
-- TalentLoom · 0700 · Storage buckets and policies
--
-- Path convention: <owner-id>/<anything>. For user buckets the first
-- folder is the user's auth id; for company-logos it is the company id.
-- Private files are served to other parties ONLY through short-lived
-- signed URLs issued by server code after a permission check.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',             'avatars',             true,  5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('covers',              'covers',              true,  8388608,  array['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos',       'company-logos',       true,  5242880,  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('portfolio-public',    'portfolio-public',    true,  20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('portfolio-private',   'portfolio-private',   false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('media-kits',          'media-kits',          false, 20971520, array['application/pdf', 'image/jpeg', 'image/png']),
  ('analytics-evidence',  'analytics-evidence',  false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('verification-docs',   'verification-docs',   false, 10485760, array['image/jpeg', 'image/png', 'application/pdf']),
  ('support-attachments', 'support-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Safe uuid cast for folder names (returns NULL instead of erroring)
create or replace function private.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function private.try_uuid(text) to anon, authenticated, service_role;

-- ---------- User-owned buckets ----------------------------------------
create policy storage_user_select on storage.objects for select to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'portfolio-public', 'portfolio-private', 'media-kits',
                  'analytics-evidence', 'verification-docs', 'support-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_user_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'covers', 'portfolio-public', 'portfolio-private', 'media-kits',
                  'analytics-evidence', 'verification-docs', 'support-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.is_active_user()
  );

create policy storage_user_update on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'portfolio-public', 'portfolio-private', 'media-kits',
                  'analytics-evidence', 'verification-docs', 'support-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.is_active_user()
  )
  with check ((storage.foldername(name))[1] = auth.uid()::text);

create policy storage_user_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'portfolio-public', 'portfolio-private', 'media-kits',
                  'analytics-evidence', 'verification-docs', 'support-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.is_active_user()
  );

-- ---------- Company logos -------------------------------------------
create policy storage_company_logo_write on storage.objects for all to authenticated
  using (
    bucket_id = 'company-logos'
    and private.has_company_permission(private.try_uuid((storage.foldername(name))[1]), 'company.edit')
  )
  with check (
    bucket_id = 'company-logos'
    and private.has_company_permission(private.try_uuid((storage.foldername(name))[1]), 'company.edit')
  );

-- ---------- Super admins: review any file -----------------------------
create policy storage_admin_all on storage.objects for all to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
