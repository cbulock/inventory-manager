begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.project_member_role as enum ('owner', 'editor', 'viewer');
create type public.item_adjustment_reason as enum ('restock', 'usage', 'correction', 'inventory_count', 'other');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_types (
  id text primary key,
  label text not null unique,
  description text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.suggested_items (
  id text primary key,
  project_type_id text not null references public.project_types (id) on delete cascade,
  name text not null,
  default_unit text not null,
  description text,
  created_at timestamptz not null default now()
);

create unique index suggested_items_project_type_name_key
  on public.suggested_items (project_type_id, lower(name));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  project_type_id text references public.project_types (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_owner_name_key
  on public.projects (owner_id, lower(name));

create index projects_project_type_id_idx
  on public.projects (project_type_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_member_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_id_idx
  on public.project_members (user_id);

create index project_members_role_idx
  on public.project_members (role);

create table public.item_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_tags_color_format check (
    color is null or color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'
  )
);

create unique index item_tags_owner_name_key
  on public.item_tags (owner_id, lower(name));

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  suggested_item_id text references public.suggested_items (id) on delete set null,
  name text not null,
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  unit text not null default 'units',
  low_stock_threshold numeric(12, 2) not null default 0 check (low_stock_threshold >= 0),
  storage_location text,
  vendor text,
  cost numeric(12, 2) check (cost is null or cost >= 0),
  currency_code text not null default 'USD',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_items_currency_code_length check (char_length(currency_code) = 3)
);

create unique index project_items_project_name_key
  on public.project_items (project_id, lower(name));

create index project_items_project_id_idx
  on public.project_items (project_id);

create index project_items_low_stock_idx
  on public.project_items (project_id, low_stock_threshold, quantity);

create table public.item_photos (
  project_item_id uuid primary key references public.project_items (id) on delete cascade,
  storage_path text not null unique,
  mime_type text,
  file_size_bytes bigint,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_photos_file_size_positive check (
    file_size_bytes is null or file_size_bytes > 0
  )
);

create table public.item_tag_links (
  project_item_id uuid not null references public.project_items (id) on delete cascade,
  tag_id uuid not null references public.item_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_item_id, tag_id)
);

create index item_tag_links_tag_id_idx
  on public.item_tag_links (tag_id);

create table public.item_adjustments (
  id uuid primary key default gen_random_uuid(),
  project_item_id uuid not null references public.project_items (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  reason public.item_adjustment_reason not null default 'correction',
  delta numeric(12, 2) not null check (delta <> 0),
  previous_quantity numeric(12, 2) not null check (previous_quantity >= 0),
  new_quantity numeric(12, 2) not null check (new_quantity >= 0),
  note text,
  created_at timestamptz not null default now(),
  constraint item_adjustments_math check (previous_quantity + delta = new_quantity)
);

create index item_adjustments_project_item_created_idx
  on public.item_adjustments (project_item_id, created_at desc);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_profile_sync();

create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_profile_sync();

create or replace function public.ensure_project_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role, invited_by)
  values (new.id, new.owner_id, 'owner', new.owner_id)
  on conflict (project_id, user_id) do update
  set role = 'owner';

  return new;
end;
$$;

create trigger ensure_project_owner_membership_after_insert
  after insert on public.projects
  for each row execute function public.ensure_project_owner_membership();

create or replace function public.enforce_owner_membership_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  project_owner_id uuid;
begin
  select owner_id
    into project_owner_id
  from public.projects
  where id = coalesce(new.project_id, old.project_id);

  if tg_op <> 'DELETE' and new.role = 'owner' and new.user_id <> project_owner_id then
    raise exception 'Only the project owner can hold the owner role.';
  end if;

  if tg_op = 'UPDATE'
     and old.role = 'owner'
     and old.user_id = project_owner_id
     and (new.role <> 'owner' or new.user_id <> old.user_id) then
    raise exception 'The owner membership row cannot be reassigned or downgraded.';
  end if;

  if tg_op = 'DELETE'
     and old.role = 'owner'
     and old.user_id = project_owner_id then
    raise exception 'The owner membership row cannot be deleted.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger enforce_owner_membership_before_insert
  before insert on public.project_members
  for each row execute function public.enforce_owner_membership_role();

