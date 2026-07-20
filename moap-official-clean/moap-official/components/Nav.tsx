import Link from 'next/link'
import { SignOutButton } from './SignOutButton'

export function Nav({ role }: { role?: string | null }) {
  return <nav className="nav"><div className="nav-inner">
    <Link href="/dashboard" className="brand">MOAP OFFICIAL</Link>
    <Link href="/dashboard" className="nav-link">总览</Link>
    <Link href="/matches" className="nav-link">比赛</Link>
    <Link href="/players/P001" className="nav-link">玩家</Link>
    <Link href="/honors" className="nav-link">荣誉</Link>
    <Link href="/goat" className="nav-link">GOAT</Link>
    {role === 'admin' && <Link href="/matches/new" className="nav-link gold">录入比赛</Link>}
    <SignOutButton />
  </div></nav>
}
