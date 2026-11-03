create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.pt_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null unique,
 display_name text not null default '',
 role text not null default 'pt' check (role in ('admin','pt')),
 height_cm numeric(5,2) check (height_cm is null or height_cm between 50 and 250),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.pt_relationships (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid not null references public.pt_profiles(id) on delete cascade,
 trainer_id uuid not null references public.pt_profiles(id) on delete cascade,
 status text not null default 'active' check (status in ('active','disabled')),
 created_at timestamptz not null default now(),
 unique(admin_id,trainer_id), check(admin_id <> trainer_id)
);
create table public.pt_packages (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 total_lessons integer not null check(total_lessons > 0),
 price_eur numeric(10,2) not null check(price_eur >= 0),
 starts_on date, expires_on date,
 is_active boolean not null default true,
 notes text,
 created_by uuid not null default auth.uid() references public.pt_profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expires_on is null or starts_on is null or expires_on >= starts_on)
);
create table public.pt_lessons (
 id uuid primary key default gen_random_uuid(),
 starts_at timestamptz not null,
 duration_minutes integer not null default 60 check(duration_minutes between 15 and 480),
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 package_id uuid references public.pt_packages(id) on delete set null,
 notes text,
 created_by uuid not null default auth.uid() references public.pt_profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.pt_payments (
 id uuid primary key default gen_random_uuid(),
 amount_eur numeric(10,2) not null check(amount_eur > 0),
 paid_on date not null default current_date,
 method text check(method is null or method in ('cash','bank_transfer','card','other')),
 description text,
 status text not null default 'pending' check(status in ('pending','confirmed','disputed')),
 created_by uuid not null default auth.uid() references public.pt_profiles(id),
 confirmed_by uuid references public.pt_profiles(id),
 confirmed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.pt_workout_plans (
 id uuid primary key default gen_random_uuid(),
 title text not null, description text,
 file_path text not null, file_name text not null,
 content_type text not null default 'application/pdf',
 uploaded_by uuid not null default auth.uid() references public.pt_profiles(id),
 is_current boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.pt_measurements (
 id uuid primary key default gen_random_uuid(),
 measured_on date not null default current_date,
 weight_kg numeric(6,2) check(weight_kg is null or weight_kg > 0),
 height_cm_used numeric(5,2) check(height_cm_used is null or height_cm_used between 50 and 250),
 bmi numeric(6,2) generated always as (
  case when weight_kg is not null and height_cm_used is not null and height_cm_used > 0
  then round(weight_kg / ((height_cm_used / 100) * (height_cm_used / 100)), 2) else null end
 ) stored,
 fat_mass_percent numeric(5,2) check(fat_mass_percent is null or fat_mass_percent between 0 and 100),
 triceps_mm numeric(6,2), subscapular_mm numeric(6,2), abdominal_mm numeric(6,2),
 suprailiac_mm numeric(6,2), thigh_skinfold_mm numeric(6,2),
 arm_right_cm numeric(6,2), arm_left_cm numeric(6,2), chest_cm numeric(6,2),
 waist_cm numeric(6,2), hips_cm numeric(6,2), thigh_right_cm numeric(6,2), thigh_left_cm numeric(6,2),
 notes text,
 created_by uuid not null default auth.uid() references public.pt_profiles(id),
 created_at timestamptz not null default now()
);
create table public.pt_progress_photos (
 id uuid primary key default gen_random_uuid(),
 taken_on date not null default current_date,
 view_type text not null check(view_type in ('front','side','back','other')),
 file_path text not null, caption text,
 uploaded_by uuid not null default auth.uid() references public.pt_profiles(id),
 created_at timestamptz not null default now()
);
create table public.pt_notes (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid references public.pt_lessons(id) on delete set null,
 body text not null,
 created_by uuid not null default auth.uid() references public.pt_profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create or replace function private.pt_is_admin() returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.pt_profiles p where p.id=(select auth.uid()) and p.role='admin'); $$;
create or replace function private.pt_is_member() returns boolean
language sql stable security definer set search_path=''
as $$ select exists(
 select 1 from public.pt_profiles p where p.id=(select auth.uid()) and
 (p.role='admin' or (p.role='pt' and exists(
  select 1 from public.pt_relationships r where r.trainer_id=p.id and r.status='active'
 )))
); $$;
revoke all on function private.pt_is_admin() from public, anon;
revoke all on function private.pt_is_member() from public, anon;
grant execute on function private.pt_is_admin() to authenticated;
grant execute on function private.pt_is_member() to authenticated;

create or replace function public.pt_fill_measurement_height() returns trigger
language plpgsql set search_path=''
as $$ begin
 if new.height_cm_used is null then
  select p.height_cm into new.height_cm_used from public.pt_profiles p where p.id=(select auth.uid());
 end if;
 return new;
end; $$;
create trigger pt_measurement_height_before_insert before insert on public.pt_measurements
for each row execute function public.pt_fill_measurement_height();

create or replace function public.pt_guard_payment_confirmation() returns trigger
language plpgsql set search_path=''
as $$
begin
 if tg_op='INSERT' then
  if new.created_by is distinct from (select auth.uid()) then raise exception 'created_by must match the authenticated user'; end if;
  new.status:='pending'; new.confirmed_by:=null; new.confirmed_at:=null; return new;
 end if;
 if new.amount_eur is distinct from old.amount_eur or new.paid_on is distinct from old.paid_on
  or new.method is distinct from old.method or new.description is distinct from old.description
  or new.created_by is distinct from old.created_by then
  raise exception 'Payment details cannot be changed after registration';
 end if;
 if new.status not in ('confirmed','disputed') or old.status <> 'pending' then
  raise exception 'Only pending payments can be confirmed or disputed';
 end if;
 if (select auth.uid())=old.created_by then raise exception 'The person who registered the payment cannot confirm it'; end if;
 new.confirmed_by:=(select auth.uid()); new.confirmed_at:=now(); return new;
end; $$;
create trigger pt_payment_confirmation_guard before insert or update on public.pt_payments
for each row execute function public.pt_guard_payment_confirmation();

alter table public.pt_profiles enable row level security;
alter table public.pt_relationships enable row level security;
alter table public.pt_packages enable row level security;
alter table public.pt_lessons enable row level security;
alter table public.pt_payments enable row level security;
alter table public.pt_workout_plans enable row level security;
alter table public.pt_measurements enable row level security;
alter table public.pt_progress_photos enable row level security;
alter table public.pt_notes enable row level security;

create policy "pt_profiles_read_self_or_admin" on public.pt_profiles for select to authenticated
using(id=(select auth.uid()) or (select private.pt_is_admin()));
create policy "pt_profiles_admin_insert" on public.pt_profiles for insert to authenticated with check((select private.pt_is_admin()));
create policy "pt_profiles_admin_update" on public.pt_profiles for update to authenticated using((select private.pt_is_admin())) with check((select private.pt_is_admin()));
create policy "pt_profiles_admin_delete" on public.pt_profiles for delete to authenticated using((select private.pt_is_admin()));
create policy "pt_relationships_read_members" on public.pt_relationships for select to authenticated
using((select private.pt_is_admin()) or trainer_id=(select auth.uid()));
create policy "pt_relationships_admin_insert" on public.pt_relationships for insert to authenticated with check((select private.pt_is_admin()));
create policy "pt_relationships_admin_update" on public.pt_relationships for update to authenticated using((select private.pt_is_admin())) with check((select private.pt_is_admin()));
create policy "pt_relationships_admin_delete" on public.pt_relationships for delete to authenticated using((select private.pt_is_admin()));
create policy "pt_packages_members_all" on public.pt_packages for all to authenticated using((select private.pt_is_member())) with check((select private.pt_is_member()));
create policy "pt_lessons_members_all" on public.pt_lessons for all to authenticated using((select private.pt_is_member())) with check((select private.pt_is_member()));
create policy "pt_payments_members_select" on public.pt_payments for select to authenticated using((select private.pt_is_member()));
create policy "pt_payments_members_insert" on public.pt_payments for insert to authenticated with check((select private.pt_is_member()) and created_by=(select auth.uid()));
create policy "pt_payments_members_update" on public.pt_payments for update to authenticated using((select private.pt_is_member())) with check((select private.pt_is_member()));
create policy "pt_workout_plans_members_all" on public.pt_workout_plans for all to authenticated using((select private.pt_is_member())) with check((select private.pt_is_member()));
create policy "pt_measurements_members_all" on public.pt_measurements for all to authenticated using((select private.pt_is_member())) with check((select private.pt_is_member()));
create policy "pt_photos_members_all" on public.pt_progress_photos for all to authenticated using((select private.pt_is_member())) with check((select private.pt_is_member()));
create policy "pt_notes_members_all" on public.pt_notes for all to authenticated using((select private.pt_is_member())) with check((select private.pt_is_member()));

grant select, insert, update, delete on public.pt_profiles, public.pt_relationships, public.pt_packages,
 public.pt_lessons, public.pt_payments, public.pt_workout_plans, public.pt_measurements,
 public.pt_progress_photos, public.pt_notes to authenticated;

insert into public.pt_profiles(id,email,display_name,role)
select u.id,u.email,'Amministratore','admin' from auth.users u
where lower(u.email)='ivanmeloni6@gmail.com'
on conflict(id) do update set email=excluded.email, role='admin', updated_at=now();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pt-private','pt-private',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "pt_private_storage_select" on storage.objects for select to authenticated
using(bucket_id='pt-private' and (select private.pt_is_member()));
create policy "pt_private_storage_insert" on storage.objects for insert to authenticated
with check(bucket_id='pt-private' and (select private.pt_is_member()));
create policy "pt_private_storage_update" on storage.objects for update to authenticated
using(bucket_id='pt-private' and (select private.pt_is_member()))
with check(bucket_id='pt-private' and (select private.pt_is_member()));
create policy "pt_private_storage_delete" on storage.objects for delete to authenticated
using(bucket_id='pt-private' and (select private.pt_is_member()));
