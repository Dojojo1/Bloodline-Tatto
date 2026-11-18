-- Premier module de gestion : comptes invités et pointage personnel.
create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_members(user_id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint work_sessions_valid_time check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists one_open_work_session_per_user
  on public.work_sessions(user_id) where ended_at is null;
create index if not exists work_sessions_user_started_idx
  on public.work_sessions(user_id, started_at desc);

create or replace function public.stamp_work_session()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
    new.ended_at := null;
    return new;
  end if;
  if old.ended_at is not null then
    raise exception 'Ce service est déjà terminé';
  end if;
  new.id := old.id;
  new.user_id := old.user_id;
  new.started_at := old.started_at;
  new.ended_at := now();
  return new;
end;
$$;

drop trigger if exists stamp_work_session_trigger on public.work_sessions;
create trigger stamp_work_session_trigger
  before insert or update on public.work_sessions
  for each row execute function public.stamp_work_session();

alter table public.staff_members enable row level security;
alter table public.work_sessions enable row level security;

create policy "read own staff profile" on public.staff_members
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own work sessions" on public.work_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "start own work session" on public.work_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.staff_members member
      where member.user_id = (select auth.uid()) and member.active
    )
  );
create policy "end own work session" on public.work_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id and ended_at is null)
  with check ((select auth.uid()) = user_id);

revoke all on public.staff_members from anon, authenticated;
revoke all on public.work_sessions from anon, authenticated;
grant select on public.staff_members to authenticated;
grant select, insert(user_id), update(ended_at) on public.work_sessions to authenticated;

-- Ajouter les membres uniquement après invitation dans Supabase Auth :
-- insert into public.staff_members (user_id, display_name) values ('UUID_DU_COMPTE', 'Prénom');
-- Aucun compte n'est créé par cette migration.
