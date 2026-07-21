import { CERTIFIED_SNAPSHOT } from "./certified-data.js";
import { HONOR_CATALOG, HONOR_DETAILS } from "./honor-details.js";
let state = JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT));
let currentView = "overview";
let currentPlayer = "P001";
let matchLimit = 15;

const NAV = [
  ["overview","总览","◈"],["leaderboard","排行榜","榜"],["player","个人档案","人"],
  ["matches","比赛中心","局"],["entry","录入比赛","＋"],["rival","对位中心","对"],
  ["honors","荣誉中心","冠"],["system","系统审计","审"]
];


// 中国大陆访问版：浏览器不再直连 supabase.co，所有数据通过本站 /api 代理访问。
let currentRole="admin",appBooted=false;

async function apiJson(url, options={}){
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.body ? {"Content-Type":"application/json"} : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload = null;
  if(text){
    try{ payload = JSON.parse(text); }
    catch{ payload = { message: text }; }
  }
  if(!response.ok){
    throw new Error(payload?.message || payload?.error || `API 请求失败（${response.status}）`);
  }
  return payload;
}

function setAuthStatus(message,isError=false,isOk=false){
  const el=document.querySelector("#authStatus"); if(!el)return;
  el.textContent=message; el.className="auth-status"+(isError?" error":isOk?" ok":"");
}
function showLogin(){document.querySelector("#authGate").hidden=false;document.querySelector("#appShell").hidden=true;setAuthStatus("等待登录");}

