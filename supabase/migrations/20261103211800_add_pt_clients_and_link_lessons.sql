create table public.pt_clients (
 id uuid primary key default gen_random_uuid(),
 first_name text not null,
 last_name text not null,
 email text,
 phone text,
 birth_date date,
 height_cm numeric(5,2) check (height_cm is null or height_cm between 50 and 250),
 notes text,
 status text not null default 'active' check (status in ('active','inactive')),
 created_by uuid not null default auth.uid() references public.pt_profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.pt_clients enable row level security;
create policy "pt_clients_members_all" on public.pt_clients
for all to authenticated using ((select private.pt_is_member()))
with check ((select private.pt_is_member()));
grant select, insert, update, delete on public.pt_clients to authenticated;
alter table public.pt_lessons add column client_id uuid references public.pt_clients(id) on delete set null;
create index pt_clients_name_idx on public.pt_clients(last_name, first_name);
create index pt_lessons_starts_at_idx on public.pt_lessons(starts_at);
