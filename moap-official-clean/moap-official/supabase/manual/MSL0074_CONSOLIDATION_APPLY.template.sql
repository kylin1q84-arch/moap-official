-- DESTRUCTIVE, ONE-OFF TEMPLATE. Do not run until the read-only
-- MSL0074_DRY_RUN.sql output has been reviewed and the source IDs and half
-- mapping have been explicitly confirmed by a human.
-- Replace both __CONFIRMED_...__ strings below with the exact audited IDs.
-- An unedited template raises before writing anything; any failed assertion
-- aborts the transaction and rolls back every change.

begin;

do $msl0074_consolidation$
declare
  v_keep_id constant text := 'MSL0074';
  v_first_id text := '__CONFIRMED_FIRST_HALF_MATCH_ID__';
  v_second_id text := '__CONFIRMED_SECOND_HALF_MATCH_ID__';
  v_first public.matches%rowtype;
  v_second public.matches%rowtype;
  v_delete_id text;
  v_expected integer;
  v_first_active integer;
  v_second_active integer;
  v_first_sum integer;
  v_second_sum integer;
  v_official_count integer;
  v_result_rows integer;
  v_final_results jsonb;
  v_final_matchups jsonb;
  v_before jsonb;
  v_after jsonb;
  v_max_score integer;
  v_mvp_count integer;
  v_segment_count integer;
  v_deleted integer;
  v_check record;
