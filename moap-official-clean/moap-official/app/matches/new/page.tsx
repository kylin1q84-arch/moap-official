import { redirect } from 'next/navigation'
import { Nav } from '@/components/Nav'
import { MatchForm } from '@/components/MatchForm'
import { requireUser } from '@/lib/auth'
export const dynamic='force-dynamic'
export default async function NewMatchPage(){
 const {supabase,profile}=await requireUser(); if(profile?.role!=='admin')redirect('/dashboard')
 const [{data:players},{data:lastId},{data:lastS4}] = await Promise.all([
  supabase.from('players').select('id,name').eq('active',true).order('id'),
  supabase.from('matches').select('id').order('id',{ascending:false}).limit(1).maybeSingle(),
  supabase.from('matches').select('round').eq('season_id','S4').order('round',{ascending:false}).limit(1).maybeSingle(),
 ])
 const n=lastId?.id?Number(String(lastId.id).replace(/\D/g,''))+1:1; const nextId=`MSL${String(n).padStart(4,'0')}`; const nextRound=(lastS4?.round||0)+1
 return <><Nav role={profile?.role}/><main className="shell"><header className="page-head"><div><h1>录入正式比赛</h1><p className="sub">系统将校验人数、积分总和并自动确定MVP</p></div></header><MatchForm players={players||[]} nextId={nextId} nextRound={nextRound}/></main></>
}
