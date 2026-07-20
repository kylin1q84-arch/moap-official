export function score(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100}`
}
export function pct(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(2)}%`
}
export function dateCN(v: string) {
  return new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(`${v}T00:00:00`))
}
