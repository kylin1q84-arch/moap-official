alter table public.players enable row level security;
alter table public.seasons enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;
alter table public.profiles enable row level security;
alter table public.award_results enable row level security;
alter table public.system_versions enable row level security;
alter table public.audit_logs enable row level security;

create policy "authenticated read players" on public.players for select to authenticated using (true);
create policy "authenticated read seasons" on public.seasons for select to authenticated using (true);
create policy "authenticated read matches" on public.matches for select to authenticated using (true);
create policy "authenticated read results" on public.match_results for select to authenticated using (true);
create policy "authenticated read awards" on public.award_results for select to authenticated using (true);
create policy "authenticated read versions" on public.system_versions for select to authenticated using (true);
create policy "read own profile" on public.profiles for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "admin read audit" on public.audit_logs for select to authenticated using (public.is_admin());

-- Direct writes are denied by default. Official match creation is only through the validated RPC.
grant select on public.players,public.seasons,public.matches,public.match_results,public.profiles,public.award_results,public.system_versions to authenticated;
revoke insert,update,delete on public.matches,public.match_results from anon,authenticated;
