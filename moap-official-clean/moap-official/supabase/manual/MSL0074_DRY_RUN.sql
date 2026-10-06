-- READ ONLY. Run this in the production SQL editor and review every result
-- before preparing/running the guarded apply template. This script does not
-- modify any table or infer which source ID is which half.

-- 1) All records on the requested date with raw result and direction-cell
-- evidence. The MVP IDs show the current per-source-row MVP flags.
select
  m.id as match_id,
  m.season_id as season,
  m.round,
  m.match_date,
  m.match_type,
  m.venue,
  m.notes,
  m.status,
  coalesce((
    select jsonb_agg(to_jsonb(r) order by r.player_id)
    from public.match_results r
    where r.match_id = m.id
  ), '[]'::jsonb) as source_results,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'from_player_id', t.from_player_id,
        'to_player_id', t.to_player_id,
        'points', t.points
      ) order by t.from_player_id, t.to_player_id
    )
    from public.matchup_transfers t
    where t.match_id = m.id
  ), '[]'::jsonb) as source_matchups,
  (select count(*) from public.match_results r where r.match_id = m.id and not r.is_absent) as active_players,
  (select coalesce(sum(r.score), 0) from public.match_results r where r.match_id = m.id and not r.is_absent) as score_sum,
  (select count(*) from public.matchup_transfers t where t.match_id = m.id) as matchup_cell_count
from public.matches m
where m.match_date = date '2026-10-05'
order by m.id;

-- 2) Per-source direction row sums, expected directed-cell count, and
-- score comparison. Rows with missing cells or mismatched sums are visible.
select
  m.id as match_id,
  r.player_id,
  p.name as player,
  r.score,
  count(t.from_player_id) filter (where t.to_player_id <> r.player_id) as outgoing_cell_count,
  count(distinct t.to_player_id) filter (where t.to_player_id <> r.player_id) as distinct_targets,
  count(t.from_player_id) filter (where t.to_player_id = r.player_id) as self_direction_count,
  coalesce(sum(t.points) filter (where t.to_player_id <> r.player_id), 0) as outgoing_row_sum,
  (select count(*) - 1 from public.match_results expected
   where expected.match_id = m.id and not expected.is_absent) as expected_outgoing_cells,
  coalesce(sum(t.points) filter (where t.to_player_id <> r.player_id), 0) = r.score as row_matches_score
from public.matches m
join public.match_results r on r.match_id = m.id
join public.players p on p.id = r.player_id
left join public.matchup_transfers t
  on t.match_id = m.id and t.from_player_id = r.player_id
where m.match_date = date '2026-10-05'
  and m.status = 'official'
  and not r.is_absent
group by m.id, r.player_id, p.name, r.score
order by m.id, r.player_id;

-- 3) Candidate official totals across every official match row on the date.
-- This is only a comparison aid: it does not identify first/second half.
with source_matches as (
  select m.id
  from public.matches m
  where m.match_date = date '2026-10-05'
    and m.status = 'official'
), result_totals as (
  select
    r.player_id,
    bool_and(r.is_absent) as is_absent,
    case when bool_and(r.is_absent) then null else sum(r.score)::integer end as score,
    bool_or(r.is_mvp) as source_half_had_mvp
  from public.match_results r
  join source_matches s on s.id = r.match_id
  group by r.player_id
), matchup_totals as (
  select t.from_player_id, t.to_player_id, sum(t.points)::integer as points
  from public.matchup_transfers t
  join source_matches s on s.id = t.match_id
  group by t.from_player_id, t.to_player_id
)
select
  (select count(*) from source_matches) as official_source_match_count,
  (select jsonb_agg(to_jsonb(result_totals) order by player_id) from result_totals) as candidate_combined_results,
  (select coalesce(sum(score), 0) from result_totals where not is_absent) as candidate_score_sum,
  (select jsonb_agg(to_jsonb(matchup_totals) order by from_player_id, to_player_id) from matchup_totals) as candidate_combined_matchups;

