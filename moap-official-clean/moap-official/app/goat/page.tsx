import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { requireUser } from '@/lib/auth'
export const dynamic='force-dynamic'
export default async function GoatPage(){const {supabase,profile}=await requireUser(); const {data}=await supabase.from('v_goat_rankings').select('*').order('goat_index',{ascending:false}); return <><Nav role={profile?.role}/><main className="shell"><header className="page-head"><div><h1>GOAT中心</h1><p className="sub">GOAT指数 = 荣誉积分 + 生涯MVP + 赛季冠军×10</p></div></header><section className="grid metrics">{(data||[]).map((g:any)=><div className="card" key={g.player_id}><span className="badge">第{g.rank}名</span><h2 style={{marginTop:12}}><Link className="gold" href={`/players/${g.player_id}`}>{g.player_name}</Link></h2><div className="metric-value">{g.goat_index}</div><p className="sub">荣誉 {g.honor_points} + MVP {g.mvp_count} + 冠军 {g.season_titles}×10</p></div>)}</section></main></>}
