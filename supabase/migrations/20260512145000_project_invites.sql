begin;

do $$
begin
  create type public.project_invite_status as enum ('pending', 'accepted', 'declined', 'revoked');
exception
  when duplicate_object then null;
end
$$;

create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email citext not null,
  role public.project_member_role not null,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  accepted_by uuid references public.profiles (id) on delete set null,
  status public.project_invite_status not null default 'pending',
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_invites_role_not_owner check (role in ('editor', 'viewer'))
);

create unique index project_invites_pending_project_email_key
  on public.project_invites (project_id, email)
  where status = 'pending';

create index project_invites_email_idx
  on public.project_invites (email);

create trigger set_project_invites_updated_at
  before update on public.project_invites
  for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.is_project_invite_recipient(invite_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_uuid is not null
    and exists (
      select 1
      from public.project_invites pi
      join public.profiles p on p.id = user_uuid
      where pi.id = invite_uuid
        and pi.status = 'pending'
        and pi.expires_at > now()
        and pi.email = p.email
    );
$$;

alter table public.project_invites enable row level security;

create policy "project_invites_select_visible"
  on public.project_invites
  for select
  to authenticated
  using (
    public.is_project_owner(project_id)
    or public.is_project_invite_recipient(id)
  );

create policy "project_invites_insert_owner"
  on public.project_invites
  for insert
  to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_project_owner(project_id)
  );

create policy "project_invites_update_owner"
  on public.project_invites
  for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "project_invites_delete_owner"
  on public.project_invites
  for delete
  to authenticated
  using (public.is_project_owner(project_id));

commit;
