import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { requireUser } from '@/lib/auth'
import { dateCN, score } from '@/lib/format'
export const dynamic='force-dynamic'
export default async function MatchesPage(){
 const {supabase,profile}=await requireUser(); const {data}=await supabase.from('v_matches_full').select('*').order('match_date',{ascending:false}).order('round',{ascending:false}).limit(100)
 return <><Nav role={profile?.role}/><main className="shell"><header className="page-head"><div><h1>比赛中心</h1><p className="sub">历史比赛与逐人得分</p></div>{profile?.role==='admin'&&<Link href="/matches/new" className="btn btn-primary">＋录入比赛</Link>}</header>
 <section className="card"><div className="table-wrap"><table><thead><tr><th>比赛</th><th>日期</th><th>局型</th><th>MVP</th><th>得分</th></tr></thead><tbody>{(data||[]).map((m:any)=><tr key={m.id}><td><strong>{m.id}</strong><div className="sub">{m.season_id} 第{m.round}轮</div></td><td>{dateCN(m.match_date)}</td><td>{m.match_type}</td><td>{m.results?.filter((r:any)=>r.is_mvp).map((r:any)=>r.player_name).join(' / ')}</td><td>{m.results?.filter((r:any)=>!r.is_absent).sort((a:any,b:any)=>b.score-a.score).map((r:any)=><span key={r.player_id} style={{marginRight:10}} className={r.score>=0?'positive':'negative'}>{r.player_name} {score(r.score)}</span>)}</td></tr>)}</tbody></table></div></section></main></>
}
