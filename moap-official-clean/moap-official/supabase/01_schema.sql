-- MOAP Official Free Edition v1.0
create extension if not exists pgcrypto;

create table if not exists public.players (
  id text primary key,
  name text not null unique,
  join_season text not null default 'S1',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.seasons (
  id text primary key,
  name text not null,
  start_date date,
  end_date date,
  status text not null default 'closed' check (status in ('draft','active','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  season_id text not null references public.seasons(id),
  round integer not null,
  match_date date not null,
  match_type text not null check (match_type in ('四人局','五人局')),
  venue text,
  is_home_venue boolean not null default false,
  notes text,
  status text not null default 'official' check (status in ('draft','official','void')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id, round)
);

create table if not exists public.match_results (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(id) on delete cascade,
  player_id text not null references public.players(id),
  score integer,
  is_mvp boolean not null default false,
  is_absent boolean not null default false,
  created_at timestamptz not null default now(),
  unique(match_id, player_id),
  check ((is_absent and score is null) or (not is_absent and score is not null))
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id text references public.players(id),
  display_name text,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.award_results (
  id bigint generated always as identity primary key,
  player_id text not null references public.players(id),
  scope text not null,
  award_id text not null,
  award_name text not null,
  grade text not null,
  category text not null,
  value numeric,
  points integer not null default 0,
  status text not null,
  certified_version text not null default 'v10.1 LTS Official',
  unique(player_id, scope, award_id)
);

create table if not exists public.system_versions (
  version text primary key,
  release_date date,
  stage text,
  status text,
  formula_integrity text,
  certification text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(user_id, display_name, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'viewer')
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
