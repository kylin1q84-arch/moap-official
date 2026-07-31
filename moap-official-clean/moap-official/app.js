import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/+esm";
import { CERTIFIED_SNAPSHOT } from "./certified-data.js";
import { HONOR_CATALOG } from "./honor-details.js";
import { calculateHonorSystem, buildNbaStatusCenter } from "./analytics-engine.js";
import { MOAP_CONFIG } from "./config.js";
let state = JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT));
clearLegacyRivalState(state);
let currentView = "overview";
let currentPlayer = "P001";
let matchLimit = 15;

const NAV = [
  ["overview","总览","◈"],["leaderboard","排行榜","榜"],["status","状态中心","势"],["player","个人档案","人"],
  ["matches","比赛中心","局"],["entry","录入比赛","＋"],["rival","对位中心","对"],
  ["honors","荣誉中心","冠"],["system","系统审计","审"]
];

const HONOR_NAME_OVERRIDES = {};
const HONOR_BOARD_ITEMS = HONOR_CATALOG.map(x=>[x.honorId,x.name]);
const HONOR_BOARD_IDS = new Set(HONOR_BOARD_ITEMS.map(([id])=>id));
function honorCatalogItem(honorId){ return HONOR_CATALOG.find(x => x.honorId === honorId); }
function honorDisplayName(honorId, fallback=""){ return HONOR_NAME_OVERRIDES[honorId] || honorCatalogItem(honorId)?.name || fallback || honorId; }
function competitionRankBy(rows, valueGetter){
  let previous, rank=0;
  return rows.map((row,index)=>{
    const value=valueGetter(row);
    if(index===0 || value!==previous) rank=index+1;
    previous=value;
    return {...row,rank};
  });
}
function applyAnalyticsToState(target){
  if(!target?.players || !target?.matches)return target;
  const system=calculateHonorSystem(target.players,target.matches);
  target.honors=system.honors;
  target.honorBoard=system.board;
  target.honorCatalog=system.catalog;
  target.statusCenter=buildNbaStatusCenter(target.players,target.matches);
  target.profiles=target.profiles||{};
  const stats={};
  target.players.forEach(p=>{
    const hs=target.honors[p.playerId]||[];
    stats[p.playerId]={honorCount:hs.length,gradeA:hs.filter(h=>h.grade==="A").length,gradeB:hs.filter(h=>h.grade==="B").length,gradeCD:hs.filter(h=>h.grade==="C"||h.grade==="D").length,honorPoints:hs.reduce((sum,h)=>sum+Number(h.points||0),0)};
  });
  const honorRanked=competitionRankBy(target.players.map(p=>({playerId:p.playerId,honorPoints:stats[p.playerId].honorPoints})).sort((a,b)=>b.honorPoints-a.honorPoints||a.playerId.localeCompare(b.playerId)),x=>x.honorPoints);
  const honorRanks=Object.fromEntries(honorRanked.map(x=>[x.playerId,x.rank]));
  (target.leaderboard||[]).forEach(row=>{const h=stats[row.playerId];if(h){row.honorCount=h.honorCount;row.honorPoints=h.honorPoints;}});
  target.players.forEach(p=>{const h=stats[p.playerId];target.profiles[p.playerId]={...(target.profiles?.[p.playerId]||{}),...h,honorRank:honorRanks[p.playerId]};});
  let goat=target.players.map(p=>{
    const board=(target.leaderboard||[]).find(x=>x.playerId===p.playerId)||{};
    const titles=(target.honors[p.playerId]||[]).filter(h=>h.honorId==="H001").length;
    const honorPoints=stats[p.playerId].honorPoints,mvps=Number(board.mvps||0);
    return {playerId:p.playerId,player:p.name,honorPoints,mvps,titles,goatIndex:honorPoints+mvps+titles*10};
  }).sort((a,b)=>b.goatIndex-a.goatIndex||b.honorPoints-a.honorPoints||b.mvps-a.mvps||a.playerId.localeCompare(b.playerId));
  goat=competitionRankBy(goat,x=>x.goatIndex).map(x=>({...x,winner:x.rank===1?"CURRENT GOAT":""}));
  target.goat=goat;
  const goatBy=Object.fromEntries(goat.map(x=>[x.playerId,x]));
  (target.leaderboard||[]).forEach(row=>{const g=goatBy[row.playerId];if(g){row.goatIndex=g.goatIndex;row.goatRank=g.rank;}});
  if(target.version){
    const top=goat[0],honorTop=[...target.players].sort((a,b)=>stats[b.playerId].honorPoints-stats[a.playerId].honorPoints)[0];
    target.version={...target.version,version:"v1.7 NBA Honor & Form",releaseStage:"Official Feature Release",releaseDate:"2026-07-31",currentStatus:"Unique honor rules + NBA-style form center",currentGoat:top?.player||"—",goatIndex:top?.goatIndex||0,honorKing:honorTop?`${honorTop.name} · ${stats[honorTop.playerId].honorPoints}`:"—",note:"荣誉唯一性规则已启用；铁人奖、鸽王允许并列。新增MSL实力榜、行情与NBA式AI球探报告。"};
  }
  return target;
}
applyAnalyticsToState(state);