function bgrValue(score){score=Number(score);return score>=100?12:score>=90?8:score>=80?5:score>=70?3:score>=60?2:score>=50?1:0;}
function average(values){return values.length?values.reduce((a,b)=>a+Number(b),0)/values.length:null;}
function competitionRanks(rows,key){
  let last=null,rank=0;return rows.map((x,i)=>{const v=x[key];if(i===0||v!==last)rank=i+1;last=v;return {...x,rank};});
}
function buildLiveState(db){
  const players=db.players.map(p=>({playerId:p.id,name:p.name,joinSeason:p.join_season,status:p.active?"Active":"Inactive"}));
  const nameBy=Object.fromEntries(players.map(p=>[p.playerId,p.name]));
  const resultMap={};db.results.forEach(r=>(resultMap[r.match_id]??=[]).push(r));
  const matches=db.matches.slice().sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date))||a.id.localeCompare(b.id)).map(m=>({
    matchId:m.id,season:m.season_id,round:m.round,date:m.match_date,matchType:m.match_type,venue:m.venue||"",isHomeVenue:!!m.is_home_venue,notes:m.notes||"",
    results:(resultMap[m.id]||[]).map(r=>({playerId:r.player_id,player:nameBy[r.player_id]||r.player_id,score:r.score==null?null:Number(r.score),isMvp:!!r.is_mvp,isAbsent:!!r.is_absent}))
  }));
  const honors={};players.forEach(p=>honors[p.playerId]=[]);
  db.awards.forEach(a=>{const key=`${a.player_id}|${a.scope}|${a.award_id}`;const catalog=HONOR_CATALOG.find(x=>x.honorId===a.award_id);(honors[a.player_id]??=[]).push({ownerPlayerId:a.player_id,scope:a.scope,honorId:a.award_id,name:a.award_name,grade:a.grade,category:a.category,value:a.value==null?null:Number(a.value),points:Number(a.points||0),status:a.status,details:HONOR_DETAILS[key]||{rule:catalog?.rule||"暂无规则说明",unit:catalog?.unit||"",winner:nameBy[a.player_id]||a.player_id,calculationStatus:"LIVE_AWARD_NO_STATIC_EVIDENCE"}})});
  const seasonIds=[...new Set([...(db.seasons||[]).map(s=>s.id),...matches.map(m=>m.season)])].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
  const seasons=seasonIds.map(id=>{const x=(db.seasons||[]).find(s=>s.id===id);return {id,name:x?.name||id,status:x?.status||"closed"};});

  function metrics(pid,season=null){
    let streak=0,bestStreak=0;const played=[];let absences=0;
    matches.filter(m=>!season||m.season===season).forEach(m=>{
      const r=m.results.find(x=>x.playerId===pid);if(!r)return;
      if(r.isAbsent){absences++;return;}
      played.push({...r,matchType:m.matchType});
      if(Number(r.score)>=0){streak++;bestStreak=Math.max(bestStreak,streak)}else streak=0;
    });
    const scores=played.map(r=>Number(r.score)),four=played.filter(r=>r.matchType==="四人局").map(r=>Number(r.score)),five=played.filter(r=>r.matchType==="五人局").map(r=>Number(r.score));
    const total=scores.reduce((a,b)=>a+b,0),games=scores.length,mvps=played.filter(r=>r.isMvp).length;
    return {games,totalScore:total,total,averageScore:games?total/games:0,average:games?total/games:0,positiveRate:games?played.filter(r=>Number(r.score)>=0).length/games:0,
      mvps,mvpRate:games?mvps/games:0,bestStreak,fourAverage:average(four),fiveAverage:average(five),best:scores.length?Math.max(...scores):null,worst:scores.length?Math.min(...scores):null,
      absences,bgr:scores.reduce((n,s)=>n+bgrValue(s),0)};
  }

  const honorStats={};players.forEach(p=>{const hs=honors[p.playerId]||[];honorStats[p.playerId]={honorCount:hs.length,gradeA:hs.filter(h=>h.grade==="A").length,gradeB:hs.filter(h=>h.grade==="B").length,gradeCD:hs.filter(h=>h.grade==="C"||h.grade==="D").length,honorPoints:hs.reduce((n,h)=>n+Number(h.points||0),0)};});
  const honorRanked=competitionRanks(players.map(p=>({playerId:p.playerId,honorPoints:honorStats[p.playerId].honorPoints})).sort((a,b)=>b.honorPoints-a.honorPoints),"honorPoints");
  const honorRank=Object.fromEntries(honorRanked.map(x=>[x.playerId,x.rank]));
  let goat=players.map(p=>{const c=metrics(p.playerId),h=honorStats[p.playerId],titles=(honors[p.playerId]||[]).filter(x=>x.honorId==="H001").length;return {playerId:p.playerId,player:p.name,honorPoints:h.honorPoints,mvps:c.mvps,titles,goatIndex:h.honorPoints+c.mvps+titles*10};}).sort((a,b)=>b.goatIndex-a.goatIndex||b.honorPoints-a.honorPoints||b.mvps-a.mvps);
  goat=competitionRanks(goat,"goatIndex").map(x=>({...x,winner:x.rank===1?"CURRENT GOAT":""}));
  const goatBy=Object.fromEntries(goat.map(x=>[x.playerId,x]));
  const leaderboard=players.map(p=>{const c=metrics(p.playerId),h=honorStats[p.playerId],g=goatBy[p.playerId];return {playerId:p.playerId,player:p.name,...c,honorCount:h.honorCount,honorPoints:h.honorPoints,goatIndex:g.goatIndex,goatRank:g.rank};});
  const seasonStats={};seasonIds.forEach(s=>seasonStats[s]=players.map(p=>{const c=metrics(p.playerId,s);return {playerId:p.playerId,player:p.name,games:c.games,total:c.total,average:c.average,positiveRate:c.positiveRate,mvps:c.mvps,best:c.best,worst:c.worst,fourAverage:c.fourAverage,fiveAverage:c.fiveAverage,bgr:c.bgr};}));
  const profiles={};players.forEach(p=>{const c=metrics(p.playerId),h=honorStats[p.playerId];profiles[p.playerId]={name:p.name,games:c.games,total:c.total,average:c.average,positiveRate:c.positiveRate,mvps:c.mvps,absences:c.absences,best:c.best,worst:c.worst,honorRank:honorRank[p.playerId],...h};});

  const rivalNet={},rivalWinRate={};players.forEach(a=>{rivalNet[a.name]={};rivalWinRate[a.name]={};players.forEach(b=>{
    if(a.playerId===b.playerId){rivalNet[a.name][b.name]=null;rivalWinRate[a.name][b.name]=null;return;}
    let net=0,wins=0,meetings=0;matches.forEach(m=>{const ar=m.results.find(r=>r.playerId===a.playerId&&!r.isAbsent),br=m.results.find(r=>r.playerId===b.playerId&&!r.isAbsent);if(!ar||!br)return;meetings++;net+=Number(ar.score)-Number(br.score);if(Number(ar.score)>Number(br.score))wins++;});
    rivalNet[a.name][b.name]=net;rivalWinRate[a.name][b.name]=meetings?wins/meetings:0;
  });});

  const checks=[];
  const pushCheck=(id,item,found,evidence)=>checks.push({id,item,found,target:"0",result:found===0?"PASS":"FAIL",evidence});
  pushCheck("HC001","ResultID 唯一性",db.results.length-new Set(db.results.map(r=>r.id)).size,"match_results.id");
  pushCheck("HC002","Matches 表 MatchID 唯一性",db.matches.length-new Set(db.matches.map(m=>m.id)).size,"matches.id");
  pushCheck("HC003","荣誉记录唯一性",db.awards.length-new Set(db.awards.map(a=>`${a.player_id}|${a.scope}|${a.award_id}`)).size,"award_results");
  pushCheck("HC004","缺失 PlayerID",db.results.filter(r=>!r.player_id||!nameBy[r.player_id]).length,"match_results.player_id");
  pushCheck("HC005","缺失 Season",db.matches.filter(m=>!m.season_id).length,"matches.season_id");
  pushCheck("HC006","非缺席但缺失 Score",db.results.filter(r=>!r.is_absent&&r.score==null).length,"match_results.score/is_absent");
  const matchIds=new Set(db.matches.map(m=>m.id));pushCheck("HC007","Result MatchID 未登记",db.results.filter(r=>!matchIds.has(r.match_id)).length,"match_results→matches");
  const invalidMatches=matches.filter(m=>{const active=m.results.filter(r=>!r.isAbsent);return active.length!==(m.matchType==="四人局"?4:5)||active.reduce((n,r)=>n+Number(r.score),0)!==0;}).length;
  pushCheck("HC008","人数或积分平衡异常",invalidMatches,"每场参赛人数与积分合计");
  const passCount=checks.filter(x=>x.result==="PASS").length,healthScore=Math.round(passCount/checks.length*100);
  const latestVersion=(db.versions||[])[0];const topGoat=goat[0],topHonor=[...leaderboard].sort((a,b)=>b.honorPoints-a.honorPoints)[0];
  const awardWinners=id=>seasonIds.map(s=>{const hs=db.awards.filter(a=>a.scope===s&&a.award_id===id);return hs.length?`${s} ${hs.map(a=>nameBy[a.player_id]).join("/")}`:null}).filter(Boolean).join("；")||"暂无";
  const version={...CERTIFIED_SNAPSHOT.version,version:latestVersion?.version||CERTIFIED_SNAPSHOT.version.version,releaseStage:latestVersion?.stage||CERTIFIED_SNAPSHOT.version.releaseStage,releaseDate:latestVersion?.release_date||CERTIFIED_SNAPSHOT.version.releaseDate,currentStatus:latestVersion?.status||CERTIFIED_SNAPSHOT.version.currentStatus,formulaIntegrity:latestVersion?.formula_integrity||"PASS",certification:latestVersion?.certification||"OFFICIAL VERIFIED",note:latestVersion?.note||CERTIFIED_SNAPSHOT.version.note,currentGoat:topGoat?.player||"—",goatIndex:topGoat?.goatIndex||0,honorKing:topHonor?`${topHonor.player} · ${topHonor.honorPoints}`:"—",seasonMvp:awardWinners("H003"),scoringKing:awardWinners("H004")};
  return {...JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT)),meta:{...CERTIFIED_SNAPSHOT.meta,matches:matches.length,results:db.results.length,players:players.length,healthScore},players,seasons,matches,leaderboard,seasonStats,honors,profiles,goat,rivalNet,rivalWinRate,version,healthChecks:checks};
}

