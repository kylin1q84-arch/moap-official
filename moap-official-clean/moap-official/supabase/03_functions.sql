create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where user_id=auth.uid() and role='admin');
$$;

create or replace function public.create_match_with_results(p_payload jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare
  v_id text := p_payload->>'id'; v_season text := p_payload->>'season_id'; v_round int := (p_payload->>'round')::int;
  v_date date := (p_payload->>'match_date')::date; v_type text := p_payload->>'match_type';
  v_expected int := case when v_type='四人局' then 4 when v_type='五人局' then 5 else 0 end;
  v_active int; v_total int; v_max int; v_distinct int; v_known int;
begin
  if not public.is_admin() then raise exception 'Only admins may create matches'; end if;
  if v_expected=0 then raise exception 'Invalid match type'; end if;
  if exists(select 1 from public.matches where id=v_id) then raise exception 'Duplicate match id'; end if;
  select count(*) filter(where coalesce((x->>'is_absent')::boolean,false)=false),
         coalesce(sum((x->>'score')::int) filter(where coalesce((x->>'is_absent')::boolean,false)=false),0),
         max((x->>'score')::int) filter(where coalesce((x->>'is_absent')::boolean,false)=false),
         count(distinct x->>'player_id')
  into v_active,v_total,v_max,v_distinct from jsonb_array_elements(p_payload->'results') x;
  select count(*) into v_known from public.players p where p.active and p.id in (select x->>'player_id' from jsonb_array_elements(p_payload->'results') x);
  if jsonb_array_length(p_payload->'results') <> (select count(*) from public.players where active) then raise exception 'Results must include all active players'; end if;
  if v_distinct <> jsonb_array_length(p_payload->'results') then raise exception 'Duplicate player in results'; end if;
  if v_known <> (select count(*) from public.players where active) then raise exception 'Unknown or missing active player'; end if;
  if v_active<>v_expected then raise exception 'Participant count mismatch: expected %, got %',v_expected,v_active; end if;
  if v_total<>0 then raise exception 'Score total must equal 0, got %',v_total; end if;

  insert into public.matches(id,season_id,round,match_date,match_type,venue,notes,created_by)
  values(v_id,v_season,v_round,v_date,v_type,p_payload->>'venue',p_payload->>'notes',auth.uid());
  insert into public.match_results(match_id,player_id,score,is_absent,is_mvp)
  select v_id,x->>'player_id',case when (x->>'is_absent')::boolean then null else (x->>'score')::int end,
         (x->>'is_absent')::boolean,
         case when (x->>'is_absent')::boolean then false else (x->>'score')::int=v_max end
  from jsonb_array_elements(p_payload->'results') x;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data)
  values(auth.uid(),'CREATE','match',v_id,p_payload);
  return v_id;
end; $$;

grant execute on function public.create_match_with_results(jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated;