const sb = createClient(MOAP_CONFIG.supabaseUrl, MOAP_CONFIG.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
let currentRole="admin",appBooted=false;

function setAuthStatus(message,isError=false,isOk=false){
  const el=document.querySelector("#authStatus"); if(!el)return;
  el.textContent=message; el.className="auth-status"+(isError?" error":isOk?" ok":"");
}
function showLogin(){document.querySelector("#authGate").hidden=false;document.querySelector("#appShell").hidden=true;setAuthStatus("等待登录");}
function clearLegacyRivalState(target){
  const names=(target.players||[]).map(p=>p.name||p.player);
  const net={},history={};
  names.forEach(a=>{net[a]={};history[a]={};names.forEach(b=>{net[a][b]=a===b?null:0;history[a][b]=[];});});
  target.rivalNet=net;
  target.rivalHistory=history;
  target.rivalSummary=(target.players||[]).map(p=>({playerId:p.playerId,player:p.name||p.player,eat:0,eaten:0,total:0}));
  target.rivalryMeta={startDate:null,trackedMatches:0,entries:0,scoreOnlyMatches:0,mode:"PRECISE_PAIRWISE_ONLY"};
  delete target.rivalWinRate;
  return target;
}

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
  const honorSystem=calculateHonorSystem(players,matches);
  const honors=honorSystem.honors;
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

  // 精准对位只读取 matchup_transfers。历史比赛总分不再推算任何对位关系。
  const matchupRows=(db.matchups||[]).map(x=>({
    id:x.id,matchId:x.match_id,fromPlayerId:x.from_player_id,toPlayerId:x.to_player_id,
    points:Number(x.points),createdAt:x.created_at||null
  })).filter(x=>Number.isFinite(x.points)&&x.points>0&&nameBy[x.fromPlayerId]&&nameBy[x.toPlayerId]&&x.fromPlayerId!==x.toPlayerId);
  const matchById=Object.fromEntries(matches.map(m=>[m.matchId,m]));
  const rivalNet={},rivalHistory={};
  players.forEach(a=>{rivalNet[a.name]={};rivalHistory[a.name]={};players.forEach(b=>{
    rivalNet[a.name][b.name]=a.playerId===b.playerId?null:0;
    rivalHistory[a.name][b.name]=[];
  });});
  matchupRows.forEach(t=>{
    const from=nameBy[t.fromPlayerId],to=nameBy[t.toPlayerId],points=Number(t.points),m=matchById[t.matchId];
    rivalNet[from][to]+=points;rivalNet[to][from]-=points;
    const base={matchId:t.matchId,date:m?.date||"—",season:m?.season||"—",round:m?.round??"—",matchType:m?.matchType||"—",venue:m?.venue||"未填写场地",points};
    rivalHistory[from][to].push({...base,net:points});
    rivalHistory[to][from].push({...base,net:-points});
  });
  Object.values(rivalHistory).forEach(row=>Object.values(row).forEach(items=>items.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.matchId).localeCompare(String(a.matchId)))));
  const rivalSummary=players.map(p=>{
    const values=players.filter(o=>o.playerId!==p.playerId).map(o=>Number(rivalNet[p.name][o.name]||0));
    return {playerId:p.playerId,player:p.name,eat:values.filter(v=>v>0).reduce((a,b)=>a+b,0),eaten:-values.filter(v=>v<0).reduce((a,b)=>a+b,0),total:values.reduce((a,b)=>a+b,0)};
  });
  const trackedMatchIds=[...new Set(matchupRows.map(x=>x.matchId))];
  const trackedDates=trackedMatchIds.map(id=>matchById[id]?.date).filter(Boolean).sort();
  const scoreOnlyMatches=matches.filter(m=>/\[(?:NO_PRECISE_MATCHUP|BACKFILL_2026-07-30_SCORE_ONLY)\]/.test(String(m.notes||""))).length;
  const rivalryMeta={startDate:trackedDates[0]||null,trackedMatches:trackedMatchIds.length,entries:matchupRows.length,scoreOnlyMatches,mode:"PRECISE_PAIRWISE_ONLY"};

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
  const matchupInvalid=(db.matchups||[]).filter(x=>!x.match_id||!nameBy[x.from_player_id]||!nameBy[x.to_player_id]||x.from_player_id===x.to_player_id||!Number.isInteger(Number(x.points))||Number(x.points)<=0).length;
  pushCheck("HC009","精准对位记录异常",matchupInvalid,"matchup_transfers");
  const matchupByMatch={};matchupRows.forEach(x=>(matchupByMatch[x.matchId]??=[]).push(x));
  let matchupMismatch=0;
  Object.entries(matchupByMatch).forEach(([mid,rows])=>{
    const m=matchById[mid];if(!m){matchupMismatch++;return;}
    const sums=Object.fromEntries(players.map(p=>[p.playerId,0]));
    rows.forEach(x=>{sums[x.fromPlayerId]+=x.points;sums[x.toPlayerId]-=x.points;});
    m.results.filter(r=>!r.isAbsent).forEach(r=>{if(Number(sums[r.playerId]||0)!==Number(r.score))matchupMismatch++;});
  });
  pushCheck("HC010","对位行和与比赛积分不一致",matchupMismatch,"逐场 matchup_transfers ↔ match_results");
  const passCount=checks.filter(x=>x.result==="PASS").length,healthScore=Math.round(passCount/checks.length*100);
  const topGoat=goat[0],topHonor=[...leaderboard].sort((a,b)=>b.honorPoints-a.honorPoints)[0];
  const awardWinners=id=>seasonIds.map(s=>{const row=honorSystem.board.find(a=>a.scope===s&&a.honorId===id);return row?.winners?.length?`${s} ${row.winners.join("/")}`:null}).filter(Boolean).join("；")||"暂无";
  const version={...CERTIFIED_SNAPSHOT.version,version:"v1.7 NBA Honor & Form",releaseStage:"Official Feature Release",releaseDate:"2026-07-31",currentStatus:"Unique honor rules + NBA-style form center",formulaIntegrity:"PASS",certification:"LIVE DATA VERIFIED",note:"荣誉唯一性规则已启用；铁人奖、鸽王允许并列。新增MSL实力榜、行情与NBA式AI球探报告。",currentGoat:topGoat?.player||"—",goatIndex:topGoat?.goatIndex||0,honorKing:topHonor?`${topHonor.player} · ${topHonor.honorPoints}`:"—",seasonMvp:awardWinners("H003"),scoringKing:awardWinners("H004")};
  const statusCenter=buildNbaStatusCenter(players,matches);
  return {...JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT)),meta:{...CERTIFIED_SNAPSHOT.meta,matches:matches.length,results:db.results.length,players:players.length,healthScore},players,seasons,matches,leaderboard,seasonStats,honors,honorBoard:honorSystem.board,honorCatalog:honorSystem.catalog,profiles,goat,statusCenter,matchups:matchupRows,rivalNet,rivalHistory,rivalSummary,rivalryMeta,version,healthChecks:checks};
}

async function fetchTable(table,columns="*"){
  const {data,error}=await sb.from(table).select(columns);if(error)throw new Error(`${table}: ${error.message}`);return data||[];
}
async function reloadCloudData(){
  const [players,seasons,matches,results,awards,versions,matchupsResponse]=await Promise.all([
    fetchTable("players"),fetchTable("seasons"),fetchTable("matches"),fetchTable("match_results"),fetchTable("award_results"),
    sb.from("system_versions").select("*").order("release_date",{ascending:false}),
    sb.from("matchup_transfers").select("*")
  ]);
  if(versions.error)throw new Error(`system_versions: ${versions.error.message}`);
  let matchups=[];
  if(matchupsResponse.error){
    const message=String(matchupsResponse.error.message||"");
    const missingTable=matchupsResponse.error.code==="42P01"||matchupsResponse.error.code==="PGRST205"||message.includes("Could not find the table")||message.includes("does not exist");
    if(!missingTable)throw new Error(`matchup_transfers: ${message}`);
  }else matchups=matchupsResponse.data||[];

  if(!players.length || !matches.length || !results.length){
    throw new Error("Supabase 未向公开访客返回数据。请确认 anon 读取策略仍然有效。");
  }

  currentRole="admin";
  state=buildLiveState({players,seasons,matches,results,awards,versions:versions.data||[],matchups});
  if(appBooted){initNav();populateSelects();initEntry();showView(currentView);}
  document.querySelector("#healthBadge").textContent=`云端健康 ${state.meta.healthScore}%`;
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
  if(id==="status") renderStatus();
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
    ["系统健康",state.meta.healthScore+"%",`${state.healthChecks.filter(x=>x.result==="PASS").length}/${state.healthChecks.length} 检查通过`]
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
  const power=state.statusCenter?.rankings||[];
  $("#recentFormList").innerHTML=power.map(r=>`<button type="button" class="power-compact" data-status-player="${r.playerId}"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div><div class="power-compact-top"><strong>${escapeHtml(r.player)}</strong><span>${escapeHtml(r.label)}</span></div><div class="bar"><i style="width:${Math.max(4,r.powerIndex)}%"></i></div><small>${escapeHtml(r.archetype)} · 近5场 ${fmtScore(r.recentTotal)}</small></div><b>${r.powerIndex}</b></button>`).join("")||'<div class="empty">暂无状态数据</div>';
  $("#overviewStorylines").innerHTML=(state.statusCenter?.storylines||[]).map(x=>`<div class="storyline-item">${escapeHtml(x)}</div>`).join("");
  renderGoatRows("#goatMini",5);
}

