-- Only genuinely email-confirmed, non-anonymous Supabase users may access
-- company data. This remains enforced even if an Auth provider is misconfigured.
create function private.is_verified_account()
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from auth.users u
    where u.id=(select auth.uid()) and u.email_confirmed_at is not null
      and u.is_anonymous=false
  )
$$;
revoke all on function private.is_verified_account() from public,anon,authenticated;
grant execute on function private.is_verified_account() to authenticated;

create or replace function private.has_role(target uuid, roles text[])
returns boolean language sql stable security definer set search_path=''
as $$ select (select private.is_verified_account()) and exists (
 select 1 from public.company_members
 where company_id=target and user_id=(select auth.uid())
 and status='active' and role=any(roles)
) $$;

drop policy company_create on public.companies;
create policy company_create on public.companies for insert to authenticated
with check (
  created_by=(select auth.uid())
  and (select private.is_verified_account())
  and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
);
drop policy member_read on public.company_members;
create policy member_read on public.company_members for select to authenticated
using(user_id=(select auth.uid()) and (select private.is_verified_account()));
