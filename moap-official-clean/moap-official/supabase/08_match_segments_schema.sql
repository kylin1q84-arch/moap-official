-- MSL0074-only evidence storage. This schema change does not alter official
-- match rows, results, matchup totals, RPCs, or any calculation engine.
begin;

create table if not exists public.match_segments (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(id) on delete cascade,
  segment_key text not null,
  segment_label text not null,
  segment_order smallint not null,
  source_metadata jsonb not null default '{}'::jsonb,
  results jsonb not null,
  matchups jsonb not null,
  created_at timestamptz not null default now(),
  constraint match_segments_msl0074_only check (match_id = 'MSL0074'),
  constraint match_segments_key_order check (
    (segment_key = 'first_half' and segment_label = '上半场' and segment_order = 1)
    or
    (segment_key = 'second_half' and segment_label = '下半场' and segment_order = 2)
  ),
  constraint match_segments_results_array check (jsonb_typeof(results) = 'array'),
  constraint match_segments_matchups_array check (jsonb_typeof(matchups) = 'array'),
  constraint match_segments_unique_key unique (match_id, segment_key),
  constraint match_segments_unique_order unique (match_id, segment_order)
);

comment on table public.match_segments is
  'MSL0074 first/second-half source evidence only; never an official match/statistics source.';
comment on column public.match_segments.source_metadata is
  'Original half-match metadata retained for audit and provenance.';
comment on column public.match_segments.results is
  'Original match_results rows as JSONB, including original MVP/absence state.';
comment on column public.match_segments.matchups is
  'Original directional matchup_transfers rows as JSONB, including explicit zero cells.';

alter table public.match_segments enable row level security;
drop policy if exists "public read MSL0074 match segments" on public.match_segments;
create policy "public read MSL0074 match segments"
  on public.match_segments
  for select
  to anon, authenticated
  using (true);

revoke all on public.match_segments from public, anon, authenticated;
grant select on public.match_segments to anon, authenticated;

commit;
