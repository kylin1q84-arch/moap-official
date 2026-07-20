'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState(''); const [loading,setLoading]=useState(false)
  async function login(){ setLoading(true); setMessage(''); const {error}=await createClient().auth.signInWithPassword({email,password}); setLoading(false); if(error)setMessage(error.message); else window.location.href='/dashboard' }
  return <main className="login-wrap"><section className="card login-card">
    <span className="badge">v10.1 LTS · FREE CLOUD EDITION</span>
    <h1 style={{marginTop:16}}>MOAP 登录</h1><p className="sub">五人麻将联赛官方数据平台</p>
    <div className="field" style={{marginTop:24}}><label>邮箱</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
    <div className="field" style={{marginTop:14}}><label>密码</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')login()}} /></div>
    {message && <p className="notice error" style={{marginTop:14}}>{message}</p>}
    <button className="btn btn-primary" type="button" style={{width:'100%',marginTop:18}} onClick={login} disabled={loading}>{loading?'登录中…':'登录'}</button>
    <p className="footer-note">账号由管理员在Supabase中创建。不要在公开页面开放自由注册。</p>
  </section></main>
}
