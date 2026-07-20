-- Expected baseline after running all scripts
select count(*) as players from public.players;                 -- 5
select count(*) as matches from public.matches;                 -- 65
select count(*) as result_rows from public.match_results;       -- 325
select player_name,total_score,mvp_count from public.v_player_career_stats order by total_score desc;
select player_name,goat_index,rank from public.v_goat_rankings order by rank;
-- Expected total scores: 罗海泓 440；陈丰 368；吴韬骏 241；陈毓圣 -3；陈荣升 -1046
-- Expected GOAT: 罗海泓 154，排名1