begin
  if v_first_id like '__CONFIRMED_%' or v_second_id like '__CONFIRMED_%'
     or v_first_id = v_second_id then
    raise exception 'Replace the two distinct source IDs only after reviewing the production dry run.';
  end if;

  select * into v_first from public.matches where id = v_first_id;
  if not found then raise exception 'Confirmed first-half source ID % was not found.', v_first_id; end if;
  select * into v_second from public.matches where id = v_second_id;
  if not found then raise exception 'Confirmed second-half source ID % was not found.', v_second_id; end if;

  if v_first.id <> v_keep_id and v_second.id <> v_keep_id then
    raise exception 'One confirmed source row must already be MSL0074; this template does not rename or create an official match.';
  end if;
  if v_first.match_date <> date '2026-10-05' or v_second.match_date <> date '2026-10-05'
     or v_first.status <> 'official' or v_second.status <> 'official' then
    raise exception 'Both confirmed IDs must be official source matches dated 2026-10-05.';
  end if;
  if v_first.season_id is distinct from v_second.season_id
     or v_first.round is distinct from v_second.round
     or v_first.match_type is distinct from v_second.match_type
     or v_first.venue is distinct from v_second.venue then
    raise exception 'Season, round, match type, or venue differs between halves; human resolution is required.';
  end if;

  select count(*) into v_official_count
  from public.matches
  where match_date = date '2026-10-05' and status = 'official';
  if v_official_count <> 2 or exists (
    select 1 from public.matches
    where match_date = date '2026-10-05' and status = 'official'
      and id not in (v_first_id, v_second_id)
  ) then
    raise exception 'Expected exactly the two confirmed official source matches on 2026-10-05; found %.', v_official_count;
  end if;

  if exists (
    select player_id, is_absent from public.match_results where match_id = v_first_id
    except select player_id, is_absent from public.match_results where match_id = v_second_id
  ) or exists (
    select player_id, is_absent from public.match_results where match_id = v_second_id
    except select player_id, is_absent from public.match_results where match_id = v_first_id
  ) then
    raise exception 'The two halves do not have the same result-player/absence roster.';
  end if;

  v_expected := case v_first.match_type when '四人局' then 4 when '五人局' then 5 else 0 end;
  if v_expected = 0 then raise exception 'Unrecognized match_type %.', v_first.match_type; end if;
  select count(*) filter (where not is_absent), coalesce(sum(score) filter (where not is_absent), 0), count(*)
    into v_first_active, v_first_sum, v_result_rows
  from public.match_results where match_id = v_first_id;
  if v_first_active <> v_expected or v_first_sum <> 0 or v_result_rows = 0 then
    raise exception 'First half participant count/score sum invalid (active %, sum %, rows %).', v_first_active, v_first_sum, v_result_rows;
  end if;
  select count(*) filter (where not is_absent), coalesce(sum(score) filter (where not is_absent), 0), count(*)
    into v_second_active, v_second_sum, v_result_rows
  from public.match_results where match_id = v_second_id;
  if v_second_active <> v_expected or v_second_sum <> 0 or v_result_rows = 0 then
    raise exception 'Second half participant count/score sum invalid (active %, sum %, rows %).', v_second_active, v_second_sum, v_result_rows;
  end if;

  if exists (
    select 1 from public.matchup_transfers t
    where t.match_id in (v_first_id, v_second_id)
      and (t.from_player_id = t.to_player_id
        or not exists (select 1 from public.match_results r where r.match_id = t.match_id and r.player_id = t.from_player_id and not r.is_absent)
        or not exists (select 1 from public.match_results r where r.match_id = t.match_id and r.player_id = t.to_player_id and not r.is_absent))
  ) then
    raise exception 'A source direction cell is self-directed or references a nonparticipant.';
  end if;
  if exists (
    select match_id, from_player_id, to_player_id
    from public.matchup_transfers
    where match_id in (v_first_id, v_second_id)
    group by match_id, from_player_id, to_player_id
    having count(*) <> 1
  ) then
    raise exception 'Duplicate directional cells exist in a source half.';
  end if;

  for v_check in
    select r.match_id, r.player_id, r.score,
      count(t.from_player_id)::integer as cell_count,
      coalesce(sum(t.points), 0)::integer as row_sum
    from public.match_results r
    left join public.matchup_transfers t
      on t.match_id = r.match_id and t.from_player_id = r.player_id and t.to_player_id <> r.player_id
    where r.match_id in (v_first_id, v_second_id) and not r.is_absent
    group by r.match_id, r.player_id, r.score
  loop
    if v_check.cell_count <> v_expected - 1 or v_check.row_sum <> v_check.score then
      raise exception 'Source matrix invalid for match %, player %: cells %, expected %, row sum %, score %.',
        v_check.match_id, v_check.player_id, v_check.cell_count, v_expected - 1, v_check.row_sum, v_check.score;
    end if;
  end loop;

  with totals as (
    select r.player_id,
      bool_and(r.is_absent) as is_absent,
      case when bool_and(r.is_absent) then null else (sum(r.score) filter (where not r.is_absent))::integer end as score
    from public.match_results r
    where r.match_id in (v_first_id, v_second_id)
    group by r.player_id
  ), best as (
    select max(score) filter (where not is_absent) as score from totals
  )
  select jsonb_agg(jsonb_build_object(
    'player_id', totals.player_id,
    'score', totals.score,
    'is_absent', totals.is_absent,
    'is_mvp', not totals.is_absent and totals.score = best.score
  ) order by totals.player_id)
  into v_final_results
  from totals cross join best;

  select max((item->>'score')::integer), count(*) filter (where (item->>'is_mvp')::boolean)
    into v_max_score, v_mvp_count
  from jsonb_array_elements(v_final_results) as results(item)
  where not (item->>'is_absent')::boolean;
  if v_mvp_count <> 1 then raise exception 'Combined final score has % MVP winners; exactly one is required.', v_mvp_count; end if;
  if (select coalesce(sum((item->>'score')::integer), 0) from jsonb_array_elements(v_final_results) as results(item) where not (item->>'is_absent')::boolean) <> 0 then
    raise exception 'Combined final scores do not sum to zero.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'from_player_id', totals.from_player_id,
    'to_player_id', totals.to_player_id,
    'points', totals.points
  ) order by totals.from_player_id, totals.to_player_id)
  into v_final_matchups
  from (
    select t.from_player_id, t.to_player_id, sum(t.points)::integer as points
    from public.matchup_transfers t
    where t.match_id in (v_first_id, v_second_id)
    group by t.from_player_id, t.to_player_id
  ) totals;

  if coalesce(jsonb_array_length(v_final_matchups), 0) <> v_expected * (v_expected - 1) then
    raise exception 'Combined directional matrix has % cells; expected %.',
      coalesce(jsonb_array_length(v_final_matchups), 0), v_expected * (v_expected - 1);
  end if;
  for v_check in
    select (result->>'player_id') as player_id,
      (result->>'score')::integer as score,
      count(cell->>'to_player_id')::integer as cell_count,
      coalesce(sum((cell->>'points')::integer), 0)::integer as row_sum
    from jsonb_array_elements(v_final_results) as results(result)
    left join jsonb_array_elements(v_final_matchups) as cells(cell)
      on cell->>'from_player_id' = result->>'player_id'
    where not (result->>'is_absent')::boolean
    group by result->>'player_id', result->>'score'
  loop
    if v_check.cell_count <> v_expected - 1 or v_check.row_sum <> v_check.score then
      raise exception 'Combined matrix invalid for player %: cells %, expected %, row sum %, final score %.',
        v_check.player_id, v_check.cell_count, v_expected - 1, v_check.row_sum, v_check.score;
    end if;
  end loop;

  if exists (select 1 from public.match_segments where match_id = v_keep_id) then
    raise exception 'MSL0074 already has segment evidence; this one-off migration is not repeatable.';
  end if;

  v_delete_id := case when v_first_id = v_keep_id then v_second_id else v_first_id end;
  v_before := jsonb_build_object(
    'source_matches', jsonb_build_array(to_jsonb(v_first), to_jsonb(v_second)),
    'source_results', jsonb_build_object(
      'first_half', (select coalesce(jsonb_agg(to_jsonb(r) order by r.player_id), '[]'::jsonb) from public.match_results r where r.match_id = v_first_id),
      'second_half', (select coalesce(jsonb_agg(to_jsonb(r) order by r.player_id), '[]'::jsonb) from public.match_results r where r.match_id = v_second_id)
    ),
    'source_matchups', jsonb_build_object(
      'first_half', (select coalesce(jsonb_agg(to_jsonb(t) order by t.from_player_id,t.to_player_id), '[]'::jsonb) from public.matchup_transfers t where t.match_id = v_first_id),
      'second_half', (select coalesce(jsonb_agg(to_jsonb(t) order by t.from_player_id,t.to_player_id), '[]'::jsonb) from public.matchup_transfers t where t.match_id = v_second_id)
    )
  );

  -- Store both raw halves before touching official rows; original MVP flags are
  -- retained in evidence JSON but never displayed as official segment MVPs.
  insert into public.match_segments(match_id, segment_key, segment_label, segment_order, source_metadata, results, matchups)
  values
    (v_keep_id, 'first_half', '上半场', 1, to_jsonb(v_first),
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.player_id), '[]'::jsonb) from public.match_results r where r.match_id = v_first_id),
      (select coalesce(jsonb_agg(to_jsonb(t) order by t.from_player_id,t.to_player_id), '[]'::jsonb) from public.matchup_transfers t where t.match_id = v_first_id)),
    (v_keep_id, 'second_half', '下半场', 2, to_jsonb(v_second),
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.player_id), '[]'::jsonb) from public.match_results r where r.match_id = v_second_id),
      (select coalesce(jsonb_agg(to_jsonb(t) order by t.from_player_id,t.to_player_id), '[]'::jsonb) from public.matchup_transfers t where t.match_id = v_second_id));

  delete from public.matchup_transfers where match_id in (v_keep_id, v_delete_id);
  delete from public.match_results where match_id in (v_keep_id, v_delete_id);
  insert into public.match_results(match_id, player_id, score, is_mvp, is_absent)
  select v_keep_id, (item->>'player_id'), (item->>'score')::integer,
    (item->>'is_mvp')::boolean, (item->>'is_absent')::boolean
  from jsonb_array_elements(v_final_results) as results(item);
  insert into public.matchup_transfers(match_id, from_player_id, to_player_id, points)
  select v_keep_id, (item->>'from_player_id'), (item->>'to_player_id'), (item->>'points')::integer
  from jsonb_array_elements(v_final_matchups) as matchups(item);

  -- Explicitly remove dependent rows before deleting only the audited second ID.
  delete from public.match_results where match_id = v_delete_id;
  delete from public.matchup_transfers where match_id = v_delete_id;
  delete from public.matches where id = v_delete_id and id <> v_keep_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'Expected to delete exactly the confirmed second-half row %, deleted %.', v_delete_id, v_deleted; end if;

  select count(*) into v_official_count
  from public.matches where match_date = date '2026-10-05' and status = 'official';
  if v_official_count <> 1 or not exists (
    select 1 from public.matches where id = v_keep_id and match_date = date '2026-10-05' and status = 'official'
  ) then
    raise exception 'Post-migration date check failed: official count %, expected only MSL0074.', v_official_count;
  end if;
  select count(*) into v_segment_count from public.match_segments where match_id = v_keep_id;
  if v_segment_count <> 2 then raise exception 'Expected exactly two MSL0074 segments, found %.', v_segment_count; end if;
  if exists (
    select player_id, score, is_mvp, is_absent from public.match_results where match_id = v_keep_id
    except
    select (item->>'player_id'), (item->>'score')::integer, (item->>'is_mvp')::boolean, (item->>'is_absent')::boolean
    from jsonb_array_elements(v_final_results) as results(item)
  ) or exists (
    select (item->>'player_id'), (item->>'score')::integer, (item->>'is_mvp')::boolean, (item->>'is_absent')::boolean
    from jsonb_array_elements(v_final_results) as results(item)
    except
    select player_id, score, is_mvp, is_absent from public.match_results where match_id = v_keep_id
  ) then raise exception 'Persisted MSL0074 results differ from the computed final results.'; end if;
  if exists (
    select from_player_id, to_player_id, points from public.matchup_transfers where match_id = v_keep_id
    except
    select (item->>'from_player_id'), (item->>'to_player_id'), (item->>'points')::integer
    from jsonb_array_elements(v_final_matchups) as matchups(item)
  ) or exists (
    select (item->>'from_player_id'), (item->>'to_player_id'), (item->>'points')::integer
    from jsonb_array_elements(v_final_matchups) as matchups(item)
    except
    select from_player_id, to_player_id, points from public.matchup_transfers where match_id = v_keep_id
  ) then raise exception 'Persisted MSL0074 matrix differs from the computed final matrix.'; end if;

  v_after := jsonb_build_object(
    'match_id', v_keep_id,
    'match_date', date '2026-10-05',
    'official_match_count_on_date', v_official_count,
    'removed_source_match_id', v_delete_id,
    'results', v_final_results,
    'matchups', v_final_matchups,
    'segment_count', v_segment_count
  );
  insert into public.audit_logs(action, entity_type, entity_id, before_data, after_data, reason)
  values('CONSOLIDATE_MATCH', 'match', v_keep_id, v_before, v_after, '2026-10-05 上下半场合并为一场正式比赛');
end;
$msl0074_consolidation$;

commit;
