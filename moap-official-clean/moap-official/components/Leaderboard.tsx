import Link from 'next/link'
import { pct, score } from '@/lib/format'
import type { CareerStat } from '@/lib/types'

export function Leaderboard({ rows }: { rows: CareerStat[] }) {
  return <div className="table-wrap"><table>
    <thead><tr><th>排名</th><th>玩家</th><th>场次</th><th>总积分</th><th>场均</th><th>正分率</th><th>MVP</th></tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.player_id}>
      <td><span className="rank">{i+1}</span></td>
      <td><Link className="gold" href={`/players/${r.player_id}`}>{r.player_name}</Link></td>
      <td>{r.games}</td>
      <td className={r.total_score >= 0 ? 'positive' : 'negative'}>{score(r.total_score)}</td>
      <td>{score(r.average_score)}</td><td>{pct(r.positive_rate)}</td><td>{r.mvp_count}</td>
    </tr>)}</tbody>
  </table></div>
}