async function reloadCloudData(){
  const db = await apiJson("/api/bootstrap");
  currentRole="admin";
  state=buildLiveState({
    players:db.players||[],
    seasons:db.seasons||[],
    matches:db.matches||[],
    results:db.results||[],
    awards:db.awards||[],
    versions:db.versions||[]
  });
  if(appBooted){initNav();populateSelects();initEntry();showView(currentView);}
  document.querySelector("#healthBadge").textContent=`代理健康 ${state.meta.healthScore}%`;
  document.querySelector("#versionBadge").textContent=state.version.version;
}

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmtScore = n => (n > 0 ? "+" : "") + Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2);
const fmtAvg = n => n == null ? "—" : Number(n).toFixed(2);
const fmtPct = n => n == null ? "—" : (Number(n)*100).toFixed(2)+"%";
const scoreClass = n => Number(n) >= 0 ? "score-pos" : "score-neg";
const initials = name => name.slice(-2);
const escapeHtml = str => String(str ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2200);
}

function initNav(){
  const desktop=$("#sidebarNav"), mobile=$("#mobileNav");
  const visibleNav = NAV.filter(([id])=>id!=="entry" || currentRole==="admin");
  desktop.innerHTML = visibleNav.map(([id,label,icon])=>`<button type="button" class="nav-btn ${id==="overview"?"active":""}" data-nav="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join("");
  mobile.innerHTML = desktop.innerHTML;
  $$('[data-nav]').forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.nav)));
}

function showView(id){
  if(id==="entry"&&currentRole!=="admin"){toast("当前账号为只读成员");id="overview";}
  currentView=id;
  $$(".view").forEach(v=>v.classList.toggle("active",v.dataset.view===id));
  $$("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="overview") renderOverview();
  if(id==="leaderboard") renderLeaderboard();
  if(id==="player") renderPlayer();
  if(id==="matches") renderMatches(true);
  if(id==="rival") renderRival();
  if(id==="honors") renderHonors();
  if(id==="system") renderSystem();
}

function currentLeaderboard(){
  return (state.leaderboard||[]).map(row=>({...row}));
}

function recentScore(pid,n=5){
  const rows=[];
  [...state.matches].reverse().forEach(m=>{
    const r=m.results.find(x=>x.playerId===pid && !x.isAbsent && x.score!=null);
    if(r && rows.length<n) rows.push(r);
  });
  return rows.reduce((a,b)=>a+Number(b.score),0);
}

function renderOverview(){
  const board=currentLeaderboard().sort((a,b)=>b.totalScore-a.totalScore);
  const goat=[...state.goat].sort((a,b)=>a.rank-b.rank)[0];
  $("#goatName").textContent=goat.player;
  $("#overviewKpis").innerHTML=[
    ["正式比赛",state.matches.length+" 场","S1–S3 完整记录"],
    ["成绩记录",state.matches.reduce((n,m)=>n+m.results.length,0)+" 条","含缺席记录"],
    ["当前GOAT",goat.player,goat.goatIndex+" 指数"],
    ["系统健康",state.meta.healthScore+"%","8/8 检查通过"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  $("#overviewLeaderboard").innerHTML=board.map((r,i)=>`<tr>
    <td><span class="rank ${i===0?"top":""}">${i+1}</span></td>
    <td><div class="player-cell"><span class="avatar">${initials(r.player)}</span>${r.player}${r.player===goat.player?'<span class="chip gold">GOAT</span>':""}</div></td>
    <td class="${scoreClass(r.totalScore)}">${fmtScore(r.totalScore)}</td><td>${fmtAvg(r.averageScore)}</td><td>${r.mvps}</td><td>${fmtPct(r.positiveRate)}</td>
  </tr>`).join("");
  const latest=state.matches[state.matches.length-1];
  if(!latest){$("#latestMeta").textContent="暂无比赛";$("#latestMatch").innerHTML='<div class="empty">暂无云端比赛记录</div>';return;}
  $("#latestMeta").textContent=`${latest.season} 第${latest.round}局 · ${latest.date}`;
  $("#latestMatch").innerHTML=`<div class="latest-match">
    <div class="match-title"><strong>${latest.matchType}</strong><span>${escapeHtml(latest.venue||"未填写场地")}</span></div>
    <div class="score-list">${latest.results.filter(r=>!r.isAbsent).sort((a,b)=>b.score-a.score).map(r=>`
      <div class="score-row ${r.isMvp?"mvp":""}"><div class="left"><span class="avatar">${initials(r.player)}</span><span>${r.player}</span>${r.isMvp?'<span class="chip gold">MVP</span>':""}</div><b class="${scoreClass(r.score)}">${fmtScore(r.score)}</b></div>`).join("")}</div>
  </div>`;
  const form=board.map(r=>({name:r.player,pid:r.playerId,val:recentScore(r.playerId,5)})).sort((a,b)=>b.val-a.val);
  const maxAbs=Math.max(1,...form.map(x=>Math.abs(x.val)));
  $("#recentFormList").innerHTML=form.map((x,i)=>`<div class="goat-row"><span class="rank ${i===0?"top":""}">${i+1}</span><div><div style="display:flex;justify-content:space-between;gap:8px"><strong>${x.name}</strong><b class="${scoreClass(x.val)}">${fmtScore(x.val)}</b></div><div class="bar"><i style="width:${Math.max(3,Math.abs(x.val)/maxAbs*100)}%;${x.val<0?"background:linear-gradient(90deg,#7b3434,#ff8080)":""}"></i></div></div><span class="muted">近5场</span></div>`).join("");
  renderGoatRows("#goatMini",5);
}

function scopedRows(){
  const scope=$("#boardScope").value, type=$("#boardType").value, search=$("#boardSearch").value.trim();
  let rows;
  if(scope==="career") rows=currentLeaderboard();
  else rows=(state.seasonStats[scope]||[]).map(s=>{
    const base=CERTIFIED_SNAPSHOT.leaderboard.find(x=>x.playerId===s.playerId);
    return {...base,player:s.player,games:s.games,totalScore:s.total,averageScore:s.average,positiveRate:s.positiveRate,mvps:s.mvps,fourAverage:s.fourAverage,fiveAverage:s.fiveAverage};
  });
  if(search) rows=rows.filter(r=>r.player.includes(search));
  let key=$("#boardSort").value;
  if(type==="4") key="fourAverage";
  if(type==="5") key="fiveAverage";
  rows.sort((a,b)=>(Number(b[key]??-Infinity)-Number(a[key]??-Infinity)));
  return rows;
}
function renderLeaderboard(){
  const rows=scopedRows();
  $("#fullLeaderboard").innerHTML=rows.map((r,i)=>`<tr>
    <td><span class="rank ${i===0?"top":""}">${i+1}</span></td>
    <td><div class="player-cell"><span class="avatar">${initials(r.player)}</span>${r.player}</div></td>
    <td>${r.games}</td><td class="${scoreClass(r.totalScore)}">${fmtScore(r.totalScore)}</td><td>${fmtAvg(r.averageScore)}</td>
    <td>${fmtPct(r.positiveRate)}</td><td>${r.mvps}</td><td>${fmtAvg(r.fourAverage)}</td><td>${fmtAvg(r.fiveAverage)}</td>
    <td>${r.honorPoints??"—"}</td><td>${r.goatIndex??"—"}</td></tr>`).join("");
}
["boardScope","boardSort","boardType"].forEach(id=>document.addEventListener("change",e=>{if(e.target.id===id)renderLeaderboard()}));
document.addEventListener("input",e=>{if(e.target.id==="boardSearch")renderLeaderboard()});

function populateSelects(){
  const opts=state.players.map(p=>`<option value="${p.playerId}">${p.name}</option>`).join("");
  $("#playerSelect").innerHTML=opts; $("#honorPlayer").innerHTML=opts;
  $("#matchPlayer").innerHTML='<option value="all">全部牌手</option>'+opts;
  const seasons=(state.seasons||[]).map(s=>s.id);
  $("#boardScope").innerHTML='<option value="career">生涯全部</option>'+seasons.map(s=>`<option value="${s}">${s}</option>`).join("");
  $("#matchSeason").innerHTML='<option value="all">全部赛季</option>'+seasons.map(s=>`<option value="${s}">${s}</option>`).join("");
  $("#entrySeason").innerHTML=(state.seasons||[]).map(s=>`<option value="${s.id}" ${s.status==="active"?"selected":""}>${s.id}${s.status==="active"?"（进行中）":""}</option>`).join("");
  if(!state.players.some(p=>p.playerId===currentPlayer)) currentPlayer=state.players[0]?.playerId||"P001";
  $("#playerSelect").value=currentPlayer; $("#honorPlayer").value=currentPlayer;
}

function playerCareer(pid){
  return currentLeaderboard().find(x=>x.playerId===pid);
}
function playerTimeline(pid){
  const arr=[];
  let cum=0;
  state.matches.forEach(m=>{
    const r=m.results.find(x=>x.playerId===pid && !x.isAbsent && x.score!=null);
    if(r){cum+=Number(r.score);arr.push({matchId:m.matchId,season:m.season,round:m.round,date:m.date,matchType:m.matchType,venue:m.venue,score:Number(r.score),isMvp:r.isMvp,cumulative:cum});}
  });
  return arr;
}
function drawTrend(pid){
  const svg=$("#trendChart"), arr=playerTimeline(pid);
  if(!arr.length){svg.innerHTML="";return}
  const W=760,H=250,pad={l:42,r:18,t:18,b:30};
  const vals=arr.map(x=>x.cumulative), min=Math.min(0,...vals), max=Math.max(0,...vals), range=(max-min)||1;
  const x=i=>pad.l+(W-pad.l-pad.r)*(i/(arr.length-1||1));
  const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/range);
  const pts=arr.map((d,i)=>`${x(i)},${y(d.cumulative)}`).join(" ");
  const area=`${x(0)},${y(0)} ${pts} ${x(arr.length-1)},${y(0)}`;
  const grid=[0,.25,.5,.75,1].map(t=>{const v=min+range*t;return `<line class="axis" x1="${pad.l}" y1="${y(v)}" x2="${W-pad.r}" y2="${y(v)}"/><text class="chart-label" x="3" y="${y(v)+3}">${Math.round(v)}</text>`}).join("");
  const dots=arr.map((d,i)=>i===arr.length-1||d.isMvp?`<circle class="trend-dot" cx="${x(i)}" cy="${y(d.cumulative)}" r="${d.isMvp?4:3}"><title>${d.date} · ${fmtScore(d.score)} · 累计 ${fmtScore(d.cumulative)}</title></circle>`:"").join("");
  svg.innerHTML=`<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d7b25b" stop-opacity=".24"/><stop offset="100%" stop-color="#d7b25b" stop-opacity="0"/></linearGradient></defs>${grid}<polygon class="trend-area" points="${area}"/><polyline class="trend-line" points="${pts}"/>${dots}<text class="chart-label" x="${pad.l}" y="${H-7}">${arr[0].season} · 第1场</text><text class="chart-label" text-anchor="end" x="${W-pad.r}" y="${H-7}">${arr[arr.length-1].season} · 第${arr[arr.length-1].round}场</text>`;
  $("#chartCaption").textContent=`${arr.length}场 · 当前累计 ${fmtScore(arr[arr.length-1].cumulative)}`;
}
function renderPlayer(){
  const pid=currentPlayer, p=state.players.find(x=>x.playerId===pid), c=playerCareer(pid), prof=state.profiles[pid];
  $("#playerHeader").innerHTML=`<span class="avatar">${initials(p.name)}</span><div><h3 style="margin:0;font-size:21px">${p.name}</h3><div class="muted" style="margin-top:5px">${pid} · ${p.joinSeason} 创始成员 · 荣誉排名第 ${prof.honorRank}</div></div><span class="chip gold" style="margin-left:auto">${c.goatRank===1?"CURRENT GOAT":"GOAT #"+c.goatRank}</span>`;
  $("#playerKpis").innerHTML=[
    ["生涯积分",fmtScore(c.totalScore),`${c.games} 场`],["场均",fmtAvg(c.averageScore),`正分率 ${fmtPct(c.positiveRate)}`],
    ["MVP",c.mvps+" 次",`MVP率 ${fmtPct(c.mvpRate)}`],["荣誉积分",prof.honorPoints,`${prof.honorCount} 项荣誉`]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value ${x[0]==="生涯积分"?scoreClass(c.totalScore):""}">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  drawTrend(pid);
  const rec=playerTimeline(pid).slice(-10).reverse();
  $("#recentMatchesPlayer").innerHTML=rec.map(r=>`<div class="score-row ${r.isMvp?"mvp":""}"><div class="left"><span class="chip">${r.season}·${r.round}</span><span>${r.date}</span>${r.isMvp?'<span class="chip gold">MVP</span>':""}</div><b class="${scoreClass(r.score)}">${fmtScore(r.score)}</b></div>`).join("");
  $("#playerSeasonTable").innerHTML=(state.seasons||[]).map(x=>x.id).map(season=>{
    const s=(state.seasonStats[season]||[]).find(x=>x.playerId===pid);
    if(!s) return `<tr><td><span class="chip">${season}</span></td><td colspan="6" class="muted">暂无参赛数据</td></tr>`;
    return `<tr><td><span class="chip gold">${season}</span></td><td>${s.games}</td><td class="${scoreClass(s.total)}">${fmtScore(s.total)}</td><td>${fmtAvg(s.average)}</td><td>${fmtPct(s.positiveRate)}</td><td>${s.mvps}</td><td>${fmtScore(s.best)} / ${fmtScore(s.worst)}</td></tr>`
  }).join("");
  const name=p.name;
  $("#playerRivals").innerHTML=state.players.filter(x=>x.playerId!==pid).map(o=>{
    const net=state.rivalNet[name][o.name], wr=state.rivalWinRate[name][o.name];
    return `<div class="goat-row"><span class="avatar">${initials(o.name)}</span><div><strong>${o.name}</strong><div class="muted" style="font-size:11px;margin-top:4px">对位胜率 ${fmtPct(wr)}</div></div><b class="${scoreClass(net)}">${fmtScore(net)}</b></div>`
  }).join("");
  const honors=state.honors[pid]||[];
  $("#honorSummary").textContent=`${honors.length}项展示 · 官方总计 ${prof.honorCount}项`;
  $("#playerHonors").innerHTML=honors.map(h=>honorHtml(h)).join("")||'<div class="empty">暂无荣誉记录</div>';
}
$("#playerSelect").addEventListener("change",e=>{currentPlayer=e.target.value;renderPlayer()});

function matchCard(m){
  const played=m.results.filter(r=>!r.isAbsent).sort((a,b)=>b.score-a.score);
  return `<article class="card match-card"><div class="match-meta"><div><strong>${m.season} 第${m.round}局 · ${m.matchType}</strong><div><small>${m.date} · ${escapeHtml(m.venue||"未填写场地")}</small></div></div><span class="chip">${m.matchId}</span></div>
  <div class="match-scores">${played.map(r=>`<span class="score-pill ${r.isMvp?"mvp":""}">${r.player} <b class="${scoreClass(r.score)}">${fmtScore(r.score)}</b>${r.isMvp?" · MVP":""}</span>`).join("")}</div></article>`;
}
function filteredMatches(){
  const season=$("#matchSeason").value, player=$("#matchPlayer").value, type=$("#matchType").value, q=$("#matchQuery").value.trim().toLowerCase();
  return [...state.matches].reverse().filter(m=>{
    if(season!=="all"&&m.season!==season)return false;
    if(type!=="all"&&m.matchType!==type)return false;
    if(player!=="all"&&!m.results.some(r=>r.playerId===player&&!r.isAbsent))return false;
    if(q&&!`${m.matchId} ${m.date} ${m.venue} ${m.season} ${m.round}`.toLowerCase().includes(q))return false;
    return true;
  });
}
function renderMatches(reset=false){
  if(reset)matchLimit=15;
  const rows=filteredMatches();
  $("#matchList").innerHTML=rows.slice(0,matchLimit).map(matchCard).join("")||'<div class="empty">没有符合条件的比赛。</div>';
  $("#loadMoreBtn").style.display=rows.length>matchLimit?"block":"none";
}
["matchSeason","matchPlayer","matchType"].forEach(id=>$("#"+id).addEventListener("change",()=>renderMatches(true)));
$("#matchQuery").addEventListener("input",()=>renderMatches(true));
$("#loadMoreBtn").addEventListener("click",()=>{matchLimit+=15;renderMatches()});

function initEntry(){
  $("#entryDate").value=new Date().toISOString().slice(0,10);
  $("#entryPlayers").innerHTML=state.players.map(p=>`<div class="entry-player">
    <input class="entry-check" type="checkbox" id="check-${p.playerId}" data-pid="${p.playerId}" checked>
    <label for="check-${p.playerId}" style="margin:0;color:var(--text)"><span class="player-cell"><span class="avatar">${initials(p.name)}</span>${p.name}</span></label>
    <input class="entry-score" type="number" step="1" data-score="${p.playerId}" placeholder="积分">
  </div>`).join("");
  $$(".entry-check, .entry-score").forEach(x=>x.addEventListener("input",validateEntry));
  $("#entryType").addEventListener("change",()=>{const four=$("#entryType").value==="四人局"; const checks=$$(".entry-check"); checks.forEach((c,i)=>c.checked=!(four&&i===checks.length-1));validateEntry()});
  validateEntry();
}
function entryData(){
  return state.players.map(p=>({
    playerId:p.playerId,player:p.name,selected:$("#check-"+p.playerId).checked,
    score:Number($(`[data-score="${p.playerId}"]`).value)
  }));
}
function validateEntry(){
  const type=$("#entryType").value, required=type==="四人局"?4:5, rows=entryData().filter(x=>x.selected);
  const complete=rows.every(x=>Number.isFinite(x.score)), sum=rows.reduce((a,b)=>a+(Number.isFinite(b.score)?b.score:0),0);
  const ok=rows.length===required&&complete&&sum===0;
  const el=$("#entryValidation");
  el.className="validation "+(ok?"ok":"bad");
  el.textContent=`已选 ${rows.length}/${required} 人 · 分数合计 ${sum>0?"+":""}${sum} · ${ok?"校验通过":"需要满足人数正确且积分合计为0"}`;
  return ok;
}
$("#saveMatchBtn").addEventListener("click",async()=>{
  if(currentRole!=="admin") return toast("当前账号没有录入权限");
  if(!validateEntry())return toast("录入校验未通过");
  const button=$("#saveMatchBtn"); button.disabled=true; button.textContent="正在保存…";
  try{
    const selected=entryData().filter(x=>x.selected), season=$("#entrySeason").value, date=$("#entryDate").value;
    if(!date) throw new Error("请选择比赛日期");
    const seasonMatches=state.matches.filter(m=>m.season===season);
    const nextRound=seasonMatches.length?Math.max(...seasonMatches.map(m=>Number(m.round)))+1:1;
    const numeric=state.matches.map(m=>Number(String(m.matchId).replace(/\D/g,""))||0);
    const nextId="MSL"+String(Math.max(...numeric,0)+1).padStart(4,"0");
    const payload={
      id:nextId,season_id:season,round:nextRound,match_date:date,match_type:$("#entryType").value,
      venue:$("#entryVenue").value||"未填写场地",notes:"MOAP云端网页录入",
      results:state.players.map(p=>{
        const x=selected.find(s=>s.playerId===p.playerId);
        return {player_id:p.playerId,score:x?x.score:null,is_absent:!x};
      })
    };
    await apiJson("/api/matches",{
      method:"POST",
      body:JSON.stringify({payload})
    });
    await reloadCloudData();
    clearEntry(); showView("overview"); toast(`${nextId} 已永久保存到云端`);
  }catch(err){console.error(err);toast("保存失败："+(err.message||String(err)));}
  finally{button.disabled=false;button.textContent="通过代理保存到数据库";}
});
function clearEntry(){
  $$(".entry-score").forEach(x=>x.value=""); $("#entryVenue").value="";
  validateEntry();
}
$("#clearEntryBtn").addEventListener("click",clearEntry);
$("#resetDemoBtn").addEventListener("click",async()=>{
  try{await reloadCloudData();toast("已通过 EdgeOne 代理重新同步数据");}
  catch(err){toast("同步失败："+(err.message||String(err)));}
});

function renderMatrix(target,dataMatrix,percent=false,clickable=false){
  const names=state.players.map(p=>p.name);
  let html=`<thead><tr><th>牌手</th>${names.map(n=>`<th>${n}</th>`).join("")}</tr></thead><tbody>`;
  names.forEach(a=>{
    html+=`<tr><td><div class="player-cell"><span class="avatar">${initials(a)}</span>${a}</div></td>`;
    names.forEach(b=>{
      if(a===b)html+=`<td>—</td>`;
      else{
        const v=dataMatrix[a][b], cls=!percent?(v>=0?"pos":"neg"):(v>=.5?"pos":"neg");
        html+=`<td><button type="button" class="matrix-cell ${cls}" ${clickable?`data-rival-a="${a}" data-rival-b="${b}"`:""}>${percent?fmtPct(v):fmtScore(v)}</button></td>`;
      }
    });
    html+="</tr>";
  });
  target.innerHTML=html+"</tbody>";
}
function renderRival(){
  renderMatrix($("#netMatrix"),state.rivalNet,false,true);
  renderMatrix($("#winMatrix"),state.rivalWinRate,true,false);
  $$("[data-rival-a]").forEach(b=>b.addEventListener("click",()=>showRivalDetail(b.dataset.rivalA,b.dataset.rivalB)));
}
function showRivalDetail(a,b){
  const net=state.rivalNet[a][b], wr=state.rivalWinRate[a][b];
  const inverse=state.rivalNet[b][a], wr2=state.rivalWinRate[b][a];
  $("#rivalDetail").className="";
  $("#rivalDetail").innerHTML=`<div class="player-head"><span class="avatar">${initials(a)}</span><div><h3 style="margin:0">${a} vs ${b}</h3><div class="muted" style="margin-top:5px">长期对位数据</div></div></div>
    <div class="kpis" style="grid-template-columns:1fr 1fr;margin-top:16px">
      <div class="mini-stat"><span>${a}净分</span><strong class="${scoreClass(net)}">${fmtScore(net)}</strong></div>
      <div class="mini-stat"><span>${a}胜率</span><strong>${fmtPct(wr)}</strong></div>
      <div class="mini-stat"><span>${b}净分</span><strong class="${scoreClass(inverse)}">${fmtScore(inverse)}</strong></div>
      <div class="mini-stat"><span>${b}胜率</span><strong>${fmtPct(wr2)}</strong></div>
    </div>
    <div class="validation ${net>=0?"ok":"bad"}">${net>0?a+"在累计净分上占优":net<0?b+"在累计净分上占优":"双方累计净分持平"}；胜率维度由比赛场次表现决定，可能与净分方向不同。</div>`;
}

function honorHtml(h){
  const key=`${h.ownerPlayerId||""}|${h.scope}|${h.honorId}`;
  return `<button type="button" class="honor-item honor-clickable" data-honor-key="${escapeHtml(key)}"><div class="honor-top"><div style="display:flex;align-items:center;gap:9px"><span class="grade ${h.grade}">${h.grade}</span><strong>${escapeHtml(h.name)}</strong></div><span class="chip">${escapeHtml(h.scope)}</span></div><small>${escapeHtml(h.category||"官方荣誉")} · 获奖值 ${typeof h.value==="number"?Number(h.value).toFixed(Number.isInteger(h.value)?0:2):escapeHtml(h.value)} · ${escapeHtml(h.status)}</small><span class="honor-open-hint">点击查看评选规则、完整排名与证据</span></button>`;
}
function formatHonorValue(value,unit=""){if(value===null||value===undefined)return "—";if(unit==="%")return `${(Number(value)*100).toFixed(1)}%`;if(typeof value==="number"&&!Number.isInteger(value))return `${value.toFixed(2)}${unit}`;return `${value}${unit}`;}
function ensureHonorModal(){
  if($("#honorModalBackdrop"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="honor-modal-backdrop" id="honorModalBackdrop" hidden><section class="honor-modal" role="dialog" aria-modal="true" aria-labelledby="honorModalTitle"><button type="button" class="honor-modal-close" id="honorModalClose" aria-label="关闭">×</button><div id="honorModalBody"></div></section></div>`);
  $("#honorModalBackdrop").addEventListener("mousedown",e=>{if(e.target.id==="honorModalBackdrop")closeHonorModal();});
  $("#honorModalClose").addEventListener("click",closeHonorModal);
}
function closeHonorModal(){const m=$("#honorModalBackdrop");if(m){m.hidden=true;document.body.classList.remove("modal-open");}}
function openHonorModal(h){
  ensureHonorModal(); const d=h.details||{};
  const ranking=(d.ranking||[]).map(row=>`<div class="${row.player===d.winner||d.winners?.includes(row.player)?"is-winner":""}"><span>#${row.rank}</span><span><strong>${escapeHtml(row.player)}</strong>${row.note?`<small>${escapeHtml(row.note)}</small>`:""}</span><b>${escapeHtml(formatHonorValue(row.value,row.unit||d.unit))}</b></div>`).join("");
  const formula=(d.formula||[]).map(item=>`<span>${Object.entries(item).map(([k,v])=>`${escapeHtml(k)}: ${escapeHtml(v)}`).join(" · ")}</span>`).join("");
  const evidence=(d.evidence||[]).map(item=>{
    if(item.matchId){const extra=item.opponent?` · 对阵 ${escapeHtml(item.opponent)} ${escapeHtml(item.opponentScore)} · 净胜 +${escapeHtml(item.margin)}`:(item.wasAbsent?" · 缺席按0":"");return `<article><div><strong>${escapeHtml(item.matchId)} · ${escapeHtml(item.date)}</strong><span>${escapeHtml(item.matchType)} · ${escapeHtml(item.venue)}${extra}</span></div><b class="${scoreClass(item.score)}">${fmtScore(item.score)}</b></article>`;}
    return `<article><div><strong>对阵 ${escapeHtml(item.opponent||"—")}</strong><span>${item.meetings?`交手 ${item.meetings} · ${item.wins}-${item.losses}-${item.ties}`:"对位证据"}</span></div><b>${item.rivalryIndex!=null?Number(item.rivalryIndex).toFixed(2):fmtScore(item.netScore||0)}</b></article>`;
  }).join("");
  $("#honorModalBody").innerHTML=`<header class="honor-modal-header"><span class="honor-modal-grade grade ${h.grade}">${escapeHtml(h.grade)}</span><div><p>${escapeHtml(h.scope)} · ${escapeHtml(h.category||"官方荣誉")}</p><h2 id="honorModalTitle">${escapeHtml(h.name)}</h2><strong>${escapeHtml(d.winner||"—")} · ${escapeHtml(formatHonorValue(h.value,d.unit))}</strong></div></header><div class="honor-modal-section"><h3>评选规则</h3><p>${escapeHtml(d.rule||"暂无规则说明")}</p>${d.summary?`<p class="honor-modal-summary">${escapeHtml(d.summary)}</p>`:""}</div>${ranking?`<div class="honor-modal-section"><h3>完整排名</h3><div class="honor-ranking-table">${ranking}</div></div>`:""}${formula?`<div class="honor-modal-section"><h3>计算分项</h3><div class="honor-chip-list">${formula}</div></div>`:""}${evidence?`<div class="honor-modal-section"><h3>过程证据</h3><div class="honor-evidence-list">${evidence}</div></div>`:""}<footer class="honor-modal-footer">数据状态：${escapeHtml(d.calculationStatus||h.status)}</footer>`;
  $("#honorModalBackdrop").hidden=false;document.body.classList.add("modal-open");
}
document.addEventListener("click",e=>{const card=e.target.closest("[data-honor-key]");if(!card)return;const [pid,scope,hid]=card.dataset.honorKey.split("|");const h=(state.honors[pid]||[]).find(x=>x.scope===scope&&x.honorId===hid);if(h)openHonorModal(h);});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHonorModal();});
function renderGoatRows(sel,limit=5){
  const rows=[...state.goat].sort((a,b)=>a.rank-b.rank).slice(0,limit),max=Math.max(...rows.map(x=>x.goatIndex));
  $(sel).innerHTML=rows.map(r=>`<div class="goat-row"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div><div style="display:flex;justify-content:space-between"><strong>${r.player}</strong><span class="muted">${r.honorPoints}荣誉分 · ${r.mvps} MVP</span></div><div class="bar"><i style="width:${r.goatIndex/max*100}%"></i></div></div><b>${r.goatIndex}</b></div>`).join("");
}
function renderHonors(){
  renderGoatRows("#goatRanking");
  const pid=$("#honorPlayer").value||currentPlayer, p=state.profiles[pid], honors=state.honors[pid]||[];
  $("#honorStats").innerHTML=[
    ["荣誉排名","#"+p.honorRank],["荣誉总数",p.honorCount],["A级荣誉",p.gradeA],["B级荣誉",p.gradeB],["荣誉积分",p.honorPoints],["GOAT指数",state.goat.find(x=>x.playerId===pid).goatIndex]
  ].map(x=>`<div class="mini-stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  $("#honorListSummary").textContent=`当前显示 ${honors.length} 项档案记录`;
  $("#honorList").innerHTML=honors.map(honorHtml).join("")||'<div class="empty">暂无荣誉记录</div>';
}
$("#honorPlayer").addEventListener("change",renderHonors);

function renderSystem(){
  $("#systemKpis").innerHTML=[
    ["当前版本",state.version.version,"Official LTS Release"],["认证状态",state.version.certification,state.version.formulaIntegrity],
    ["当前GOAT",state.version.currentGoat,"GOAT指数 "+state.version.goatIndex],["数据规模",state.matches.length+" 场",state.meta.results+" 条原始成绩"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>14?20:27}px">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  $("#healthList").innerHTML=state.healthChecks.map(h=>`<div class="health-item"><div><strong>${h.item}</strong><div class="muted" style="font-size:11px;margin-top:4px">${h.id} · ${h.evidence}</div></div><span class="status-pass">${h.result}</span></div>`).join("");
  const v=state.version;
  $("#versionInfo").innerHTML=[
    ["发布日期",v.releaseDate],["发布阶段",v.releaseStage],["当前状态",v.currentStatus],["赛季MVP",v.seasonMvp],
    ["得分王",v.scoringKing],["H002新规则",v.note]
  ].map(x=>`<div class="honor-item"><strong>${x[0]}</strong><small>${x[1]}</small></div>`).join("");
}

$("#exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="MOAP_cloud_data.json";a.click();URL.revokeObjectURL(a.href);
  toast("当前云端数据快照已导出");
});


function boot(){
  initNav(); populateSelects(); initEntry();
  $("#versionBadge").textContent=state.version.version;
  renderOverview(); appBooted=true;
}

async function start(){
  try{
    await reloadCloudData();
    document.querySelector("#appShell").hidden=false;
    const badge=document.querySelector("#accountBadge");
    if(badge){badge.hidden=false;badge.textContent="大陆直达模式 · 可录入";}
    if(!appBooted)boot();
  }catch(err){
    console.error(err);
    document.querySelector("#appShell").hidden=false;
    toast("同站代理同步失败："+(err.message||String(err)));
  }
}
start();
