-- Run once in the Supabase SQL editor or with `supabase db push`.
-- No service-role key is needed in the website.
begin;

create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;
grant select on public.site_admins to authenticated;
create policy "Owners can see their own membership" on public.site_admins
  for select to authenticated using (user_id = (select auth.uid()));

create function public.is_site_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.site_admins where user_id = (select auth.uid())); $$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to anon, authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('building','hackathon','playground','travel','people','life','experience')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  body text not null default '',
  cover text not null default 'note' check (cover in ('studio','film','accounting','ticket','map','spanish','code','plant','people','shell','note')),
  image_url text not null default '' check (image_url = '' or image_url ~ '^https?://'),
  link_url text not null default '' check (link_url = '' or link_url ~ '^https?://'),
  tags text[] not null default '{}',
  date date not null default current_date,
  pinned boolean not null default false,
  published boolean not null default false,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_coordinates check (
    (metadata->>'lat' is null) = (metadata->>'lng' is null)
    and (metadata->>'lat' is null or (metadata->>'lat')::numeric between -90 and 90)
    and (metadata->>'lng' is null or (metadata->>'lng')::numeric between -180 and 180)
  ),
  constraint valid_result check (metadata->>'result' is null or metadata->>'result' in ('winner','finalist','participant')),
  constraint valid_progress check (
    (metadata->>'streak' is null or (metadata->>'streak' ~ '^\d+$' and (metadata->>'streak')::numeric <= 9007199254740991))
    and (metadata->>'xp' is null or (metadata->>'xp' ~ '^\d+$' and (metadata->>'xp')::numeric <= 9007199254740991))
  )
);
create index posts_feed on public.posts (pinned desc, date desc) where published;

create function public.touch_post() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger posts_updated before update on public.posts for each row execute function public.touch_post();

alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
create policy "Read published stories" on public.posts for select to anon, authenticated using (published);
create policy "Owners manage stories" on public.posts for all to authenticated
  using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif','image/gif']);
-- Covers are public assets, including files attached to a draft. Post text stays private until published.
create policy "Owners read cover metadata" on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and (select public.is_site_admin()));
create policy "Owners upload covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (select public.is_site_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners remove covers" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (select public.is_site_admin()) and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