function movementText(r){return r.movement>0?`↑${r.movement}`:r.movement<0?`↓${Math.abs(r.movement)}`:"—";}
function renderStatus(){
  const center=state.statusCenter||{rankings:[],storylines:[],methodology:"",gameRecap:null},rows=center.rankings||[];
  const hot=rows[0],cold=rows.at(-1),up=[...rows].sort((a,b)=>b.movement-a.movement||b.indexChange-a.indexChange)[0],mvp=rows.find(r=>r.latest?.isMvp)||rows[0];
  $("#statusKpis").innerHTML=[
    ["当前最火热",hot?.player||"—",hot?`${hot.powerIndex} 状态指数`:"暂无"],
    ["当前最低迷",cold?.player||"—",cold?`${cold.powerIndex} 状态指数`:"暂无"],
    ["行情上升",up?.player||"—",up?`${movementText(up)} · 指数 ${up.indexChange>=0?"+":""}${up.indexChange}`:"暂无"],
    ["最新MVP",mvp?.latest?.isMvp?mvp.player:"—",mvp?.latest?`${mvp.latest.season} 第${mvp.latest.round}局`:"暂无"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>8?22:28}px">${escapeHtml(x[1])}</div><div class="kpi-sub">${escapeHtml(x[2])}</div></div>`).join("");
  $("#powerRanking").innerHTML=rows.map(r=>`<button type="button" class="power-card" data-status-player="${r.playerId}"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div class="power-card-main"><div class="power-card-title"><strong>${escapeHtml(r.player)}</strong><span class="stock ${r.report.headline.startsWith("STOCK UP")?"up":r.report.headline.startsWith("STOCK DOWN")?"down":"hold"}">${escapeHtml(r.report.headline.split("｜")[0])}</span></div><div class="power-card-meta"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.archetype)}</span><span>近5场 ${fmtScore(r.recentTotal)}</span></div><div class="bar"><i style="width:${Math.max(4,r.powerIndex)}%"></i></div></div><div class="power-score"><b>${r.powerIndex}</b><small>${movementText(r)}</small></div></button>`).join("");
  $("#stockWatch").innerHTML=rows.map(r=>`<button type="button" class="stock-row" data-status-player="${r.playerId}"><div><strong>${escapeHtml(r.player)}</strong><span>${escapeHtml(r.report.headline)}</span></div><b class="${r.indexChange>0?"score-pos":r.indexChange<0?"score-neg":""}">${r.indexChange>0?"+":""}${r.indexChange}</b></button>`).join("");
  const recap=center.gameRecap;
  $("#latestAiRecap").innerHTML=recap?`<article class="ai-recap"><div class="ai-recap-head"><div><span class="chip gold">GAME RECAP</span><h3>${escapeHtml(recap.title)}</h3><small>${escapeHtml(recap.meta)}</small></div></div><p>${escapeHtml(recap.body)}</p><div class="match-scores">${recap.scores.map(x=>`<span class="score-pill ${x.isMvp?"mvp":""}">${escapeHtml(x.player)} <b class="${scoreClass(x.score)}">${fmtScore(x.score)}</b>${x.isMvp?" · MVP":""}</span>`).join("")}</div></article>`:'<div class="empty">暂无比赛可生成战报</div>';
  $("#statusStorylines").innerHTML=(center.storylines||[]).map(x=>`<div class="storyline-item">${escapeHtml(x)}</div>`).join("");
  $("#statusMethodology").innerHTML=`<p>${escapeHtml(center.methodology||"")}</p><div class="method-bars"><span>近期加权净分 <b>35%</b></span><span>正分率 <b>20%</b></span><span>MVP <b>15%</b></span><span>BGR <b>10%</b></span><span>走势 <b>10%</b></span><span>相对赛季表现 <b>10%</b></span></div><small>AI分析为数据驱动模板，不参与积分、荣誉或GOAT计算。</small>`;
}
function renderPlayerScouting(pid){
  const r=state.statusCenter?.rankings?.find(x=>x.playerId===pid),el=$("#playerScouting");if(!el)return;
  if(!r){el.innerHTML='<div class="empty">暂无状态分析</div>';return;}
  el.innerHTML=`<div class="scouting-report"><header><div><span class="stock ${r.report.headline.startsWith("STOCK UP")?"up":r.report.headline.startsWith("STOCK DOWN")?"down":"hold"}">${escapeHtml(r.report.headline)}</span><h3>${escapeHtml(r.label)} · 实力榜 #${r.rank}</h3><p>${escapeHtml(r.report.summary)}</p></div><div class="scouting-index"><b>${r.powerIndex}</b><small>状态指数</small></div></header><div class="scouting-columns"><section><h4>近期亮点</h4>${r.report.strengths.map(x=>`<span>✓ ${escapeHtml(x)}</span>`).join("")}</section><section><h4>潜在风险</h4>${r.report.risks.map(x=>`<span>• ${escapeHtml(x)}</span>`).join("")}</section><section><h4>下一场关注</h4><p>${escapeHtml(r.report.next)}</p></section></div><footer>牌手类型：${escapeHtml(r.archetype)} · 最近5场：${r.recent.map(x=>`${x.score>=0?"+":""}${x.score}`).join(" / ")||"暂无"}</footer></div>`;
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-status-player]");if(!b)return;currentPlayer=b.dataset.statusPlayer;$("#playerSelect").value=currentPlayer;showView("player");});

function boardMatches(scope,type){
  return (state.matches||[]).filter(m=>(scope==="career"||m.season===scope)&&(type==="all"||m.matchType===type));
}
function streakLengths(values,predicate){
  const lengths=[];let current=0;
  values.forEach(value=>{if(predicate(value)){current++;}else if(current){lengths.push(current);current=0;}});
  if(current)lengths.push(current);
  return lengths;
}
function bgrBucket(score){
  score=Number(score);
  if(score>=100)return "100";if(score>=90)return "90";if(score>=80)return "80";
  if(score>=70)return "70";if(score>=60)return "60";if(score>=50)return "50";return null;
}
function playerBoardMetrics(player,scope,type){
  const matches=boardMatches(scope,type),played=[];
  matches.forEach(match=>{const result=(match.results||[]).find(r=>r.playerId===player.playerId&&!r.isAbsent&&r.score!=null);if(result)played.push({match,result});});
  const scores=played.map(x=>Number(x.result.score)),games=scores.length,totalScore=scores.reduce((a,b)=>a+b,0);
  const positiveGames=scores.filter(x=>x>=0).length;
  const positiveStreaks=streakLengths(scores,x=>x>=0).filter(x=>x>=2);
  const bgrStreaks=streakLengths(scores,x=>x>=50);
  const mvpFlags=played.map(x=>!!x.result.isMvp),mvpStreaks=streakLengths(mvpFlags,Boolean);
  const buckets={"100":0,"90":0,"80":0,"70":0,"60":0,"50":0};
  scores.forEach(score=>{const bucket=bgrBucket(score);if(bucket)buckets[bucket]++;});
  const soloEvents=[];
  matches.forEach(match=>{
    const winner=getSoloWinner(match);if(!winner||winner.playerId!==player.playerId)return;
    const sorted=playedResultsForMatch(match).sort((a,b)=>Number(b.score)-Number(a.score));
    const second=sorted.find(r=>r.playerId!==player.playerId);
    soloEvents.push({matchId:match.matchId,score:Number(winner.score),margin:second?Number(winner.score)-Number(second.score):0});
  });
  const selectedHonors=(state.honors?.[player.playerId]||[]).filter(h=>HONOR_BOARD_IDS.has(h.honorId)&&(scope==="career"||h.scope===scope));
  const honorBreakdown={};HONOR_BOARD_ITEMS.forEach(([id])=>honorBreakdown[id]={count:0,points:0});
  selectedHonors.forEach(h=>{const item=honorBreakdown[h.honorId];if(item){item.count++;item.points+=Number(h.points||0);}});
  return {
    playerId:player.playerId,player:player.name,games,totalScore,averageScore:games?totalScore/games:0,
    positiveGames,positiveRate:games?positiveGames/games:0,best:scores.length?Math.max(...scores):null,worst:scores.length?Math.min(...scores):null,
    streakCount:positiveStreaks.length,longestStreak:positiveStreaks.length?Math.max(...positiveStreaks):0,averageStreak:positiveStreaks.length?average(positiveStreaks):0,
    bgrIndex:scores.reduce((sum,score)=>sum+bgrValue(score),0),bgrBuckets:buckets,longestBgrStreak:bgrStreaks.length?Math.max(...bgrStreaks):0,
    mvps:mvpFlags.filter(Boolean).length,longestMvpStreak:mvpStreaks.length?Math.max(...mvpStreaks):0,mvpRate:games?mvpFlags.filter(Boolean).length/games:0,
    soloWins:soloEvents.length,soloRate:games?soloEvents.length/games:0,highestSolo:soloEvents.length?Math.max(...soloEvents.map(x=>x.score)):null,maxSoloLead:soloEvents.length?Math.max(...soloEvents.map(x=>x.margin)):null,
    honorBreakdown,totalHonorPoints:selectedHonors.reduce((sum,h)=>sum+Number(h.points||0),0),honorAwardCount:selectedHonors.length
  };
}
function boardPrimary(kind,row){
  if(kind==="streak")return row.longestStreak;
  if(kind==="bgr")return row.bgrIndex;
  if(kind==="mvp")return row.mvps;
  if(kind==="solo")return row.soloWins;
  if(kind==="honor")return row.totalHonorPoints;
  return row.totalScore;
}
function boardComparator(kind){
  const compare=(a,b)=>{
    const fields={
      total:[["totalScore",-1],["averageScore",-1],["positiveRate",-1],["best",-1]],
      streak:[["longestStreak",-1],["streakCount",-1],["averageStreak",-1],["games",-1]],
      bgr:[["bgrIndex",-1],["b100",-1],["b90",-1],["b80",-1],["longestBgrStreak",-1]],
      mvp:[["mvps",-1],["mvpRate",-1],["longestMvpStreak",-1],["games",-1]],
      solo:[["soloWins",-1],["soloRate",-1],["maxSoloLead",-1],["highestSolo",-1]],
      honor:[["totalHonorPoints",-1],["honorAwardCount",-1],["games",-1]]
    }[kind]||[];
    const aa={...a,b100:a.bgrBuckets?.["100"]||0,b90:a.bgrBuckets?.["90"]||0,b80:a.bgrBuckets?.["80"]||0};
    const bb={...b,b100:b.bgrBuckets?.["100"]||0,b90:b.bgrBuckets?.["90"]||0,b80:b.bgrBuckets?.["80"]||0};
    for(const [field,direction] of fields){const av=Number(aa[field]??-Infinity),bv=Number(bb[field]??-Infinity);if(av!==bv)return direction*(av-bv);}
    return a.playerId.localeCompare(b.playerId);
  };return compare;
}
function boardRows(){
  const scope=$("#boardScope").value,kind=$("#boardKind").value,search=$("#boardSearch").value.trim();
  let type=$("#boardType").value;
  if(kind==="honor")type="all";
  let rows=state.players.map(player=>playerBoardMetrics(player,scope,type)).filter(row=>!search||row.player.includes(search));
  rows.sort(boardComparator(kind));
  return competitionRankBy(rows,row=>boardPrimary(kind,row));
}
function playerCell(row){return `<div class="player-cell"><span class="avatar">${initials(row.player)}</span>${escapeHtml(row.player)}</div>`;}
function renderHonorBreakdownCell(item){return `<span class="honor-count-cell"><b>${item.count}</b><small>${item.points}分</small></span>`;}
function renderLeaderboard(){
  const kind=$("#boardKind").value,rows=boardRows(),typeSelect=$("#boardType");
  const notes={
    total:"正分率按得分≥0计算；缺席不计参赛场次。",
    streak:"连庄沿用官方H006口径：连续实际参赛得分≥0；缺席不增加也不中断，负分中断。连庄总次数只统计长度≥2的连续段。",
    bgr:"BGR采用互斥档位：50–59/60–69/70–79/80–89/90–99/100+，权重1/2/3/5/8/12；连续大场面指连续实际参赛得分≥50。",
    mvp:"共同MVP双方均计1次；最长连续MVP按个人实际参赛序列计算，缺席不增加也不中断。",
    solo:"独赢：本人积分≥0且同场其他所有实际参赛牌手均<0；最大领先分差=独赢者积分−当场第二高积分。",
    honor:"荣誉分按19项正式荣誉汇总；已删除MVP之王和二十MVP先生。荣誉无法按比赛类型拆分，因此此榜固定使用全部比赛类型。"
  };
  $("#boardNote").textContent=notes[kind];
  if(kind==="honor"){typeSelect.value="all";typeSelect.disabled=true;}else typeSelect.disabled=false;
  let headers=[],rowHtml;
  if(kind==="total"){
    headers=["排名","牌手","总积分","参赛场次","场均积分","正分率","正分场次","最高单场","最低单场"];
    rowHtml=row=>`<tr><td><span class="rank ${row.rank===1?"top":""}">${row.rank}</span></td><td>${playerCell(row)}</td><td class="${scoreClass(row.totalScore)}">${fmtScore(row.totalScore)}</td><td>${row.games}</td><td>${fmtAvg(row.averageScore)}</td><td>${fmtPct(row.positiveRate)}</td><td>${row.positiveGames}</td><td class="${scoreClass(row.best??0)}">${row.best==null?"—":fmtScore(row.best)}</td><td class="${scoreClass(row.worst??0)}">${row.worst==null?"—":fmtScore(row.worst)}</td></tr>`;
  }else if(kind==="streak"){
    headers=["排名","牌手","连庄总次数","最长连庄纪录","平均连庄长度","参赛场次"];
    rowHtml=row=>`<tr><td><span class="rank ${row.rank===1?"top":""}">${row.rank}</span></td><td>${playerCell(row)}</td><td>${row.streakCount}</td><td>${row.longestStreak}场</td><td>${row.averageStreak?row.averageStreak.toFixed(2)+"场":"0场"}</td><td>${row.games}</td></tr>`;
  }else if(kind==="bgr"){
    headers=["排名","牌手","BGR指数","100+次数","90–99次数","80–89次数","70–79次数","60–69次数","50–59次数","最长连续大场面","参赛场次"];
    rowHtml=row=>`<tr><td><span class="rank ${row.rank===1?"top":""}">${row.rank}</span></td><td>${playerCell(row)}</td><td><b>${row.bgrIndex}</b></td><td>${row.bgrBuckets["100"]}</td><td>${row.bgrBuckets["90"]}</td><td>${row.bgrBuckets["80"]}</td><td>${row.bgrBuckets["70"]}</td><td>${row.bgrBuckets["60"]}</td><td>${row.bgrBuckets["50"]}</td><td>${row.longestBgrStreak}场</td><td>${row.games}</td></tr>`;
  }else if(kind==="mvp"){
    headers=["排名","牌手","MVP次数","最长连续MVP","MVP率","参赛场次"];
    rowHtml=row=>`<tr><td><span class="rank ${row.rank===1?"top":""}">${row.rank}</span></td><td>${playerCell(row)}</td><td>${row.mvps}</td><td>${row.longestMvpStreak}场</td><td>${fmtPct(row.mvpRate)}</td><td>${row.games}</td></tr>`;
  }else if(kind==="solo"){
    headers=["排名","牌手","独赢次数","独赢率","最高独赢积分","最大领先分差","参赛场次"];
    rowHtml=row=>`<tr><td><span class="rank ${row.rank===1?"top":""}">${row.rank}</span></td><td>${playerCell(row)}</td><td>${row.soloWins}</td><td>${fmtPct(row.soloRate)}</td><td class="${scoreClass(row.highestSolo??0)}">${row.highestSolo==null?"—":fmtScore(row.highestSolo)}</td><td>${row.maxSoloLead==null?"—":"+"+row.maxSoloLead}</td><td>${row.games}</td></tr>`;
  }else{
    headers=["排名","牌手","荣誉总分",...HONOR_BOARD_ITEMS.map(([,name])=>name)];
    rowHtml=row=>`<tr><td><span class="rank ${row.rank===1?"top":""}">${row.rank}</span></td><td>${playerCell(row)}</td><td><b>${row.totalHonorPoints}</b></td>${HONOR_BOARD_ITEMS.map(([id])=>`<td>${renderHonorBreakdownCell(row.honorBreakdown[id])}</td>`).join("")}</tr>`;
  }
  $("#fullLeaderboardHead").innerHTML=`<tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  $("#fullLeaderboard").innerHTML=rows.map(rowHtml).join("")||'<tr><td colspan="30" class="empty">没有匹配的牌手。</td></tr>';
}
["boardScope","boardKind","boardType"].forEach(id=>document.addEventListener("change",e=>{if(e.target.id===id)renderLeaderboard()}));
document.addEventListener("input",e=>{if(e.target.id==="boardSearch")renderLeaderboard()});

function populateSelects(){
  const opts=state.players.map(p=>`<option value="${p.playerId}">${p.name}</option>`).join("");
  $("#playerSelect").innerHTML=opts; $("#honorPlayer").innerHTML=opts;
  $("#matchPlayer").innerHTML='<option value="all">全部牌手</option>'+opts;
  const seasons=(state.seasons||[]).map(s=>s.id);
  const boardSeasons=seasons.filter(id=>(state.matches||[]).some(m=>m.season===id));
  $("#boardScope").innerHTML='<option value="career">生涯全部</option>'+boardSeasons.map(s=>`<option value="${s}">${s}</option>`).join("");
  $("#matchSeason").innerHTML='<option value="all">全部赛季</option>'+seasons.map(s=>`<option value="${s}">${s}</option>`).join("");
  $("#entrySeason").innerHTML=(state.seasons||[]).map(s=>`<option value="${s.id}" ${s.status==="active"?"selected":""}>${s.id}${s.status==="active"?"（进行中）":""}</option>`).join("");
  const honorSeason=$("#honorBoardSeason");if(honorSeason){const previous=honorSeason.value;honorSeason.innerHTML=boardSeasons.map(s=>`<option value="${s}">${s}</option>`).join("");honorSeason.value=boardSeasons.includes(previous)?previous:(boardSeasons.at(-1)||"");}
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
    const net=state.rivalNet[name][o.name], records=(state.rivalHistory?.[name]?.[o.name]||[]).length;
    return `<div class="goat-row"><span class="avatar">${initials(o.name)}</span><div><strong>${o.name}</strong><div class="muted" style="font-size:11px;margin-top:4px">新制精准对位 · ${records} 场有分记录</div></div><b class="${scoreClass(net)}">${fmtScore(net)}</b></div>`
  }).join("");
  renderPlayerScouting(pid);
  const honors=state.honors[pid]||[],groups=groupPlayerHonors(honors);
  $("#honorSummary").textContent=`${groups.length}类奖项 · 生涯累计 ${honors.length}次`;
  $("#playerHonors").innerHTML=groups.map(group=>honorGroupHtml(pid,group)).join("")||'<div class="empty">暂无荣誉记录</div>';
}
$("#playerSelect").addEventListener("change",e=>{currentPlayer=e.target.value;renderPlayer()});

function matchCard(m){
  const played=m.results.filter(r=>!r.isAbsent).sort((a,b)=>b.score-a.score);
  const scoreOnly=/\[(?:NO_PRECISE_MATCHUP|BACKFILL_2026-07-30_SCORE_ONLY)\]/.test(String(m.notes||""));
  return `<article class="card match-card"><div class="match-meta"><div><strong>${m.season} 第${m.round}局 · ${m.matchType}</strong><div><small>${m.date} · ${escapeHtml(m.venue||"未填写场地")}</small></div></div><div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">${scoreOnly?'<span class="chip gold">总分补录 · 无精准对位</span>':""}<span class="chip">${m.matchId}</span></div></div>
  <div class="match-scores">${played.map(r=>`<span class="score-pill ${r.isMvp?"mvp":""}">${r.player} <b class="${scoreClass(r.score)}">${fmtScore(r.score)}</b>${r.isMvp?" · MVP":""}</span>`).join("")}</div>${scoreOnly?'<div class="validation" style="margin-top:10px">本场只补录最终积分，不进入精准对位矩阵；精准对位从下一场开始统计。</div>':""}</article>`;
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
    <input class="entry-score" type="number" step="1" data-score="${p.playerId}" placeholder="比赛总分（可填0）">
  </div>`).join("");
  renderEntryMatchupMatrix();
  $$(".entry-check, .entry-score").forEach(x=>x.addEventListener("input",()=>{updateEntryMatrixAvailability();validateEntry();}));
  $("#entryType").onchange=()=>{
    const four=$("#entryType").value==="四人局",checks=$$(".entry-check");
    if(four&&checks.filter(x=>x.checked).length!==4)checks.forEach((c,i)=>c.checked=i<4);
    if(!four)checks.forEach(c=>c.checked=true);
    updateEntryMatrixAvailability();validateEntry();
  };
  updateEntryMatrixAvailability();validateEntry();
}
function renderEntryMatchupMatrix(){
  const ps=state.players;
  let html=`<thead><tr><th>攻击方（吃分） ↓</th>${ps.map(p=>`<th>${escapeHtml(p.name)}</th>`).join("")}<th>行合计</th><th>比赛分</th></tr></thead><tbody>`;
  ps.forEach(a=>{
    html+=`<tr data-matchup-row="${a.playerId}"><td><div class="player-cell"><span class="avatar">${initials(a.name)}</span>${escapeHtml(a.name)}</div></td>`;
    ps.forEach(b=>{
      if(a.playerId===b.playerId)html+=`<td class="matchup-diagonal">—</td>`;
      else html+=`<td><input class="matchup-input" type="number" step="1" inputmode="numeric" data-matchup-from="${a.playerId}" data-matchup-to="${b.playerId}" aria-label="${escapeHtml(a.name)} 对 ${escapeHtml(b.name)} 的对位分"></td>`;
    });
    html+=`<td><strong data-row-total="${a.playerId}">0</strong></td><td><strong data-entry-score-view="${a.playerId}">—</strong></td></tr>`;
  });
  $("#entryMatchupMatrix").innerHTML=html+"</tbody>";
  $$(".matchup-input").forEach(input=>{
    input.addEventListener("input",e=>{
      const from=e.target.dataset.matchupFrom,to=e.target.dataset.matchupTo,raw=e.target.value.trim();
      const mirror=$(`[data-matchup-from="${to}"][data-matchup-to="${from}"]`);
      if(raw==="")mirror.value="";
      else if(Number.isFinite(Number(raw)))mirror.value=String(-Number(raw));
      updateMatchupCellStyle(e.target);updateMatchupCellStyle(mirror);validateEntry();
    });
    input.addEventListener("blur",e=>{
      // 0 是合法的对位结果：保留显式输入的 0，不再自动清空。
      // 保存时 0 分对位不会写入 matchup_transfers，空白与 0 在统计上都按 0 处理。
      updateMatchupCellStyle(e.target);validateEntry();
    });
  });
}
function updateMatchupCellStyle(input){
  if(!input)return;const v=Number(input.value);
  input.classList.toggle("pos",input.value!==""&&v>0);input.classList.toggle("neg",input.value!==""&&v<0);
}
function updateEntryMatrixAvailability(){
  const selected=new Set(state.players.filter(p=>$("#check-"+p.playerId)?.checked).map(p=>p.playerId));
  $$(".matchup-input").forEach(input=>{
    const enabled=selected.has(input.dataset.matchupFrom)&&selected.has(input.dataset.matchupTo);
    input.disabled=!enabled;
    if(!enabled){input.value="";input.classList.remove("pos","neg");}
  });
  state.players.forEach(p=>{
    const row=$(`[data-matchup-row="${p.playerId}"]`);if(row)row.classList.toggle("is-absent",!selected.has(p.playerId));
  });
}
function entryData(){
  return state.players.map(p=>{
    const raw=$(`[data-score="${p.playerId}"]`).value.trim();
    return {playerId:p.playerId,player:p.name,selected:$("#check-"+p.playerId).checked,score:raw===""?null:Number(raw),raw};
  });
}
function entryMatchupData(){
  const ps=state.players,nets=Object.fromEntries(ps.map(p=>[p.playerId,0])),matchups=[];let valid=true;
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
    const a=ps[i],b=ps[j],ab=$(`[data-matchup-from="${a.playerId}"][data-matchup-to="${b.playerId}"]`),ba=$(`[data-matchup-from="${b.playerId}"][data-matchup-to="${a.playerId}"]`);
    const raw=ab?.value.trim()||"",mirrorRaw=ba?.value.trim()||"";
    const v=raw===""?0:Number(raw),mirror=mirrorRaw===""?0:Number(mirrorRaw);
    if(!Number.isInteger(v)||!Number.isInteger(mirror)||mirror!==-v)valid=false;
    nets[a.playerId]+=v;nets[b.playerId]-=v;
    if(v>0)matchups.push({from_player_id:a.playerId,to_player_id:b.playerId,points:v});
    if(v<0)matchups.push({from_player_id:b.playerId,to_player_id:a.playerId,points:-v});
  }
  return {valid,nets,matchups};
}
function validateEntry(){
  const type=$("#entryType").value,required=type==="四人局"?4:5,allRows=entryData(),rows=allRows.filter(x=>x.selected);
  const complete=rows.every(x=>x.raw!==""&&Number.isInteger(x.score)),sum=rows.reduce((a,b)=>a+(Number.isFinite(b.score)?b.score:0),0);
  const basicOk=rows.length===required&&complete&&sum===0;
  const matchup=entryMatchupData();
  const comparisons=allRows.map(x=>{
    const rowTotal=matchup.nets[x.playerId]||0,scoreView=x.selected?(x.raw===""?"—":fmtScore(x.score)):"缺席";
    const rowEl=$(`[data-row-total="${x.playerId}"]`),scoreEl=$(`[data-entry-score-view="${x.playerId}"]`);
    if(rowEl){rowEl.textContent=fmtScore(rowTotal);rowEl.className=scoreClass(rowTotal);}
    if(scoreEl){scoreEl.textContent=scoreView;scoreEl.className=x.selected&&x.raw!==""?scoreClass(x.score):"";}
    const ok=!x.selected?rowTotal===0:(x.raw!==""&&Number.isInteger(x.score)&&rowTotal===x.score);
    return {...x,rowTotal,ok};
  });
  const matchupOk=matchup.valid&&comparisons.every(x=>x.ok);
  const ok=basicOk&&matchupOk;
  const el=$("#entryValidation");el.className="validation "+(ok?"ok":"bad");
  el.textContent=`比赛人数 ${rows.length}/${required} · 比赛分合计 ${sum>0?"+":""}${sum} · 对位行和 ${matchupOk?"全部匹配":"存在不一致"} · ${ok?"可以保存":"请完成校验"}`;
  $("#matchupValidation").className="validation "+(matchupOk?"ok":"bad");
  $("#matchupValidation").innerHTML=comparisons.map(x=>`<span class="matchup-check ${x.ok?"pass":"fail"}">${escapeHtml(x.player)}：对位 ${fmtScore(x.rowTotal)} / 比赛 ${x.selected?(x.raw===""?"未填":fmtScore(x.score)):"缺席"}</span>`).join("");
  return ok;
}
$("#saveMatchBtn").addEventListener("click",async()=>{
  if(currentRole!=="admin") return toast("当前账号没有录入权限");
  if(!validateEntry())return toast("录入校验未通过");
  const button=$("#saveMatchBtn"); button.disabled=true; button.textContent="正在保存…";
  try{
    const selected=entryData().filter(x=>x.selected),matchup=entryMatchupData(),season=$("#entrySeason").value,date=$("#entryDate").value;
    if(!date) throw new Error("请选择比赛日期");
    const seasonMatches=state.matches.filter(m=>m.season===season);
    const nextRound=seasonMatches.length?Math.max(...seasonMatches.map(m=>Number(m.round)))+1:1;
    const numeric=state.matches.map(m=>Number(String(m.matchId).replace(/\D/g,""))||0);
    const nextId="MSL"+String(Math.max(...numeric,0)+1).padStart(4,"0");
    const payload={
      id:nextId,season_id:season,round:nextRound,match_date:date,match_type:$("#entryType").value,
      venue:$("#entryVenue").value||"未填写场地",notes:"MOAP云端网页录入 · 精准对位新制",
      results:state.players.map(p=>{
        const x=selected.find(s=>s.playerId===p.playerId);
        return {player_id:p.playerId,score:x?x.score:null,is_absent:!x};
      }),
      matchups:matchup.matchups
    };
    const {error}=await sb.rpc("create_match_with_results",{p_payload:payload});
    if(error) throw error;
    await reloadCloudData();
    clearEntry(); showView("overview"); toast(`${nextId} 已保存，精准对位中心已实时更新`);
  }catch(err){console.error(err);toast("保存失败："+(err.message||String(err)));}
  finally{button.disabled=false;button.textContent="保存比赛与精准对位";}
});
function clearEntry(){
  $$(".entry-score, .matchup-input").forEach(x=>{x.value="";x.classList.remove("pos","neg");}); $("#entryVenue").value="";
  validateEntry();
}
$("#clearEntryBtn").addEventListener("click",clearEntry);
$("#resetDemoBtn").addEventListener("click",async()=>{
  try{await reloadCloudData();toast("已重新同步 Supabase 云端数据");}
  catch(err){toast("同步失败："+(err.message||String(err)));}
});

