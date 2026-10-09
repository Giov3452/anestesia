alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create or replace function public.protect_must_change_password()
returns trigger
language plpgsql
as $$
declare
  request_role text;
begin
  request_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );

  if new.must_change_password is distinct from old.must_change_password
     and request_role is distinct from 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'must_change_password can only be changed by a privileged server operation';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_must_change_password_trigger on public.profiles;
create trigger protect_must_change_password_trigger
before update of must_change_password on public.profiles
for each row execute function public.protect_must_change_password();