create trigger enforce_owner_membership_before_update
  before update on public.project_members
  for each row execute function public.enforce_owner_membership_role();

create trigger enforce_owner_membership_before_delete
  before delete on public.project_members
  for each row execute function public.enforce_owner_membership_role();

create or replace function public.validate_item_tag_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tag_owner_id uuid;
  project_owner_id uuid;
begin
  select owner_id
    into tag_owner_id
  from public.item_tags
  where id = new.tag_id;

  select p.owner_id
    into project_owner_id
  from public.project_items pi
  join public.projects p on p.id = pi.project_id
  where pi.id = new.project_item_id;

  if tag_owner_id is null or project_owner_id is null or tag_owner_id <> project_owner_id then
    raise exception 'Tags linked to an item must belong to the project owner.';
  end if;

  return new;
end;
$$;

create trigger validate_item_tag_link_before_write
  before insert or update on public.item_tag_links
  for each row execute function public.validate_item_tag_link();

create or replace function public.storage_project_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  parsed_project_id uuid;
begin
  begin
    parsed_project_id := nullif(split_part(object_name, '/', 1), '')::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  return parsed_project_id;
end;
$$;

create or replace function public.validate_item_photo_storage_path()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_project_id uuid;
begin
  select project_id
    into expected_project_id
  from public.project_items
  where id = new.project_item_id;

  if expected_project_id is null then
    raise exception 'The target project item does not exist.';
  end if;

  if public.storage_project_id(new.storage_path) is distinct from expected_project_id then
    raise exception 'Item photo paths must start with the project id (project-id/item-id/file-name).';
  end if;

  return new;
end;
$$;

create trigger validate_item_photo_storage_path_before_write
  before insert or update on public.item_photos
  for each row execute function public.validate_item_photo_storage_path();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_item_tags_updated_at
  before update on public.item_tags
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_project_items_updated_at
  before update on public.project_items
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_item_photos_updated_at
  before update on public.item_photos
  for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.users_share_project(left_user_uuid uuid, right_user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members left_pm
    join public.project_members right_pm
      on right_pm.project_id = left_pm.project_id
    where left_pm.user_id = left_user_uuid
      and right_pm.user_id = right_user_uuid
  );
$$;

