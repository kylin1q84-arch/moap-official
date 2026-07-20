import { notFound } from 'next/navigation'
import { Nav } from '@/components/Nav'
import { requireUser } from '@/lib/auth'
import { dateCN, pct, score } from '@/lib/format'
export const dynamic='force-dynamic'
export default async function PlayerPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const {supabase,profile}=await requireUser();
 const [{data:player},{data:career},{data:seasons},{data:recent},{data:honors}] = await Promise.all([
  supabase.from('players').select('*').eq('id',id).maybeSingle(), supabase.from('v_player_career_stats').select('*').eq('player_id',id).maybeSingle(),
  supabase.from('v_player_season_stats').select('*').eq('player_id',id).order('season_id'), supabase.from('v_player_results').select('*').eq('player_id',id).order('match_date',{ascending:false}).limit(10),
  supabase.from('award_results').select('scope,award_name,grade,category,value,points,status').eq('player_id',id).order('scope')])
 if(!player)notFound();
 return <><Nav role={profile?.role}/><main className="shell"><header className="page-head"><div><span className="badge">{id}</span><h1 style={{marginTop:10}}>{player.name}</h1><p className="sub">个人数据档案</p></div></header>
 <section className="grid metrics"><div className="card"><div className="metric-label">生涯总积分</div><div className={`metric-value ${career?.total_score>=0?'positive':'negative'}`}>{score(career?.total_score)}</div></div><div className="card"><div className="metric-label">场均积分</div><div className="metric-value">{score(career?.average_score)}</div></div><div className="card"><div className="metric-label">正分率</div><div className="metric-value">{pct(career?.positive_rate)}</div></div><div className="card"><div className="metric-label">MVP</div><div className="metric-value gold">{career?.mvp_count||0}</div></div></section>
 <section className="grid two" style={{marginTop:22}}><div className="card"><h2>赛季表现</h2><div className="table-wrap"><table><thead><tr><th>赛季</th><th>场次</th><th>总分</th><th>场均</th><th>正分率</th><th>MVP</th></tr></thead><tbody>{(seasons||[]).map((s:any)=><tr key={s.season_id}><td>{s.season_id}</td><td>{s.games}</td><td>{score(s.total_score)}</td><td>{score(s.average_score)}</td><td>{pct(s.positive_rate)}</td><td>{s.mvp_count}</td></tr>)}</tbody></table></div></div>
 <div className="card"><h2>最近10场</h2>{(recent||[]).map((r:any)=><div key={r.match_id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--line)'}}><span>{r.match_id} · {dateCN(r.match_date)}</span><strong className={r.score>=0?'positive':'negative'}>{score(r.score)} {r.is_mvp?'· MVP':''}</strong></div>)}</div></section>
 <section className="card" style={{marginTop:22}}><h2>荣誉墙</h2><div className="grid metrics">{(honors||[]).map((h:any,i:number)=><div className="card" key={`${h.scope}-${h.award_name}-${i}`}><span className="badge">{h.grade} · {h.scope}</span><h3 style={{marginTop:10}}>{h.award_name}</h3><p className="sub">{h.category} · {h.points}分</p></div>)}</div></section>
 </main></>
}