function renderMatrix(target,dataMatrix,clickable=false){
  const names=state.players.map(p=>p.name);
  let html=`<thead><tr><th>攻击方（吃分） ↓</th>${names.map(n=>`<th>${escapeHtml(n)}</th>`).join("")}</tr></thead><tbody>`;
  names.forEach(a=>{
    html+=`<tr><td><div class="player-cell"><span class="avatar">${initials(a)}</span>${escapeHtml(a)}</div></td>`;
    names.forEach(b=>{
      if(a===b)html+=`<td class="matchup-diagonal">—</td>`;
      else{
        const v=Number(dataMatrix?.[a]?.[b]||0),cls=v>0?"pos":v<0?"neg":"neutral";
        html+=`<td><button type="button" class="matrix-cell ${cls}" ${clickable?`data-rival-a="${escapeHtml(a)}" data-rival-b="${escapeHtml(b)}"`:""}>${fmtScore(v)}</button></td>`;
      }
    });
    html+="</tr>";
  });
  target.innerHTML=html+"</tbody>";
}
function extremePlayers(rows,key,mode="max"){
  if(!rows.length)return {value:0,names:[]};
  const value=Math[mode](...rows.map(x=>Number(x[key]||0)));
  return {value,names:rows.filter(x=>Number(x[key]||0)===value).map(x=>x.player)};
}
function renderRival(){
  renderMatrix($("#netMatrix"),state.rivalNet,true);
  $$('[data-rival-a]').forEach(b=>b.addEventListener("click",()=>showRivalDetail(b.dataset.rivalA,b.dataset.rivalB)));
  const meta=state.rivalryMeta||{startDate:null,trackedMatches:0,entries:0,scoreOnlyMatches:0};
  $("#rivalKpis").innerHTML=[
    ["统计起点",meta.startDate||"等待首场","旧比赛不参与推算"],
    ["已记录比赛",meta.trackedMatches+" 场","仅含精准对位明细"],
    ["有效对位",meta.entries+" 条","每条代表一组实际吃分"],
    ["总分补录",(meta.scoreOnlyMatches||0)+" 场","只计总积分，不进入对位"],
    ["统计口径","新制精准","行攻击方 / 列承受方"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>8?20:27}px">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  const rows=[...(state.rivalSummary||[])];
  $("#rivalSummaryTable").innerHTML=rows.map(r=>`<tr><td><div class="player-cell"><span class="avatar">${initials(r.player)}</span>${escapeHtml(r.player)}</div></td><td class="score-pos">${fmtScore(r.eat)}</td><td class="score-neg">${r.eaten?"-"+r.eaten:"0"}</td><td class="${scoreClass(r.total)}">${fmtScore(r.total)}</td></tr>`).join("");
  if(!meta.entries){
    $("#rivalRanking").innerHTML='<div class="empty">旧版推算数据已清除。录入第一场带精准对位明细的新比赛后，这里会自动生成排名。</div>';
    $("#rivalDetail").className="empty";$("#rivalDetail").textContent="暂无新制对位记录。";
    return;
  }
  const winner=extremePlayers(rows,"total","max"),loser=extremePlayers(rows,"total","min"),eat=extremePlayers(rows,"eat","max"),eaten=extremePlayers(rows,"eaten","max");
  $("#rivalRanking").innerHTML=[
    ["总赢家",winner.names.join(" / "),fmtScore(winner.value)],
    ["最大输家",loser.names.join(" / "),fmtScore(loser.value)],
    ["吃分最多",eat.names.join(" / "),fmtScore(eat.value)],
    ["被吃最多",eaten.names.join(" / "),"-"+eaten.value]
  ].map(x=>`<div class="honor-item rival-rank-item"><span>${x[0]}</span><strong>${escapeHtml(x[1])}</strong><b class="${x[2].startsWith("-")?"score-neg":"score-pos"}">${x[2]}</b></div>`).join("");
}
function showRivalDetail(a,b){
  const net=Number(state.rivalNet?.[a]?.[b]||0),history=state.rivalHistory?.[a]?.[b]||[];
  $("#rivalDetail").className="";
  const list=history.length?history.map(item=>`<div class="score-row"><div class="left"><span class="chip">${escapeHtml(item.matchId)}</span><span>${escapeHtml(item.date)} · ${escapeHtml(item.venue)}</span></div><b class="${scoreClass(item.net)}">${fmtScore(item.net)}</b></div>`).join(""):'<div class="empty">两人之间暂时没有非零对位记录。</div>';
  $("#rivalDetail").innerHTML=`<div class="player-head"><span class="avatar">${initials(a)}</span><div><h3 style="margin:0">${escapeHtml(a)} vs ${escapeHtml(b)}</h3><div class="muted" style="margin-top:5px">新制精准对位 · 不含旧比赛推算</div></div></div>
    <div class="kpis" style="grid-template-columns:1fr 1fr;margin-top:16px"><div class="mini-stat"><span>${escapeHtml(a)}净分</span><strong class="${scoreClass(net)}">${fmtScore(net)}</strong></div><div class="mini-stat"><span>有分记录</span><strong>${history.length} 场</strong></div></div>
    <div class="validation ${net>0?"ok":net<0?"bad":""}">${net>0?a+"当前对位占优":net<0?b+"当前对位占优":"双方当前持平"}。每笔数据来自录入比赛时的逐对位矩阵。</div>
    <div class="score-list" style="margin-top:12px">${list}</div>`;
}

function scopeOrder(scope){if(scope==="CAREER")return 999;const n=Number(String(scope).replace(/\D/g,""));return Number.isFinite(n)?n:500;}
function groupPlayerHonors(honors){
  const map=new Map();
  honors.forEach(h=>{const key=h.honorId;if(!map.has(key))map.set(key,{honorId:key,name:h.name,grade:h.grade,category:h.category,awards:[],points:0});const group=map.get(key);group.awards.push(h);group.points+=Number(h.points||0);});
  return [...map.values()].map(group=>({...group,awards:group.awards.sort((a,b)=>scopeOrder(a.scope)-scopeOrder(b.scope))})).sort((a,b)=>{
    const gradeOrder={A:1,B:2,C:3,D:4,"":5};return (gradeOrder[a.grade]||9)-(gradeOrder[b.grade]||9)||b.awards.length-a.awards.length||a.name.localeCompare(b.name,"zh-CN");
  });
}
function honorGroupHtml(pid,group){
  const scopes=group.awards.map(h=>h.scope==="CAREER"?"生涯":h.scope).join(" · ");
  return `<button type="button" class="honor-item honor-clickable honor-group-card" data-honor-group="${escapeHtml(`${pid}|${group.honorId}`)}"><div class="honor-top"><div style="display:flex;align-items:center;gap:9px"><span class="grade ${group.grade}">${group.grade}</span><strong>${escapeHtml(group.name)}</strong></div><span class="chip gold">×${group.awards.length}</span></div><small>${escapeHtml(group.category||"官方荣誉")} · 累计 ${group.points} 荣誉分</small><div class="honor-scope-list">${escapeHtml(scopes)}</div><span class="honor-open-hint">点击查看各赛季评选过程与明细</span></button>`;
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
function honorDetailSections(h){
  const d=h.details||{};
  const ranking=(d.ranking||[]).map(row=>`<div class="${row.player===d.winner||d.winners?.includes(row.player)?"is-winner":""}"><span>#${row.rank}</span><span><strong>${escapeHtml(row.player)}</strong>${row.note?`<small>${escapeHtml(row.note)}</small>`:""}</span><b>${escapeHtml(formatHonorValue(row.value,row.unit||d.unit))}</b></div>`).join("");
  const formula=(d.formula||[]).map(item=>`<span>${Object.entries(item).map(([k,v])=>`${escapeHtml(k)}: ${escapeHtml(v)}`).join(" · ")}</span>`).join("");
  const evidence=(d.evidence||[]).map(item=>{
    if(item.matchId){
      let extra="";
      if(item.opponent)extra=` · 对阵 ${escapeHtml(item.opponent)} ${escapeHtml(item.opponentScore)} · 净胜 +${escapeHtml(item.margin)}`;
      else if(item.secondPlayer)extra=` · 第二名 ${escapeHtml(item.secondPlayer)} ${item.secondScore>=0?"+":""}${escapeHtml(item.secondScore)} · 领先 +${escapeHtml(item.margin)}`;
      else if(item.wasAbsent)extra=" · 缺席按0";
      return `<article><div><strong>${escapeHtml(item.matchId)} · ${escapeHtml(item.date)}</strong><span>${escapeHtml(item.matchType)} · ${escapeHtml(item.venue)}${extra}</span></div><b class="${scoreClass(item.score)}">${fmtScore(item.score)}</b></article>`;
    }
    return `<article><div><strong>对阵 ${escapeHtml(item.opponent||"—")}</strong><span>${item.meetings?`交手 ${item.meetings} · ${item.wins}-${item.losses}-${item.ties}`:"对位证据"}</span></div><b>${item.rivalryIndex!=null?Number(item.rivalryIndex).toFixed(2):fmtScore(item.netScore||0)}</b></article>`;
  }).join("");
  return `<div class="honor-modal-section"><h3>评选规则</h3><p>${escapeHtml(d.rule||"暂无规则说明")}</p>${d.summary?`<p class="honor-modal-summary">${escapeHtml(d.summary)}</p>`:""}</div>${ranking?`<div class="honor-modal-section"><h3>完整排名</h3><div class="honor-ranking-table">${ranking}</div></div>`:""}${formula?`<div class="honor-modal-section"><h3>计算分项</h3><div class="honor-chip-list">${formula}</div></div>`:""}${evidence?`<div class="honor-modal-section"><h3>过程证据</h3><div class="honor-evidence-list">${evidence}</div></div>`:""}<footer class="honor-modal-footer">数据状态：${escapeHtml(d.calculationStatus||h.status)} · 荣誉分 ${Number(h.points||0)}</footer>`;
}
function openHonorModal(h){
  ensureHonorModal();const d=h.details||{};
  $("#honorModalBody").innerHTML=`<header class="honor-modal-header"><span class="honor-modal-grade grade ${h.grade}">${escapeHtml(h.grade)}</span><div><p>${escapeHtml(h.scope)} · ${escapeHtml(h.category||"官方荣誉")}</p><h2 id="honorModalTitle">${escapeHtml(h.name)}</h2><strong>${escapeHtml(d.winner||"—")} · ${escapeHtml(formatHonorValue(h.value,d.unit))}</strong></div></header>${honorDetailSections(h)}`;
  $("#honorModalBackdrop").hidden=false;document.body.classList.add("modal-open");
}
function openHonorGroupModal(pid,honorId){
  const awards=(state.honors?.[pid]||[]).filter(h=>h.honorId===honorId).sort((a,b)=>scopeOrder(a.scope)-scopeOrder(b.scope));if(!awards.length)return;
  const first=awards[0],player=state.players.find(p=>p.playerId===pid)?.name||pid,totalPoints=awards.reduce((sum,h)=>sum+Number(h.points||0),0);
  ensureHonorModal();
  const seasons=awards.map((h,index)=>`<details class="honor-season-detail" ${index===awards.length-1?"open":""}><summary><span><b>${escapeHtml(h.scope==="CAREER"?"生涯":h.scope)}</b> · ${escapeHtml(formatHonorValue(h.value,h.details?.unit))}</span><span>${Number(h.points||0)}分 · ${escapeHtml(h.status)}</span></summary><div class="honor-season-body">${honorDetailSections(h)}</div></details>`).join("");
  $("#honorModalBody").innerHTML=`<header class="honor-modal-header"><span class="honor-modal-grade grade ${first.grade}">${escapeHtml(first.grade)}</span><div><p>${escapeHtml(player)} · 官方荣誉汇总</p><h2 id="honorModalTitle">${escapeHtml(first.name)} ×${awards.length}</h2><strong>${awards.length}次获奖 · 累计 ${totalPoints} 荣誉分</strong></div></header><div class="honor-modal-section"><h3>赛季获奖明细</h3><div class="honor-season-stack">${seasons}</div></div>`;
  $("#honorModalBackdrop").hidden=false;document.body.classList.add("modal-open");
}
document.addEventListener("click",e=>{
  const group=e.target.closest("[data-honor-group]");if(group){const [pid,hid]=group.dataset.honorGroup.split("|");openHonorGroupModal(pid,hid);return;}
  const card=e.target.closest("[data-honor-key]");if(!card)return;const [pid,scope,hid]=card.dataset.honorKey.split("|");const h=(state.honors[pid]||[]).find(x=>x.scope===scope&&x.honorId===hid);if(h)openHonorModal(h);
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHonorModal();});
function renderGoatRows(sel,limit=5){
  const rows=[...state.goat].sort((a,b)=>a.rank-b.rank).slice(0,limit),max=Math.max(...rows.map(x=>x.goatIndex));
  $(sel).innerHTML=rows.map(r=>`<div class="goat-row"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div><div style="display:flex;justify-content:space-between"><strong>${r.player}</strong><span class="muted">${r.honorPoints}荣誉分 · ${r.mvps} MVP</span></div><div class="bar"><i style="width:${r.goatIndex/max*100}%"></i></div></div><b>${r.goatIndex}</b></div>`).join("");
}
function renderHonorSeasonBoard(){
  const season=$("#honorBoardSeason")?.value||(state.seasons||[]).map(x=>x.id).at(-1),rows=state.honorBoard||[];
  $("#honorSeasonBoard").innerHTML=HONOR_CATALOG.map(c=>{
    const r=rows.find(x=>x.scope===season&&x.honorId===c.honorId);
    const status=!r?(c.honorId==="H022"?"未达成":"未计算"):r.status;
    const winner=r?.winners?.length?r.winners.join(" / "):status==="PENDING_TIEBREAK"?"待定":status==="NOT_AWARDED"?"本季不颁发":"—";
    const statusClass=status==="PENDING_TIEBREAK"?"pending":status==="NOT_AWARDED"||status==="未达成"?"empty-state":"awarded";
    return `<article class="honor-board-card ${statusClass}"><div class="honor-top"><div style="display:flex;align-items:center;gap:9px"><span class="grade ${c.grade}">${c.grade}</span><strong>${escapeHtml(c.name)}</strong></div><span class="chip">${escapeHtml(season)}</span></div><b>${escapeHtml(winner)}</b><small>${escapeHtml(c.rule)}</small>${c.allowTie?'<span class="tie-note">允许并列</span>':'<span class="unique-note">唯一获奖</span>'}</article>`;
  }).join("");
}
function renderHonors(){
  renderGoatRows("#goatRanking");
  const pid=$("#honorPlayer").value||currentPlayer, p=state.profiles[pid], honors=state.honors[pid]||[];
  $("#honorStats").innerHTML=[
    ["荣誉排名","#"+p.honorRank],["荣誉总数",p.honorCount],["A级荣誉",p.gradeA],["B级荣誉",p.gradeB],["荣誉积分",p.honorPoints],["GOAT指数",state.goat.find(x=>x.playerId===pid).goatIndex]
  ].map(x=>`<div class="mini-stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  $("#honorListSummary").textContent=`当前显示 ${honors.length} 项档案记录`;
  $("#honorList").innerHTML=honors.map(honorHtml).join("")||'<div class="empty">暂无荣誉记录</div>';
  renderHonorSeasonBoard();
}
$("#honorPlayer").addEventListener("change",renderHonors);
$("#honorBoardSeason")?.addEventListener("change",renderHonorSeasonBoard);

function renderSystem(){
  $("#systemKpis").innerHTML=[
    ["当前版本",state.version.version,"Official LTS Release"],["认证状态",state.version.certification,state.version.formulaIntegrity],
    ["当前GOAT",state.version.currentGoat,"GOAT指数 "+state.version.goatIndex],["数据规模",state.matches.length+" 场",state.meta.results+" 条原始成绩"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>14?20:27}px">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  $("#healthList").innerHTML=state.healthChecks.map(h=>`<div class="health-item"><div><strong>${h.item}</strong><div class="muted" style="font-size:11px;margin-top:4px">${h.id} · ${h.evidence}</div></div><span class="status-pass">${h.result}</span></div>`).join("");
  const v=state.version;
  $("#versionInfo").innerHTML=[
    ["发布日期",v.releaseDate],["发布阶段",v.releaseStage],["当前状态",v.currentStatus],["MSL赛季MVP",v.seasonMvp],
    ["得分王",v.scoringKing],["v1.7更新",v.note]
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
  const gate=document.querySelector("#authGate");
  if(gate) gate.hidden=true;
  document.querySelector("#appShell").hidden=false;

  // 先显示 v10.1 LTS 认证基线，再同步 Supabase。
  // 即使网络、API Key 或 RLS 出错，页面也不会再变成空白数据。
  if(!appBooted)boot();

  const badge=document.querySelector("#accountBadge");
  if(!MOAP_CONFIG.supabaseUrl || !MOAP_CONFIG.supabaseKey){
    currentRole="readonly";
    if(badge){badge.hidden=false;badge.textContent="认证基线模式 · 缺少云端配置";}
    initNav();
    toast("缺少 Supabase 配置，当前显示 v10.1 LTS 认证基线。");
    return;
  }

  try{
    await reloadCloudData();
    if(badge){badge.hidden=false;badge.textContent="公开直达模式 · 云端已同步 · 可录入";}
  }catch(err){
    console.error(err);
    currentRole="readonly";
    if(badge){badge.hidden=false;badge.textContent="认证基线模式 · 云端未授权";}
    document.querySelector("#healthBadge").textContent="云端同步失败 · 基线可用";
    initNav();
    if(currentView==="entry") currentView="overview";
    showView(currentView);
    toast("云端同步失败，已保留 v10.1 基线："+(err.message||String(err)));
  }
}
start();