create or replace function public.can_view_profile(target_user_uuid uuid, requester_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select requester_uuid is not null
    and (
      target_user_uuid = requester_uuid
      or public.users_share_project(target_user_uuid, requester_uuid)
    );
$$;

create or replace function public.is_project_owner(project_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_uuid is not null
    and exists (
      select 1
      from public.projects
      where id = project_uuid
        and owner_id = user_uuid
    );
$$;

create or replace function public.is_project_member(project_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_uuid is not null
    and exists (
      select 1
      from public.project_members
      where project_id = project_uuid
        and user_id = user_uuid
    );
$$;

create or replace function public.can_edit_project(project_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_uuid is not null
    and exists (
      select 1
      from public.project_members
      where project_id = project_uuid
        and user_id = user_uuid
        and role in ('owner', 'editor')
    );
$$;

create or replace function public.can_view_owner_tags(owner_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_uuid is not null
    and (
      owner_uuid = user_uuid
      or exists (
        select 1
        from public.projects p
        join public.project_members pm on pm.project_id = p.id
        where p.owner_id = owner_uuid
          and pm.user_id = user_uuid
      )
    );
$$;

create or replace function public.can_read_project_item(project_item_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_uuid is not null
    and exists (
      select 1
      from public.project_items pi
      join public.project_members pm on pm.project_id = pi.project_id
      where pi.id = project_item_uuid
        and pm.user_id = user_uuid
    );
$$;

create or replace function public.can_edit_project_item(project_item_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_uuid is not null
    and exists (
      select 1
      from public.project_items pi
      join public.project_members pm on pm.project_id = pi.project_id
      where pi.id = project_item_uuid
        and pm.user_id = user_uuid
        and pm.role in ('owner', 'editor')
    );
$$;

create or replace function public.create_project_item_with_tags(
  project_uuid uuid,
  item_name text,
  item_quantity numeric(12, 2) default 0,
  item_unit text default 'units',
  item_low_stock_threshold numeric(12, 2) default 0,
  item_storage_location text default null,
  item_vendor text default null,
  item_cost numeric(12, 2) default null,
  item_notes text default null,
  suggested_item_key text default null,
  existing_tag_ids uuid[] default null,
  new_tag_names text[] default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  created_item_id uuid;
  project_owner_id uuid;
  resolved_tag_id uuid;
  normalized_tag_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if coalesce(btrim(item_name), '') = '' then
    raise exception 'Item name is required.';
  end if;

  if not public.can_edit_project(project_uuid) then
    raise exception 'You do not have permission to edit this project.';
  end if;

  select owner_id
    into project_owner_id
  from public.projects
  where id = project_uuid;

  if project_owner_id is null then
    raise exception 'Project not found.';
  end if;

  insert into public.project_items (
    project_id,
    created_by,
    suggested_item_id,
    name,
    quantity,
    unit,
    low_stock_threshold,
    storage_location,
    vendor,
    cost,
    notes
  )
  values (
    project_uuid,
    auth.uid(),
    suggested_item_key,
    btrim(item_name),
    coalesce(item_quantity, 0),
    coalesce(nullif(btrim(item_unit), ''), 'units'),
    coalesce(item_low_stock_threshold, 0),
    nullif(btrim(item_storage_location), ''),
    nullif(btrim(item_vendor), ''),
    item_cost,
    nullif(btrim(item_notes), '')
  )
  returning id into created_item_id;

  if existing_tag_ids is not null and array_length(existing_tag_ids, 1) > 0 then
    insert into public.item_tag_links (project_item_id, tag_id)
    select created_item_id, selected_tag_id
    from unnest(existing_tag_ids) as selected_tag_id
    on conflict do nothing;
  end if;

  if new_tag_names is not null and array_length(new_tag_names, 1) > 0 then
    foreach normalized_tag_name in array new_tag_names loop
      normalized_tag_name := btrim(normalized_tag_name);

      if normalized_tag_name = '' then
        continue;
      end if;

      select id
        into resolved_tag_id
      from public.item_tags
      where owner_id = project_owner_id
        and lower(name) = lower(normalized_tag_name)
      limit 1;

      if resolved_tag_id is null then
        insert into public.item_tags (owner_id, name)
        values (project_owner_id, normalized_tag_name)
        returning id into resolved_tag_id;
      end if;

      insert into public.item_tag_links (project_item_id, tag_id)
      values (created_item_id, resolved_tag_id)
      on conflict do nothing;
    end loop;
  end if;

  return created_item_id;
end;
$$;

create or replace function public.adjust_project_item_quantity(
  project_item_uuid uuid,
  delta_value numeric(12, 2),
  adjustment_reason public.item_adjustment_reason default 'correction',
  adjustment_note text default null
)
returns public.project_items
language plpgsql
set search_path = public
as $$
declare
  current_item public.project_items%rowtype;
  updated_item public.project_items%rowtype;
  next_quantity numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if delta_value = 0 then
    raise exception 'Adjustment delta must be non-zero.';
  end if;

  select *
    into current_item
  from public.project_items
  where id = project_item_uuid;

  if current_item.id is null then
    raise exception 'Project item not found.';
  end if;

  if not public.can_edit_project(current_item.project_id) then
    raise exception 'You do not have permission to edit this project.';
  end if;

  next_quantity := current_item.quantity + delta_value;

  if next_quantity < 0 then
    raise exception 'This adjustment would make the quantity negative.';
  end if;

  update public.project_items
  set quantity = next_quantity
  where id = project_item_uuid
  returning * into updated_item;

  insert into public.item_adjustments (
    project_item_id,
    actor_user_id,
    reason,
    delta,
    previous_quantity,
    new_quantity,
    note
  )
  values (
    project_item_uuid,
    auth.uid(),
    adjustment_reason,
    delta_value,
    current_item.quantity,
    updated_item.quantity,
    nullif(btrim(adjustment_note), '')
  );

  return updated_item;
end;
$$;

create or replace function public.update_project_item_with_tags(
  project_item_uuid uuid,
  item_name text,
  item_quantity numeric(12, 2) default 0,
  item_unit text default 'units',
  item_low_stock_threshold numeric(12, 2) default 0,
  item_storage_location text default null,
  item_vendor text default null,
  item_cost numeric(12, 2) default null,
  item_notes text default null,
  suggested_item_key text default null,
  existing_tag_ids uuid[] default null,
  new_tag_names text[] default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  current_item public.project_items%rowtype;
  project_owner_id uuid;
  resolved_tag_id uuid;
  normalized_tag_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if coalesce(btrim(item_name), '') = '' then
    raise exception 'Item name is required.';
  end if;

  select *
    into current_item
  from public.project_items
  where id = project_item_uuid;

  if current_item.id is null then
    raise exception 'Project item not found.';
  end if;

  if not public.can_edit_project(current_item.project_id) then
    raise exception 'You do not have permission to edit this project.';
  end if;

  select owner_id
    into project_owner_id
  from public.projects
  where id = current_item.project_id;

  if project_owner_id is null then
    raise exception 'Project not found.';
  end if;

  update public.project_items
  set
    suggested_item_id = suggested_item_key,
    name = btrim(item_name),
    quantity = coalesce(item_quantity, 0),
    unit = coalesce(nullif(btrim(item_unit), ''), 'units'),
    low_stock_threshold = coalesce(item_low_stock_threshold, 0),
    storage_location = nullif(btrim(item_storage_location), ''),
    vendor = nullif(btrim(item_vendor), ''),
    cost = item_cost,
    notes = nullif(btrim(item_notes), '')
  where id = project_item_uuid;

  delete from public.item_tag_links
  where project_item_id = project_item_uuid;

  if existing_tag_ids is not null and array_length(existing_tag_ids, 1) > 0 then
    insert into public.item_tag_links (project_item_id, tag_id)
    select project_item_uuid, selected_tag_id
    from unnest(existing_tag_ids) as selected_tag_id
    on conflict do nothing;
  end if;

  if new_tag_names is not null and array_length(new_tag_names, 1) > 0 then
    foreach normalized_tag_name in array new_tag_names loop
      normalized_tag_name := btrim(normalized_tag_name);

      if normalized_tag_name = '' then
        continue;
      end if;

      select id
        into resolved_tag_id
      from public.item_tags
      where owner_id = project_owner_id
        and lower(name) = lower(normalized_tag_name)
      limit 1;

      if resolved_tag_id is null then
        insert into public.item_tags (owner_id, name)
        values (project_owner_id, normalized_tag_name)
        returning id into resolved_tag_id;
      end if;

      insert into public.item_tag_links (project_item_id, tag_id)
      values (project_item_uuid, resolved_tag_id)
      on conflict do nothing;
    end loop;
  end if;

  return project_item_uuid;
end;
$$;

alter table public.profiles enable row level security;
alter table public.project_types enable row level security;
alter table public.suggested_items enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.item_tags enable row level security;
alter table public.project_items enable row level security;
alter table public.item_photos enable row level security;
alter table public.item_tag_links enable row level security;
alter table public.item_adjustments enable row level security;

create policy "profiles_select_shared"
  on public.profiles
  for select
  to authenticated
  using (public.can_view_profile(id));

create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "project_types_read_authenticated"
  on public.project_types
  for select
  to authenticated
  using (true);

create policy "suggested_items_read_authenticated"
  on public.suggested_items
  for select
  to authenticated
  using (true);

create policy "projects_select_members"
  on public.projects
  for select
  to authenticated
  using (public.is_project_member(id));

create policy "projects_insert_owner"
  on public.projects
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "projects_update_owner"
  on public.projects
  for update
  to authenticated
  using (public.is_project_owner(id))
  with check (owner_id = auth.uid());

create policy "projects_delete_owner"
  on public.projects
  for delete
  to authenticated
  using (public.is_project_owner(id));

create policy "project_members_select_members"
  on public.project_members
  for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "project_members_insert_owner"
  on public.project_members
  for insert
  to authenticated
  with check (public.is_project_owner(project_id));

create policy "project_members_update_owner"
  on public.project_members
  for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "project_members_delete_owner"
  on public.project_members
  for delete
  to authenticated
  using (public.is_project_owner(project_id));

create policy "item_tags_select_owner_scope"
  on public.item_tags
  for select
  to authenticated
  using (public.can_view_owner_tags(owner_id));

create policy "item_tags_insert_owner"
  on public.item_tags
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "item_tags_update_owner"
  on public.item_tags
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "item_tags_delete_owner"
  on public.item_tags
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "project_items_select_members"
  on public.project_items
  for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "project_items_insert_editors"
  on public.project_items
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.can_edit_project(project_id)
  );

create policy "project_items_update_editors"
  on public.project_items
  for update
  to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

create policy "project_items_delete_editors"
  on public.project_items
  for delete
  to authenticated
  using (public.can_edit_project(project_id));

create policy "item_photos_select_members"
  on public.item_photos
  for select
  to authenticated
  using (public.can_read_project_item(project_item_id));

create policy "item_photos_insert_editors"
  on public.item_photos
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.can_edit_project_item(project_item_id)
  );

create policy "item_photos_update_editors"
  on public.item_photos
  for update
  to authenticated
  using (public.can_edit_project_item(project_item_id))
  with check (public.can_edit_project_item(project_item_id));

create policy "item_photos_delete_editors"
  on public.item_photos
  for delete
  to authenticated
  using (public.can_edit_project_item(project_item_id));

create policy "item_tag_links_select_members"
  on public.item_tag_links
  for select
  to authenticated
  using (public.can_read_project_item(project_item_id));

create policy "item_tag_links_insert_editors"
  on public.item_tag_links
  for insert
  to authenticated
  with check (public.can_edit_project_item(project_item_id));

create policy "item_tag_links_delete_editors"
  on public.item_tag_links
  for delete
  to authenticated
  using (public.can_edit_project_item(project_item_id));

create policy "item_adjustments_select_members"
  on public.item_adjustments
  for select
  to authenticated
  using (public.can_read_project_item(project_item_id));

create policy "item_adjustments_insert_editors"
  on public.item_adjustments
  for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and public.can_edit_project_item(project_item_id)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-photos',
  'item-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "item_photos_storage_select_members"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'item-photos'
    and public.is_project_member(public.storage_project_id(name))
  );

create policy "item_photos_storage_insert_editors"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'item-photos'
    and public.can_edit_project(public.storage_project_id(name))
  );

create policy "item_photos_storage_update_editors"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'item-photos'
    and public.can_edit_project(public.storage_project_id(name))
  )
  with check (
    bucket_id = 'item-photos'
    and public.can_edit_project(public.storage_project_id(name))
  );

create policy "item_photos_storage_delete_editors"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'item-photos'
    and public.can_edit_project(public.storage_project_id(name))
  );

commit;
