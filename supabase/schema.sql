-- Ladenfluss v1.4 — initiales Supabase-Schema
-- Vor Produktion mit Supabase CLI/Tests prüfen.
-- Keine Secret- oder Service-Role-Keys in Browser oder Repository speichern.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  retail_type text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','manager','employee')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  primary key (company_id,user_id)
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address_line text,
  postal_code text,
  city text,
  opening_days smallint check (opening_days between 1 and 7),
  opening_hours numeric(4,1) check (opening_hours > 0 and opening_hours <= 24),
  timezone text not null default 'Europe/Berlin',
  federal_state text check (federal_state in ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH')),
  holiday_work_allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  role text,
  weekly_target_hours numeric(5,2) not null default 0,
  documents_complete boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  status text not null default 'draft' check (status in ('draft','published')),
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.module_access (
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key text not null,
  status text not null default 'inactive' check (status in ('free','trial','active','inactive')),
  trial_ends_at timestamptz,
  primary key (company_id,module_key)
);

-- Erstellt für ein neu angelegtes Unternehmen automatisch die Owner-Mitgliedschaft.
create or replace function public.handle_new_company_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_members(company_id,user_id,role,status)
  values(new.id,new.created_by,'owner','active')
  on conflict (company_id,user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_company_created_owner on public.companies;
create trigger on_company_created_owner
after insert on public.companies
for each row execute function public.handle_new_company_owner();

create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

create or replace function public.has_company_role(target_company uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.has_company_role(uuid,text[]) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid,text[]) to authenticated;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.branches enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.module_access enable row level security;

-- Keine Geschäftsdaten für nicht angemeldete Nutzer.
revoke all on table public.companies from anon;
revoke all on table public.company_members from anon;
revoke all on table public.branches from anon;
revoke all on table public.employees from anon;
revoke all on table public.shifts from anon;
revoke all on table public.module_access from anon;

-- Least privilege für angemeldete Nutzer; RLS begrenzt zusätzlich die sichtbaren Zeilen.
revoke all on table public.companies from authenticated;
revoke all on table public.company_members from authenticated;
revoke all on table public.branches from authenticated;
revoke all on table public.employees from authenticated;
revoke all on table public.shifts from authenticated;
revoke all on table public.module_access from authenticated;

grant select,insert,update on table public.companies to authenticated;
grant select on table public.company_members to authenticated;
grant select,insert,update,delete on table public.branches to authenticated;
grant select,insert,update,delete on table public.employees to authenticated;
grant select,insert,update,delete on table public.shifts to authenticated;
grant select on table public.module_access to authenticated;

create policy "members read companies"
on public.companies for select
to authenticated
using (public.is_company_member(id));

create policy "user creates own company"
on public.companies for insert
to authenticated
with check (created_by = auth.uid());

create policy "owners and admins update company"
on public.companies for update
to authenticated
using (public.has_company_role(id,array['owner','admin']))
with check (public.has_company_role(id,array['owner','admin']));

create policy "members read memberships"
on public.company_members for select
to authenticated
using (public.is_company_member(company_id));

create policy "members read branches"
on public.branches for select
to authenticated
using (public.is_company_member(company_id));

create policy "management manages branches"
on public.branches for all
to authenticated
using (public.has_company_role(company_id,array['owner','admin','manager']))
with check (public.has_company_role(company_id,array['owner','admin','manager']));

create policy "members read employees"
on public.employees for select
to authenticated
using (public.is_company_member(company_id));

create policy "management manages employees"
on public.employees for all
to authenticated
using (public.has_company_role(company_id,array['owner','admin','manager']))
with check (public.has_company_role(company_id,array['owner','admin','manager']));

create policy "members read shifts"
on public.shifts for select
to authenticated
using (public.is_company_member(company_id));

create policy "management manages shifts"
on public.shifts for all
to authenticated
using (public.has_company_role(company_id,array['owner','admin','manager']))
with check (public.has_company_role(company_id,array['owner','admin','manager']));

create policy "members read module access"
on public.module_access for select
to authenticated
using (public.is_company_member(company_id));

-- module_access wird später serverseitig durch Billing/Admin-Funktionen verwaltet.
-- Mitarbeiter-Einladungen und feinere Rollenrechte folgen nach dem ersten Auth-Flow.
