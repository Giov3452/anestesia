create table public.pt_diary_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  body_html text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pt_diary_posts enable row level security;

create policy "pt_diary_admin_only_select"
on public.pt_diary_posts for select to authenticated
using ((select private.pt_is_admin()));

create policy "pt_diary_admin_only_insert"
on public.pt_diary_posts for insert to authenticated
with check ((select private.pt_is_admin()));

create policy "pt_diary_admin_only_update"
on public.pt_diary_posts for update to authenticated
using ((select private.pt_is_admin()))
with check ((select private.pt_is_admin()));

create policy "pt_diary_admin_only_delete"
on public.pt_diary_posts for delete to authenticated
using ((select private.pt_is_admin()));

grant select, insert, update, delete on public.pt_diary_posts to authenticated;
