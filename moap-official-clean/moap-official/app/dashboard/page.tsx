import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Leaderboard } from '@/components/Leaderboard'
import { requireUser } from '@/lib/auth'
import { dateCN, score } from '@/lib/format'
import type { CareerStat } from '@/lib/types'

export const dynamic = 'force-dynamic'
export default async function DashboardPage() {
  const { supabase, profile } = await requireUser()
  const [{ data: stats }, { data: latest }, { count: matchCount }, { data: goat }] = await Promise.all([
    supabase.from('v_player_career_stats').select('*').order('total_score',{ascending:false}),
    supabase.from('v_matches_full').select('*').order('match_date',{ascending:false}).order('round',{ascending:false}).limit(5),
    supabase.from('matches').select('*',{count:'exact',head:true}).eq('status','official'),
    supabase.from('v_goat_rankings').select('*').order('goat_index',{ascending:false}),
  ])
  const rows = (stats || []) as CareerStat[]
  const leader = rows[0]
  return <><Nav role={profile?.role}/><main className="shell">
    <header className="page-head"><div><span className="badge">OFFICIAL VERIFIED</span><h1 style={{marginTop:10}}>联赛总览</h1><p className="sub">MOAP v10.1 LTS 云端正式版</p></div>{profile?.role==='admin'&&<Link className="btn btn-primary" href="/matches/new">＋录入新比赛</Link>}</header>
    <section className="grid metrics">
      <div className="card"><div className="metric-label">正式比赛</div><div className="metric-value">{matchCount ?? 0}</div></div>
      <div className="card"><div className="metric-label">积分榜首</div><div className="metric-value gold">{leader?.player_name || '—'}</div></div>
      <div className="card"><div className="metric-label">榜首积分</div><div className="metric-value positive">{score(leader?.total_score)}</div></div>
      <div className="card"><div className="metric-label">当前GOAT</div><div className="metric-value">{goat?.[0]?.player_name || '—'}</div></div>
    </section>
    <section className="grid two" style={{marginTop:22}}>
      <div className="card"><h2>生涯积分榜</h2><Leaderboard rows={rows}/></div>
      <div className="card"><h2>最近比赛</h2>{(latest||[]).map((m:any)=><div key={m.id} style={{padding:'12px 0',borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>{m.id} · {m.season_id} 第{m.round}轮</strong><span className="sub">{dateCN(m.match_date)}</span></div>
        <div className="sub">{m.match_type} · {m.results?.filter((r:any)=>r.is_mvp).map((r:any)=>r.player_name).join('/') || '—'} MVP</div>
      </div>)}</div>
    </section>
    <section className="card" style={{marginTop:22}}><h2>GOAT指数</h2><div className="table-wrap"><table><thead><tr><th>排名</th><th>玩家</th><th>荣誉积分</th><th>MVP</th><th>冠军</th><th>GOAT指数</th></tr></thead><tbody>{(goat||[]).map((g:any)=><tr key={g.player_id}><td>{g.rank}</td><td><Link className="gold" href={`/players/${g.player_id}`}>{g.player_name}</Link></td><td>{g.honor_points}</td><td>{g.mvp_count}</td><td>{g.season_titles}</td><td><strong>{g.goat_index}</strong></td></tr>)}</tbody></table></div></section>
  </main></>
}
