-- Ladenfluss: keep up to five prior snapshots for each module and company.
-- The history is read-only to clients and governed by the same RLS entitlement.
create table public.cloud_document_history (
 company_id uuid not null references public.companies(id) on delete cascade,
 module_key text not null check (module_key in ('profile','vacation','pep','zahlenfluss','warenfluss')),
 revision integer not null check (revision>0),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=1048576),
 saved_at timestamptz not null,
 primary key(company_id,module_key,revision)
);
alter table public.cloud_document_history enable row level security;
revoke all on public.cloud_document_history from anon,authenticated;
grant select on public.cloud_document_history to authenticated;
create policy cloud_history_read on public.cloud_document_history for select
 to authenticated using (private.module_allowed(company_id,module_key));

create function private.archive_previous_cloud_document()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.cloud_document_history(company_id,module_key,revision,payload,saved_at)
 values(old.company_id,old.module_key,old.revision,old.payload,old.updated_at);
 delete from public.cloud_document_history
 where company_id=new.company_id and module_key=new.module_key and revision<=new.revision-6;
 return new;
end;
$$;
revoke all on function private.archive_previous_cloud_document() from public,anon,authenticated;
create trigger archive_previous_cloud_document before update on public.cloud_documents
 for each row when (old.revision is distinct from new.revision)
 execute function private.archive_previous_cloud_document();
