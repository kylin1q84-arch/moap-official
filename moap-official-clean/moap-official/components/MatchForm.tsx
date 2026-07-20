'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Player = { id: string; name: string }
type Row = { player_id: string; player_name: string; score: number; is_absent: boolean }

export function MatchForm({ players, nextId, nextRound }: { players: Player[]; nextId: string; nextRound: number }) {
  const [season, setSeason] = useState('S4')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [type, setType] = useState<'四人局'|'五人局'>('五人局')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>(players.map(p => ({ player_id:p.id, player_name:p.name, score:0, is_absent:false })))
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const active = rows.filter(r => !r.is_absent)
  const total = active.reduce((s,r)=>s+Number(r.score||0),0)
  const max = active.length ? Math.max(...active.map(r=>Number(r.score||0))) : 0
  const expected = type === '四人局' ? 4 : 5
  const valid = active.length === expected && total === 0
  const mvpNames = useMemo(() => active.filter(r=>r.score===max).map(r=>r.player_name).join(' / '), [rows, max])

  function update(id:string, patch:Partial<Row>) { setRows(v=>v.map(r=>r.player_id===id?{...r,...patch}:r)) }
  function switchType(v:'四人局'|'五人局') {
    setType(v)
    if (v === '五人局') setRows(rs=>rs.map(r=>({...r,is_absent:false})))
  }
  async function submit() {
    setMessage('')
    if (!valid) { setMessage(`无法提交：${type}必须${expected}人参赛，且积分合计必须为0。`); return }
    setSaving(true)
    const payload = {
      id: nextId, season_id: season, round: nextRound, match_date: date,
      match_type: type, venue: venue || null, notes: notes || null,
      results: rows.map(r=>({ player_id:r.player_id, score:r.is_absent?null:Number(r.score), is_absent:r.is_absent }))
    }
    const { error } = await createClient().rpc('create_match_with_results', { p_payload: payload })
    setSaving(false)
    if (error) setMessage(`提交失败：${error.message}`)
    else { setMessage('录入成功，统计已自动刷新。'); setTimeout(()=>window.location.href='/matches',900) }
  }

  return <div className="card">
    <div className="form-grid">
      <div className="field"><label>比赛编号</label><input className="input" value={nextId} disabled /></div>
      <div className="field"><label>赛季</label><select className="input" value={season} onChange={e=>setSeason(e.target.value)}><option>S1</option><option>S2</option><option>S3</option><option>S4</option></select></div>
      <div className="field"><label>轮次</label><input className="input" value={nextRound} disabled /></div>
      <div className="field"><label>日期</label><input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} /></div>
      <div className="field"><label>局型</label><select className="input" value={type} onChange={e=>switchType(e.target.value as '四人局'|'五人局')}><option>五人局</option><option>四人局</option></select></div>
      <div className="field"><label>地点</label><input className="input" value={venue} onChange={e=>setVenue(e.target.value)} placeholder="可不填" /></div>
    </div>
    <h2 style={{marginTop:24}}>本场成绩</h2>
    {rows.map(r => <div className="score-row" key={r.player_id}>
      <strong>{r.player_name}</strong>
      <input className="input" type="number" value={r.score} disabled={r.is_absent} onChange={e=>update(r.player_id,{score:Number(e.target.value)})} />
      <label className="compact"><input type="checkbox" checked={r.is_absent} disabled={type==='五人局'} onChange={e=>update(r.player_id,{is_absent:e.target.checked,score:0})} /> 缺席</label>
      <span className="compact">{!r.is_absent && r.score===max ? <span className="badge">MVP</span> : ''}</span>
    </div>)}
    <div className="form-grid" style={{marginTop:18}}>
      <div className="notice">参赛人数：{active.length}/{expected}<br/>积分合计：<strong className={total===0?'positive':'negative'}>{total}</strong><br/>预计MVP：{mvpNames || '—'}</div>
      <div className="field"><label>备注</label><textarea className="input" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} /></div>
    </div>
    {message && <p className={`notice ${message.includes('失败')||message.includes('无法')?'error':''}`} style={{marginTop:14}}>{message}</p>}
    <button type="button" className="btn btn-primary" style={{marginTop:18}} disabled={saving||!valid} onClick={submit}>{saving?'正在提交…':'正式提交比赛'}</button>
  </div>
}
