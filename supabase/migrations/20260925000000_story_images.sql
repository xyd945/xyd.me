begin;
alter table public.posts add column images text[] not null default '{}';
update public.posts set images = array[image_url] where image_url <> '';
create function public.valid_story_images(urls text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(urls) <= 10
    and not exists(select 1 from unnest(urls) as url where url is null or url !~ '^https?://[^/[:space:]]+');
$$;
alter table public.posts add constraint valid_images check (public.valid_story_images(images));
commit;
