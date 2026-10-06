# MSL0074 split-session consolidation — manual production runbook

This is a one-match historical repair for `2026-10-05` only. The current Supabase connection available to this task points to `ai-drama-dashboard`, not MOAP, so no production query or write was run and no source IDs or scores have been guessed.

## Required order

1. In the **MOAP production** Supabase SQL editor, run `MSL0074_DRY_RUN.sql` as read-only SQL. Save all three result sets for review.
2. A human must identify which exact source ID is first half and which is second half from the notes and source records. Do not infer the mapping from the match ID sequence.
3. Stop without applying anything unless the dry run confirms exactly two `official` rows for that date, one is `MSL0074`, the roster/absence flags, season, round, match type, and venue agree, both half score sums are zero, each half matrix is complete and each outgoing row sum matches its half score, and the combined score has one unique highest player.
4. Only after the entire dry-run report has been reviewed and approved, run `08_match_segments_schema.sql` once in the MOAP project.
5. Replace the two exact source IDs in `MSL0074_CONSOLIDATION_APPLY.template.sql`, preserving the human-confirmed half mapping. Run that entire script in one SQL-editor session. Any failed assertion raises an exception and rolls the transaction back. Do not rerun after success.
6. Verify the results and segment count below, then reload the website. This MOAP release uses public direct-read mode (no Supabase Auth session), so the schema migration grants read-only `SELECT` to `anon` and `authenticated` under RLS; the table constraint restricts rows to MSL0074 and neither role receives direct write permissions.

## Post-apply checks

```sql
select id, season_id, round, match_date, match_type, venue, status
from public.matches
where match_date = date '2026-10-05' and status = 'official';
-- Must return exactly MSL0074.

select player_id, score, is_mvp, is_absent
from public.match_results
where match_id = 'MSL0074'
order by player_id;

select from_player_id, to_player_id, points
from public.matchup_transfers
where match_id = 'MSL0074'
order by from_player_id, to_player_id;

select match_id, segment_key, segment_label, segment_order,
       jsonb_array_length(results) as result_rows,
       jsonb_array_length(matchups) as matchup_rows
from public.match_segments
where match_id = 'MSL0074'
order by segment_order;
-- Must be exactly first_half/上半场/1 and second_half/下半场/2.
```

The guarded apply script verifies the score sum, one final MVP, source and final matrix row sums, date-level official match count, exact segment count, and equality of persisted official results/matrix with the computed sums. It stores original source match metadata, original result rows (including original `is_mvp` and absence flags), and original directional cells (including explicit zeroes) before deleting the one human-confirmed second-half match ID.

No analysis engine, ordinary entry/RPC flow, certified snapshot, other date, or other match is part of this procedure.
