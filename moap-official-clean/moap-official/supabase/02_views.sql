create or replace view public.v_player_career_stats as
select p.id player_id, p.name player_name,
 count(r.id) filter(where not r.is_absent and m.status='official')::int games,
 coalesce(sum(r.score) filter(where not r.is_absent and m.status='official'),0)::int total_score,
 coalesce(avg(r.score) filter(where not r.is_absent and m.status='official'),0)::numeric average_score,
 coalesce(count(*) filter(where not r.is_absent and r.score>0 and m.status='official')::numeric/nullif(count(*) filter(where not r.is_absent and m.status='official'),0),0) positive_rate,
 count(*) filter(where r.is_mvp and not r.is_absent and m.status='official')::int mvp_count,
 coalesce(count(*) filter(where r.is_mvp and not r.is_absent and m.status='official')::numeric/nullif(count(*) filter(where not r.is_absent and m.status='official'),0),0) mvp_rate,
 max(r.score) filter(where not r.is_absent and m.status='official')::int best_score,
 min(r.score) filter(where not r.is_absent and m.status='official')::int worst_score,
 count(*) filter(where r.is_absent and m.status='official')::int absences,
 avg(r.score) filter(where not r.is_absent and m.match_type='四人局' and m.status='official')::numeric four_average,
 avg(r.score) filter(where not r.is_absent and m.match_type='五人局' and m.status='official')::numeric five_average
from public.players p left join public.match_results r on r.player_id=p.id left join public.matches m on m.id=r.match_id
group by p.id,p.name;

create or replace view public.v_player_season_stats as
select p.id player_id,p.name player_name,s.id season_id,
 count(r.id) filter(where not r.is_absent and m.status='official')::int games,
 coalesce(sum(r.score) filter(where not r.is_absent and m.status='official'),0)::int total_score,
 coalesce(avg(r.score) filter(where not r.is_absent and m.status='official'),0)::numeric average_score,
 coalesce(count(*) filter(where not r.is_absent and r.score>0 and m.status='official')::numeric/nullif(count(*) filter(where not r.is_absent and m.status='official'),0),0) positive_rate,
 count(*) filter(where r.is_mvp and not r.is_absent and m.status='official')::int mvp_count
from public.players p cross join public.seasons s
left join public.matches m on m.season_id=s.id and m.status='official'
left join public.match_results r on r.match_id=m.id and r.player_id=p.id
group by p.id,p.name,m.season_id,s.id
having count(r.id)>0;

create or replace view public.v_player_results as
select r.player_id,p.name player_name,m.id match_id,m.season_id,m.round,m.match_date,m.match_type,r.score,r.is_mvp,r.is_absent
from public.match_results r join public.players p on p.id=r.player_id join public.matches m on m.id=r.match_id where m.status='official';

create or replace view public.v_matches_full as
select m.*,
 coalesce(jsonb_agg(jsonb_build_object('player_id',p.id,'player_name',p.name,'score',r.score,'is_mvp',r.is_mvp,'is_absent',r.is_absent) order by r.is_absent, r.score desc nulls last) filter(where r.id is not null),'[]'::jsonb) results
from public.matches m left join public.match_results r on r.match_id=m.id left join public.players p on p.id=r.player_id
group by m.id;

create or replace view public.v_goat_rankings as
with honor as (select player_id,coalesce(sum(points),0)::int honor_points from public.award_results group by player_id),
 titles as (select player_id,count(*)::int season_titles from public.award_results where award_id='H001' group by player_id),
 base as (select c.player_id,c.player_name,coalesce(h.honor_points,0) honor_points,c.mvp_count,coalesce(t.season_titles,0) season_titles,
 coalesce(h.honor_points,0)+c.mvp_count+coalesce(t.season_titles,0)*10 goat_index from public.v_player_career_stats c left join honor h on h.player_id=c.player_id left join titles t on t.player_id=c.player_id)
select *,rank() over(order by goat_index desc, honor_points desc, mvp_count desc)::int rank from base;

grant select on public.v_player_career_stats,public.v_player_season_stats,public.v_player_results,public.v_matches_full,public.v_goat_rankings to authenticated;
