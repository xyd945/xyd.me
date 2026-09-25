-- Run only in a disposable local PostgreSQL database, never a real Supabase project.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(),bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema public, auth, storage to anon, authenticated;
grant select,insert,update,delete on storage.objects to anon, authenticated;
\ir ../supabase/migrations/20260924000000_personal_notebook.sql
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.site_admins values ('11111111-1111-4111-8111-111111111111');
insert into storage.objects(bucket_id,name) values ('post-images','11111111-1111-4111-8111-111111111111/existing.png');
insert into public.posts(id,category,title,published) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','building','Published',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','life','Private draft',false);

update public.posts set image_url='https://example.com/cover.jpg' where title='Published';
\ir ../supabase/migrations/20260925000000_story_images.sql
do $$ begin
 if (select images from public.posts where title='Published') <> array['https://example.com/cover.jpg'] then raise exception 'Legacy image not preserved'; end if;
 begin
  update public.posts set images=array['javascript:alert(1)'];
  raise exception 'Unsafe image URL accepted';
 exception when check_violation then null; end;
 begin
  update public.posts set images=array_fill('https://example.com/a.jpg'::text, array[11]);
  raise exception 'Over-limit gallery accepted';
 exception when check_violation then null; end;
 begin
  update public.posts set images=array[null]::text[];
  raise exception 'Null gallery image accepted';
 exception when check_violation then null; end;
end $$;

set role anon;
do $$ begin
 if (select count(*) from public.posts) <> 1 then raise exception 'Anonymous draft leakage'; end if;
 if public.is_site_admin() then raise exception 'Anonymous admin access'; end if;
 begin
  insert into public.posts(category,title) values ('life','Attack');
  raise exception 'Anonymous insert succeeded';
 exception when insufficient_privilege then null; end;
 begin
  update public.posts set title='Attack';
  raise exception 'Anonymous update allowed';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.posts;
  raise exception 'Anonymous delete allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.site_admins values ('22222222-2222-4222-8222-222222222222');
  raise exception 'Anonymous promotion succeeded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set role authenticated;
do $$ declare changed integer; begin
 if public.is_site_admin() then raise exception 'Non-admin has admin access'; end if;
 if (select count(*) from public.site_admins) <> 0 then raise exception 'Non-admin can read owner membership'; end if;
 if (select count(*) from public.posts) <> 1 then raise exception 'Signed-in non-admin draft leakage'; end if;
 begin
  insert into public.posts(category,title,published) values ('life','Attack',true);
  raise exception 'Non-admin created a published post';
 exception when insufficient_privilege then null; end;
 update public.posts set title='Attack'; get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Non-admin updated a post'; end if;
 delete from public.posts; get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Non-admin deleted a post'; end if;
 begin
  insert into public.site_admins values (auth.uid());
  raise exception 'Self-promotion succeeded';
 exception when insufficient_privilege then null; end;
 begin
  update public.site_admins set user_id=auth.uid();
  raise exception 'Admin membership takeover allowed';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.site_admins;
  raise exception 'Admin membership deletion allowed';
 exception when insufficient_privilege then null; end;
 if (select count(*) from storage.objects) <> 0 then raise exception 'Non-admin can list image metadata'; end if;
 update storage.objects set name=auth.uid()::text || '/attack.png'; get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Non-admin changed an image'; end if;
 delete from storage.objects; get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Non-admin deleted an image'; end if;
 begin
  insert into storage.objects(bucket_id,name) values ('post-images',auth.uid()::text || '/attack.png');
  raise exception 'Non-admin uploaded image';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set role authenticated;
do $$ begin
 if not public.is_site_admin() then raise exception 'Admin denied'; end if;
 begin
  insert into public.site_admins values ('22222222-2222-4222-8222-222222222222');
  raise exception 'Browser owner can grant admin membership';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.posts) <> 2 then raise exception 'Admin cannot read drafts'; end if;
 insert into public.posts(category,title) values ('people','New founder');
 delete from public.posts where title='New founder';
 if not found then raise exception 'Owner could not delete post'; end if;
 update public.posts set published=true where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 insert into storage.objects(bucket_id,name) values ('post-images',auth.uid()::text || '/cover.png');
 begin
  insert into storage.objects(bucket_id,name) values ('post-images','somebody-else/attack.png');
  raise exception 'Admin upload escaped own folder';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.posts(category,title,metadata) values ('travel','Bad coordinates','{"lat":99,"lng":4}');
  raise exception 'Invalid coordinates accepted';
 exception when check_violation then null; end;
 begin
  insert into public.posts(category,title,metadata) values ('life','Negative streak','{"streak":-2}');
  raise exception 'Invalid progress accepted';
 exception when check_violation then null; end;
 delete from storage.objects where bucket_id='post-images';
end $$;
reset role;
set role anon;
do $$ begin
 if (select count(*) from public.posts) <> 2 then raise exception 'Publishing failed'; end if;
end $$;
reset role;

-- Hide/show changes visibility without destroying the story; delete removes only its row.
set role authenticated;
update public.posts set published=false where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
reset role;
set role anon;
do $$ begin
 if (select count(*) from public.posts) <> 1 then raise exception 'Hidden story still visible publicly'; end if;
end $$;
reset role;
set role authenticated;
do $$ begin
 if not exists(select 1 from public.posts where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and not published and title='Private draft') then raise exception 'Hiding lost the owner draft'; end if;
end $$;
update public.posts set published=true where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
reset role;
set role anon;
do $$ begin
 if (select count(*) from public.posts) <> 2 then raise exception 'Showing hidden story failed'; end if;
end $$;
reset role;
set role authenticated;
delete from public.posts where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$ begin
 if (select count(*) from public.posts) <> 1 then raise exception 'Delete did not remove exactly one story'; end if;
 if exists(select 1 from public.posts where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'Deleted story remains in owner library'; end if;
end $$;
reset role;
set role anon;
do $$ begin
 if (select count(*) from public.posts) <> 1 then raise exception 'Deleted story remains in public feed'; end if;
end $$;
reset role;
select 'PASS: published/draft visibility, hide/show/delete, owner CRUD, no self-promotion, storage ownership, metadata checks' as result;
