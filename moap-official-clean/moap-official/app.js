import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/+esm";
import { CERTIFIED_SNAPSHOT } from "./certified-data.js";
import { HONOR_CATALOG } from "./honor-details.js";
import { calculateHonorSystem, buildMslStatusCenter } from "./analytics-engine.js";
import { buildRecordCenter } from "./records-engine.js";
import { buildGoatSystem } from "./goat-engine.js";
import { validateMoapData } from "./data-validation.js";
import { MOAP_CONFIG } from "./config.js";
let state = JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT));
clearLegacyRivalState(state);
let currentView = "overview";
let currentPlayer = "P001";
let matchLimit = 15;

const NAV = [
  ["overview","总览","◈"],["records","记录中心","录"],["status","状态中心","势"],["player","个人档案","人"],
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
  const orderedMatches=[...target.matches].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.round||0)-Number(b.round||0)||String(a.matchId).localeCompare(String(b.matchId)));
  const system=calculateHonorSystem(target.players,orderedMatches);
  target.honors=system.honors;
  target.honorBoard=system.board;
  target.honorCatalog=system.catalog;
  target.recordCenter=buildRecordCenter(target.players,orderedMatches);
  const previousMatches=orderedMatches.slice(0,-1);
  const previousHonorSystem=calculateHonorSystem(target.players,previousMatches);
  const previousRecordCenter=buildRecordCenter(target.players,previousMatches);
  const previousGoat=buildGoatSystem(target.players,previousMatches,previousHonorSystem.honors,previousRecordCenter).rows;
  const goatSystem=buildGoatSystem(target.players,orderedMatches,target.honors,target.recordCenter,previousGoat);
  target.goat=goatSystem.rows;
  target.goatMethodology=goatSystem.methodology;
  target.statusCenter=buildMslStatusCenter(target.players,orderedMatches,target.honors);
  target.profiles=target.profiles||{};
  const stats={};
  target.players.forEach(p=>{
    const hs=target.honors[p.playerId]||[];
    stats[p.playerId]={honorCount:hs.length,gradeA:hs.filter(h=>h.grade==="A").length,gradeB:hs.filter(h=>h.grade==="B").length,gradeCD:hs.filter(h=>h.grade==="C"||h.grade==="D").length,honorPoints:hs.reduce((sum,h)=>sum+Number(h.points||0),0)};
  });
  const honorRanked=competitionRankBy(target.players.map(p=>({playerId:p.playerId,honorPoints:stats[p.playerId].honorPoints})).sort((a,b)=>b.honorPoints-a.honorPoints||a.playerId.localeCompare(b.playerId)),x=>x.honorPoints);
  const honorRanks=Object.fromEntries(honorRanked.map(x=>[x.playerId,x.rank]));
  const goatBy=Object.fromEntries(target.goat.map(x=>[x.playerId,x]));
  (target.leaderboard||[]).forEach(row=>{
    const h=stats[row.playerId],g=goatBy[row.playerId];
    if(h){row.honorCount=h.honorCount;row.honorPoints=h.honorPoints;}
    if(g){row.goatIndex=g.goatIndex;row.goatRank=g.rank;}
  });
  target.players.forEach(p=>{
    const h=stats[p.playerId],g=goatBy[p.playerId];
    target.profiles[p.playerId]={...(target.profiles?.[p.playerId]||{}),...h,honorRank:honorRanks[p.playerId],goatIndex:g?.goatIndex,goatRank:g?.rank};
  });
  const validation=validateMoapData(target.players,orderedMatches,target.matchups||[]);
  target.healthChecks=validation.checks;
  target.meta={...(target.meta||{}),healthScore:validation.healthScore};
  const top=target.goat[0],honorTop=[...target.players].sort((a,b)=>stats[b.playerId].honorPoints-stats[a.playerId].honorPoints)[0];
  const seasonIds=[...new Set(orderedMatches.map(match=>match.season))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
  const awardWinners=id=>seasonIds.map(season=>{const row=target.honorBoard.find(item=>item.scope===season&&item.honorId===id);return row?.winners?.length?`${season} ${row.winners.join("/")}`:null;}).filter(Boolean).join("；")||"暂无";
  target.version={...(target.version||{}),version:"v1.8.1 MSL Records & GOAT",releaseStage:"Official Feature Release",releaseDate:"2026-08-04",currentStatus:"record center correction + AI GOAT model",formulaIntegrity:validation.healthScore===100?"PASS":"CHECK WARNINGS",certification:"LIVE DATA VERIFIED",currentGoat:top?.player||"—",goatIndex:top?.goatIndex||0,honorKing:honorTop?`${honorTop.name} · ${stats[honorTop.playerId].honorPoints}`:"—",seasonMvp:awardWinners("H003"),note:"记录中心采用互斥大场面档位与前5历史排名；两项A级荣誉公式更新，B级荣誉10分（铁人奖5分）；GOAT指数改为荣誉、生涯、纪录、持续性四维模型。"};
  return target;
}
applyAnalyticsToState(state);

const sb = MOAP_CONFIG.supabaseUrl && MOAP_CONFIG.supabaseKey
  ? createClient(MOAP_CONFIG.supabaseUrl, MOAP_CONFIG.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  : null;
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
  target.rivalryMeta={startDate:null,trackedMatches:0,entries:0,mode:"PRECISE_PAIRWISE_ONLY"};
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
  const honorRanked=competitionRanks(players.map(p=>({playerId:p.playerId,honorPoints:honorStats[p.playerId].honorPoints})).sort((a,b)=>b.honorPoints-a.honorPoints||a.playerId.localeCompare(b.playerId)),"honorPoints");
  const honorRank=Object.fromEntries(honorRanked.map(x=>[x.playerId,x.rank]));
  const recordCenter=buildRecordCenter(players,matches);
  const previousMatches=matches.slice(0,-1);
  const previousHonorSystem=calculateHonorSystem(players,previousMatches);
  const previousRecordCenter=buildRecordCenter(players,previousMatches);
  const previousGoat=buildGoatSystem(players,previousMatches,previousHonorSystem.honors,previousRecordCenter).rows;
  const goatSystem=buildGoatSystem(players,matches,honors,recordCenter,previousGoat);
  const goat=goatSystem.rows;
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
  const rivalryMeta={startDate:trackedDates[0]||null,trackedMatches:trackedMatchIds.length,entries:matchupRows.length,mode:"PRECISE_PAIRWISE_ONLY"};

  const checks=[];
  const pushCheck=(id,item,found,evidence)=>checks.push({id,item,found,target:"0",result:found===0?"PASS":"FAIL",evidence,details:[]});
  pushCheck("DB001","ResultID 唯一性",db.results.length-new Set(db.results.map(r=>r.id)).size,"match_results.id");
  pushCheck("DB002","Matches 表 MatchID 唯一性",db.matches.length-new Set(db.matches.map(m=>m.id)).size,"matches.id");
  pushCheck("DB003","荣誉记录唯一性",db.awards.length-new Set(db.awards.map(a=>`${a.player_id}|${a.scope}|${a.award_id}`)).size,"award_results");
  pushCheck("DB004","缺失 PlayerID",db.results.filter(r=>!r.player_id||!nameBy[r.player_id]).length,"match_results.player_id");
  pushCheck("DB005","缺失 Season",db.matches.filter(m=>!m.season_id).length,"matches.season_id");
  pushCheck("DB006","非缺席但缺失 Score",db.results.filter(r=>!r.is_absent&&r.score==null).length,"match_results.score/is_absent");
  const matchIds=new Set(db.matches.map(m=>m.id));pushCheck("DB007","Result MatchID 未登记",db.results.filter(r=>!matchIds.has(r.match_id)).length,"match_results→matches");
  const validation=validateMoapData(players,matches,matchupRows);
  checks.push(...validation.checks);
  const passCount=checks.filter(x=>x.result==="PASS").length,healthScore=Math.round(passCount/checks.length*100);
  const topGoat=goat[0],topHonor=[...leaderboard].sort((a,b)=>b.honorPoints-a.honorPoints)[0];
  const awardWinners=id=>seasonIds.map(s=>{const row=honorSystem.board.find(a=>a.scope===s&&a.honorId===id);return row?.winners?.length?`${s} ${row.winners.join("/")}`:null}).filter(Boolean).join("；")||"暂无";
  const version={...CERTIFIED_SNAPSHOT.version,version:"v1.8.1 MSL Records & GOAT",releaseStage:"Official Feature Release",releaseDate:"2026-08-04",currentStatus:"record center correction + AI GOAT model",formulaIntegrity:healthScore===100?"PASS":"CHECK WARNINGS",certification:"LIVE DATA VERIFIED",note:"记录中心采用互斥大场面档位与前5历史排名；两项A级荣誉公式更新，B级荣誉10分（铁人奖5分）；GOAT指数改为荣誉、生涯、纪录、持续性四维模型。",currentGoat:topGoat?.player||"—",goatIndex:topGoat?.goatIndex||0,honorKing:topHonor?`${topHonor.player} · ${topHonor.honorPoints}`:"—",seasonMvp:awardWinners("H003"),scoringKing:"已由记录中心替代"};
  const statusCenter=buildMslStatusCenter(players,matches,honors);
  return {...JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT)),meta:{...CERTIFIED_SNAPSHOT.meta,matches:matches.length,results:db.results.length,players:players.length,healthScore},players,seasons,matches,leaderboard,seasonStats,honors,honorBoard:honorSystem.board,honorCatalog:honorSystem.catalog,profiles,goat,goatMethodology:goatSystem.methodology,statusCenter,recordCenter,matchups:matchupRows,rivalNet,rivalHistory,rivalSummary,rivalryMeta,version,healthChecks:checks};
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
  if(id==="records") renderRecords();
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
    ["当前GOAT",goat.player,Number(goat.goatIndex||0).toFixed(1)+" 指数"],
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
  $("#recentFormList").innerHTML=power.map(r=>`<button type="button" class="power-compact" data-status-player="${r.playerId}"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div><div class="power-compact-top"><strong>${escapeHtml(r.player)}</strong><span>${escapeHtml(r.label)}</span></div><div class="bar"><i style="width:${Math.max(4,r.powerIndex)}%"></i></div><small>${escapeHtml(r.archetype)} · 近5场 ${fmtScore(r.recentTotal)} · 生涯OVR ${r.career?.overallRating??"—"}</small></div><b>${r.powerIndex}</b></button>`).join("")||'<div class="empty">暂无状态数据</div>';
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
  $("#powerRanking").innerHTML=rows.map(r=>`<button type="button" class="power-card" data-status-player="${r.playerId}"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div class="power-card-main"><div class="power-card-title"><strong>${escapeHtml(r.player)}</strong><span class="stock ${r.report.trendKey==="up"?"up":r.report.trendKey==="down"?"down":"hold"}">${escapeHtml(r.report.headline)}</span></div><div class="power-card-meta"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.archetype)}</span><span>近5场 ${fmtScore(r.recentTotal)}</span><span>生涯OVR ${r.career?.overallRating??"—"}</span></div><div class="bar"><i style="width:${Math.max(4,r.powerIndex)}%"></i></div></div><div class="power-score"><b>${r.powerIndex}</b><small>${movementText(r)}</small></div></button>`).join("");
  $("#stockWatch").innerHTML=rows.map(r=>`<button type="button" class="stock-row" data-status-player="${r.playerId}"><div><strong>${escapeHtml(r.player)}</strong><span>${escapeHtml(r.report.headline)}</span></div><b class="${r.indexChange>0?"score-pos":r.indexChange<0?"score-neg":""}">${r.indexChange>0?"+":""}${r.indexChange}</b></button>`).join("");
  const recap=center.gameRecap;
  $("#latestAiRecap").innerHTML=recap?`<article class="ai-recap"><div class="ai-recap-head"><div><span class="chip gold">MSL 赛后简报</span><h3>${escapeHtml(recap.title)}</h3><small>${escapeHtml(recap.meta)}</small></div></div><p>${escapeHtml(recap.body)}</p><div class="match-scores">${recap.scores.map(x=>`<span class="score-pill ${x.isMvp?"mvp":""}">${escapeHtml(x.player)} <b class="${scoreClass(x.score)}">${fmtScore(x.score)}</b>${x.isMvp?" · MVP":""}</span>`).join("")}</div></article>`:'<div class="empty">暂无比赛可生成战报</div>';
  $("#statusStorylines").innerHTML=(center.storylines||[]).map(x=>`<div class="storyline-item">${escapeHtml(x)}</div>`).join("");
  $("#statusMethodology").innerHTML=`<p>${escapeHtml(center.methodology||"")}</p><h4 class="method-title">近期状态指数</h4><div class="method-bars"><span>近期加权净分 <b>35%</b></span><span>正分率 <b>20%</b></span><span>MVP <b>15%</b></span><span>BGR <b>10%</b></span><span>走势 <b>10%</b></span><span>相对赛季表现 <b>10%</b></span></div><h4 class="method-title">生涯综合评分 OVR</h4><div class="method-bars"><span>历季累计积分 <b>25%</b></span><span>生涯场均 <b>20%</b></span><span>生涯正分率 <b>15%</b></span><span>MVP率 <b>15%</b></span><span>场均BGR <b>10%</b></span><span>官方荣誉积分 <b>15%</b></span></div><h4 class="method-title">GOAT指数</h4><div class="method-bars"><span>官方荣誉 <b>40%</b></span><span>生涯表现 <b>30%</b></span><span>历史纪录 <b>15%</b></span><span>持续性与适应性 <b>15%</b></span></div><small>近期状态与OVR不影响官方荣誉；GOAT采用固定数据模型，AI只负责解释评分依据。</small>`;
}
function renderPlayerScouting(pid){
  const r=state.statusCenter?.rankings?.find(x=>x.playerId===pid),el=$("#playerScouting");if(!el)return;
  if(!r){el.innerHTML='<div class="empty">暂无状态分析</div>';return;}
  const report=r.report||{};
  const trendClass=report.trendKey==="up"?"up":report.trendKey==="down"?"down":"hold";
  const season=r.season||{},career=r.career||{},goat=state.goat?.find(x=>x.playerId===pid)||{};
  const seasonCards=(career.seasonHistory||[]).map(s=>`<article class="career-season-card"><div><span>${escapeHtml(s.season)}</span><b>${escapeHtml(s.ratingLabel||"赛季评价")}</b></div><strong>${s.rating??"—"}</strong><small>积分 ${fmtScore(s.total||0)} · 排名 #${s.totalRank||"—"} · 场均 ${fmtAvg(s.average||0)} · MVP ${s.mvps||0}</small></article>`).join("")||'<div class="empty">暂无历季数据</div>';
  const goatBreakdown=Object.values(goat.breakdown||{}).map(item=>`<div><span>${escapeHtml(item.label)}</span><b>${Number(item.score||0).toFixed(1)}<small> / ${item.max}</small></b><i><em style="width:${Math.min(100,Number(item.score||0)/Number(item.max||1)*100)}%"></em></i></div>`).join("");
  const goatFacts=(goat.evaluation?.facts||[]).map(item=>`<span>• ${escapeHtml(item)}</span>`).join("");
  const goatChange=Number(goat.indexChange||0),goatMove=Number(goat.movement||0);
  el.innerHTML=`<div class="scouting-report"><header><div><span class="stock ${trendClass}">${escapeHtml(report.headline||"持续观望")}</span><h3>${escapeHtml(r.label)} · MSL实力榜 #${r.rank}</h3><p>${escapeHtml(report.summary||"")}</p></div><div class="scouting-index"><b>${r.powerIndex}</b><small>近期状态指数</small></div></header>
  <div class="goat-evaluation"><div class="goat-evaluation-head"><div><span>MSL历史地位</span><h4>GOAT综合评价</h4><b>${escapeHtml(goat.evaluation?.label||"历史观察中")}</b></div><div class="goat-rating"><strong>${Number(goat.goatIndex||0).toFixed(1)}</strong><small>GOAT INDEX</small><span>联盟 #${goat.rank||"—"}${goatMove?` · ${goatMove>0?"↑":"↓"}${Math.abs(goatMove)}`:""}</span></div></div><p>${escapeHtml(goat.evaluation?.summary||"暂无GOAT综合评价。")}</p><div class="goat-component-grid">${goatBreakdown}</div><div class="goat-change-reason"><b class="${goatChange>0?"score-pos":goatChange<0?"score-neg":""}">${goatChange>0?"+":""}${goatChange.toFixed(1)}</b><span>${escapeHtml(goat.changeReason||"")}</span></div><div class="goat-fact-list">${goatFacts}</div><p class="goat-outlook">${escapeHtml(goat.evaluation?.outlook||"")}</p><small class="goat-method-note">${escapeHtml(state.goatMethodology||"")}</small></div>
  <div class="career-evaluation"><div class="career-evaluation-head"><div><span>${escapeHtml(career.seasonRange||"S1–S3")}</span><h4>历季生涯综合评价</h4><b>${escapeHtml(report.careerLabel||"生涯观察中")}</b></div><div class="career-ovr"><strong>${career.overallRating??"—"}</strong><small>OVERALL</small><span>联盟 #${career.overallRank||"—"}</span></div></div><p>${escapeHtml(report.careerSummary||"暂无足够的历季数据。")}</p><div class="career-metric-grid"><div><span>历季参赛</span><b>${career.games||0}场</b></div><div><span>累计积分</span><b class="${scoreClass(career.total||0)}">${fmtScore(career.total||0)}</b></div><div><span>生涯场均</span><b>${fmtAvg(career.average||0)}</b></div><div><span>正分率</span><b>${fmtPct(career.positiveRate||0)}</b></div><div><span>MVP</span><b>${career.mvps||0}次</b></div><div><span>BGR</span><b>${career.bgr||0}</b></div><div><span>荣誉分</span><b>${career.honorPoints||0}</b></div></div><div class="career-analysis-copy"><h5>整体评价</h5><p>${escapeHtml(report.careerEvaluation||"")}</p><h5>长期展望</h5><p>${escapeHtml(report.careerOutlook||"")}</p></div><div class="career-two-col"><section><h5>生涯优势</h5>${(report.careerStrengths||[]).map(x=>`<span>✓ ${escapeHtml(x)}</span>`).join("")||'<span>暂无突出单项</span>'}</section><section><h5>长期隐忧</h5>${(report.careerRisks||[]).map(x=>`<span>• ${escapeHtml(x)}</span>`).join("")||'<span>暂无明显预警</span>'}</section></div><div class="career-season-stack"><h5>历季表现</h5>${seasonCards}</div></div>
  <div class="season-evaluation"><div class="season-evaluation-head"><div><span>${escapeHtml(season.id||"当前赛季")}</span><h4>当前赛季评价</h4></div><b>${escapeHtml(report.seasonLabel||"赛季观察中")}</b></div><p>${escapeHtml(report.seasonSummary||"暂无足够赛季数据。")}</p><div class="season-metric-grid"><div><span>总积分排名</span><b>${season.totalRank?`#${season.totalRank}`:"—"}</b></div><div><span>赛季积分</span><b class="${scoreClass(season.total||0)}">${fmtScore(season.total||0)}</b></div><div><span>场均积分</span><b>${fmtAvg(season.average||0)}</b></div><div><span>正分率</span><b>${fmtPct(season.positiveRate||0)}</b></div><div><span>MVP</span><b>${season.mvps||0}次</b></div><div><span>BGR</span><b>${season.bgr||0}</b></div></div><p class="season-outlook">${escapeHtml(report.seasonOutlook||"")}</p></div>
  <div class="scouting-columns"><section><h4>近期亮点</h4>${(report.strengths||[]).map(x=>`<span>✓ ${escapeHtml(x)}</span>`).join("")}</section><section><h4>潜在风险</h4>${(report.risks||[]).map(x=>`<span>• ${escapeHtml(x)}</span>`).join("")}</section><section><h4>下一场关注</h4><p>${escapeHtml(report.next||"")}</p></section></div><footer>牌手类型：${escapeHtml(r.archetype)} · 生涯定位：${escapeHtml(report.careerLabel||"—")} · 最近5场：${r.recent.map(x=>`${x.score>=0?"+":""}${x.score}`).join(" / ")||"暂无"}</footer></div>`;
}

document.addEventListener("click",e=>{const b=e.target.closest("[data-status-player]");if(!b)return;currentPlayer=b.dataset.statusPlayer;$("#playerSelect").value=currentPlayer;showView("player");});

let recordSection="historical";
let recordType="all";

function formatRecordValue(record,value=record?.value){
  if(value==null||!Number.isFinite(Number(value)))return "—";
  const number=Number(value),unit=record?.unit||"";
  const prefix=record?.forcePlus&&number>0?"+":"";
  if(unit==="分/场")return `${prefix}${number.toFixed(2)} 分/场`;
  if(unit==="%")return `${(number*100).toFixed(2)}%`;
  return `${prefix}${number.toFixed(Number.isInteger(number)?0:2)}${unit?` ${unit}`:""}`;
}
function recordHolderText(record){return record?.holderNames?.length?record.holderNames.join(" / "):"暂无记录";}
function recordSeasonText(record){
  const seasons=[...new Set((record?.holders||[]).map(holder=>holder.season).filter(season=>season&&season!=="CAREER"))];
  return seasons.length?seasons.join(" / "):"—";
}
function recordCurrentHolders(record){return (record?.ranking||[]).filter(row=>row.rank===1);}
function recordFirstHolder(record){return [...recordCurrentHolders(record)].sort((a,b)=>String(a.createdAt||"9999").localeCompare(String(b.createdAt||"9999"))||String(a.playerId).localeCompare(String(b.playerId)))[0]||null;}
function recordLatestCoHolder(record,first){return [...recordCurrentHolders(record)].filter(row=>!first||row.playerId!==first.playerId).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))||String(a.playerId).localeCompare(String(b.playerId)))[0]||null;}
function renderRecords(){
  const center=state.recordCenter||buildRecordCenter(state.players||[],state.matches||[]);
  const records=center.views?.[recordType]?.[recordSection]||[];
  $$('[data-record-section]').forEach(button=>button.classList.toggle('active',button.dataset.recordSection===recordSection));
  $$('[data-record-type]').forEach(button=>button.classList.toggle('active',button.dataset.recordType===recordType));
  const sectionNames={historical:"历史记录",season:"赛季记录",career:"生涯记录"};
  const typeNames={all:"全部比赛",four:"四人局",five:"五人局"};
  $("#recordSummary").innerHTML=`<div><b>${sectionNames[recordSection]}</b><span>${typeNames[recordType]} · 共 ${records.length} 项记录</span></div><small>${escapeHtml(center.methodology||"")}</small>`;
  const head=$("#recordTableHead");
  if(recordSection==="historical")head.innerHTML='<tr><th>记录名称</th><th>记录类型</th><th>保持者</th><th>记录</th><th>创造时间</th><th></th></tr>';
  else if(recordSection==="season")head.innerHTML='<tr><th>记录名称</th><th>保持者</th><th>记录</th><th>所属赛季</th><th></th></tr>';
  else head.innerHTML='<tr><th>记录名称</th><th>保持者</th><th>记录</th><th></th></tr>';
  const rows=records.map(record=>{
    const name=`<td><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(record.rule)}</small></td>`;
    const holder=`<td>${escapeHtml(recordHolderText(record))}</td>`;
    const value=`<td><b class="${record.value!=null&&Number(record.value)<0?"score-neg":"score-pos"}">${escapeHtml(record.displayValue||formatRecordValue(record))}</b></td>`;
    const button=`<td><button type="button" class="btn record-detail-btn" data-record-id="${escapeHtml(record.id)}">查看详情</button></td>`;
    if(recordSection==="historical")return `<tr class="record-row" data-record-id="${escapeHtml(record.id)}">${name}<td><span class="chip">${escapeHtml(record.recordType)}</span></td>${holder}${value}<td>${escapeHtml(record.createdAt||"—")}</td>${button}</tr>`;
    if(recordSection==="season")return `<tr class="record-row" data-record-id="${escapeHtml(record.id)}">${name}${holder}${value}<td><span class="chip gold">${escapeHtml(recordSeasonText(record))}</span></td>${button}</tr>`;
    return `<tr class="record-row" data-record-id="${escapeHtml(record.id)}">${name}${holder}${value}${button}</tr>`;
  }).join("");
  const colspan=recordSection==="historical"?6:recordSection==="season"?5:4;
  $("#recordTableBody").innerHTML=rows||`<tr><td colspan="${colspan}" class="empty">暂无记录。</td></tr>`;
}
function currentRecordById(recordId){
  return state.recordCenter?.views?.[recordType]?.[recordSection]?.find(record=>record.id===recordId)||null;
}
function ensureRecordModal(){
  if($("#recordModalBackdrop"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="record-modal-backdrop" id="recordModalBackdrop" hidden><section class="record-modal" role="dialog" aria-modal="true" aria-labelledby="recordModalTitle"><button type="button" class="record-modal-close" id="recordModalClose" aria-label="关闭">×</button><div id="recordModalBody"></div></section></div>`);
  $("#recordModalBackdrop").addEventListener("mousedown",event=>{if(event.target.id==="recordModalBackdrop")closeRecordModal();});
  $("#recordModalClose").addEventListener("click",closeRecordModal);
}
function closeRecordModal(){const modal=$("#recordModalBackdrop");if(modal){modal.hidden=true;document.body.classList.remove("modal-open");}}
function recordRankingNote(row){
  const parts=[];
  if(row.season&&row.season!=="CAREER")parts.push(row.season);
  if(row.length)parts.push(`连续${row.length}场`);
  if(row.startDate&&row.endDate)parts.push(`${row.startDate} 至 ${row.endDate}`);
  if(row.matchId)parts.push(row.matchId);
  return parts.join(" · ");
}
function renderRecordEvidence(evidence){
  if(!evidence?.length)return '<div class="empty">暂无可展示的比赛明细。</div>';
  let cumulative=0,currentPlayer="";
  return evidence.map(item=>{
    if(item.player!==currentPlayer){currentPlayer=item.player||"";cumulative=0;}
    cumulative+=Number(item.score||0);
    const margin=item.dominanceMargin!=null?` · 领先均分 ${Number(item.dominanceMargin)>=0?"+":""}${Number(item.dominanceMargin).toFixed(2)}`:"";
    const player=item.player?`${escapeHtml(item.player)} · `:"";
    return `<article><div><strong>${player}${escapeHtml(item.season||"")} 第${escapeHtml(item.round??"—")}局 · ${escapeHtml(item.date||"—")}</strong><span>${escapeHtml(item.matchType||"—")} · ${escapeHtml(item.venue||"未填写场地")}${escapeHtml(margin)}</span></div><div><b class="${scoreClass(item.score)}">${fmtScore(item.score)}</b><small>阶段累计 ${fmtScore(cumulative)}</small></div></article>`;
  }).join("");
}
function openRecordModal(recordId){
  const record=currentRecordById(recordId);if(!record)return;
  ensureRecordModal();
  const topFive=(record.ranking||[]).filter(row=>Number(row.rank)<=5);
  const ranking=topFive.map(row=>{
    const tail=recordSection==="historical"?`<time>${escapeHtml(row.createdAt||"—")}</time>`:recordSection==="season"?`<time>${escapeHtml(row.season||"—")}</time>`:"";
    return `<div class="record-ranking-row ${row.rank===1?"is-holder":""} ${recordSection==="career"?"no-time":""}"><span>#${row.rank}</span><div><strong>${escapeHtml(row.player)}</strong><small>${escapeHtml(recordRankingNote(row))}</small></div><b>${escapeHtml(formatRecordValue(record,row.value))}</b>${tail}</div>`;
  }).join("")||'<div class="empty">暂无历史排名。</div>';
  const holders=recordCurrentHolders(record),first=recordFirstHolder(record),latest=recordLatestCoHolder(record,first);
  const typeName=recordType==="all"?"全部比赛":recordType==="four"?"四人局":"五人局";
  let infoGrid="";
  let headerMeta=typeName;
  if(recordSection==="historical"){
    headerMeta=`${record.recordType} · ${typeName}`;
    const recentTie=latest?`${latest.player} · ${latest.createdAt}`:"暂无后来追平";
    infoGrid=`<div><span>保持者</span><b>${escapeHtml(recordHolderText(record))}</b></div><div><span>当前记录</span><b>${escapeHtml(record.displayValue)}</b></div><div><span>首次创造</span><b>${escapeHtml(first?`${first.player} · ${first.createdAt}`:"—")}</b></div><div><span>最近追平</span><b>${escapeHtml(recentTie)}</b></div><div><span>记录类型</span><b>${escapeHtml(record.recordType)}</b></div>`;
  }else if(recordSection==="season"){
    infoGrid=`<div><span>保持者</span><b>${escapeHtml(recordHolderText(record))}</b></div><div><span>当前记录</span><b>${escapeHtml(record.displayValue)}</b></div><div><span>所属赛季</span><b>${escapeHtml(recordSeasonText(record))}</b></div>`;
  }else{
    infoGrid=`<div><span>保持者</span><b>${escapeHtml(recordHolderText(record))}</b></div><div><span>当前记录</span><b>${escapeHtml(record.displayValue)}</b></div>`;
  }
  const holderEvidence=holders.flatMap(item=>item.evidence||[]);
  const evidence=recordSection==="historical"?(record.evidence||[]):(holderEvidence.length?holderEvidence:(record.evidence||[]));
  $("#recordModalBody").innerHTML=`<header class="record-modal-header"><div><p>${escapeHtml(headerMeta)}</p><h2 id="recordModalTitle">${escapeHtml(record.name)}</h2><strong>${escapeHtml(recordHolderText(record))} · ${escapeHtml(record.displayValue)}</strong></div><span class="record-holder-badge">MSL RECORD</span></header><section class="record-modal-section"><h3>记录信息</h3><p>${escapeHtml(record.rule)}</p><div class="record-info-grid record-info-${recordSection}">${infoGrid}</div></section><section class="record-modal-section"><h3>历史排名 · 前5名</h3><div class="record-ranking-list">${ranking}</div></section><section class="record-modal-section"><h3>纪录过程</h3><div class="record-evidence-list">${renderRecordEvidence(evidence)}</div></section><footer class="record-modal-footer">记录由MOAP正式比赛数据实时计算 · 并列第5名完整保留 · 允许并列保持</footer>`;
  $("#recordModalBackdrop").hidden=false;document.body.classList.add("modal-open");
}

document.addEventListener("click",event=>{
  const sectionButton=event.target.closest("[data-record-section]");if(sectionButton){recordSection=sectionButton.dataset.recordSection;renderRecords();return;}
  const typeButton=event.target.closest("[data-record-type]");if(typeButton){recordType=typeButton.dataset.recordType;renderRecords();return;}
  const detailButton=event.target.closest("[data-record-id]");if(detailButton&&currentView==="records"){openRecordModal(detailButton.dataset.recordId);return;}
});

function populateSelects(){
  const opts=state.players.map(p=>`<option value="${p.playerId}">${p.name}</option>`).join("");
  $("#playerSelect").innerHTML=opts; $("#honorPlayer").innerHTML=opts;
  $("#matchPlayer").innerHTML='<option value="all">全部牌手</option>'+opts;
  const seasons=(state.seasons||[]).map(s=>s.id);
  const boardSeasons=seasons.filter(id=>(state.matches||[]).some(m=>m.season===id));
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
  return `<article class="card match-card"><div class="match-meta"><div><strong>${m.season} 第${m.round}局 · ${m.matchType}</strong><div><small>${m.date} · ${escapeHtml(m.venue||"未填写场地")}</small></div></div><span class="chip">${m.matchId}</span></div><div class="match-scores">${played.map(r=>`<span class="score-pill ${r.isMvp?"mvp":""}">${r.player} <b class="${scoreClass(r.score)}">${fmtScore(r.score)}</b>${r.isMvp?" · MVP":""}</span>`).join("")}</div></article>`;
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
  const meta=state.rivalryMeta||{startDate:null,trackedMatches:0,entries:0};
  $("#rivalKpis").innerHTML=[
    ["统计起点",meta.startDate||"等待首场","旧比赛不参与推算"],
    ["已记录比赛",meta.trackedMatches+" 场","仅含精准对位明细"],
    ["有效对位",meta.entries+" 条","每条代表一组实际吃分"],
    ["统计口径","新制精准","行攻击方 / 列承受方"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>8?20:27}px">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  const rows=[...(state.rivalSummary||[])];
  $("#rivalSummaryTable").innerHTML=rows.map(r=>`<tr><td><div class="player-cell"><span class="avatar">${initials(r.player)}</span>${escapeHtml(r.player)}</div></td><td class="score-pos">${fmtScore(r.eat)}</td><td class="score-neg">${r.eaten?"-"+r.eaten:"0"}</td><td class="${scoreClass(r.total)}">${fmtScore(r.total)}</td></tr>`).join("");
  if(!meta.entries){
    $("#rivalRanking").innerHTML='<div class="empty">录入带精准对位明细的比赛后，这里会自动生成排名。</div>';
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
  $("#rivalDetail").innerHTML=`<div class="player-head"><span class="avatar">${initials(a)}</span><div><h3 style="margin:0">${escapeHtml(a)} vs ${escapeHtml(b)}</h3><div class="muted" style="margin-top:5px">精准对位统计</div></div></div>
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
  const rows=[...(state.goat||[])].sort((a,b)=>a.rank-b.rank).slice(0,limit);
  $(sel).innerHTML=rows.map(r=>{
    const b=r.breakdown||{};
    const change=Number(r.indexChange||0);
    const changeText=change>0?`+${change.toFixed(1)}`:change<0?change.toFixed(1):"—";
    return `<div class="goat-row goat-row-v2"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div><div class="goat-row-title"><strong>${escapeHtml(r.player)}</strong><span class="muted">${escapeHtml(r.evaluation?.label||"")}</span></div><div class="goat-breakdown-mini"><span>荣誉 ${Number(b.honors?.score||0).toFixed(1)}</span><span>生涯 ${Number(b.career?.score||0).toFixed(1)}</span><span>纪录 ${Number(b.records?.score||0).toFixed(1)}</span><span>持续 ${Number(b.longevity?.score||0).toFixed(1)}</span></div><div class="bar"><i style="width:${Math.max(3,Math.min(100,Number(r.goatIndex||0)))}%"></i></div></div><div class="goat-score-v2"><b>${Number(r.goatIndex||0).toFixed(1)}</b><small class="${change>0?"score-pos":change<0?"score-neg":""}">${changeText}</small></div></div>`;
  }).join("")||'<div class="empty">暂无GOAT评分</div>';
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
  const pid=$("#honorPlayer").value||currentPlayer, p=state.profiles[pid];
  $("#honorStats").innerHTML=[
    ["荣誉排名","#"+p.honorRank],["荣誉总数",p.honorCount],["A级荣誉",p.gradeA],["B级荣誉",p.gradeB],["荣誉积分",p.honorPoints],["GOAT指数",Number(state.goat.find(x=>x.playerId===pid)?.goatIndex||0).toFixed(1)]
  ].map(x=>`<div class="mini-stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  renderHonorSeasonBoard();
}
$("#honorPlayer").addEventListener("change",renderHonors);
$("#honorBoardSeason")?.addEventListener("change",renderHonorSeasonBoard);

function renderSystem(){
  $("#systemKpis").innerHTML=[
    ["当前版本",state.version.version,"Official Feature Release"],["认证状态",state.version.certification,state.version.formulaIntegrity],
    ["当前GOAT",state.version.currentGoat,"GOAT指数 "+Number(state.version.goatIndex||0).toFixed(1)],["数据规模",state.matches.length+" 场",state.meta.results+" 条原始成绩"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>14?20:27}px">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  $("#healthList").innerHTML=(state.healthChecks||[]).map(h=>{
    const details=(h.details||[]).length?`<div class="health-details">${h.details.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`:"";
    return `<div class="health-item ${h.result==="PASS"?"health-pass":"health-fail"}"><div><strong>${escapeHtml(h.item)}</strong><div class="muted health-evidence">${escapeHtml(h.id)} · ${escapeHtml(h.evidence||"")} · 异常 ${Number(h.found||0)}</div>${details}</div><span class="${h.result==="PASS"?"status-pass":"status-fail"}">${escapeHtml(h.result)}</span></div>`;
  }).join("");
  const v=state.version;
  $("#versionInfo").innerHTML=[
    ["发布日期",v.releaseDate],["发布阶段",v.releaseStage],["当前状态",v.currentStatus],["年度最有价值牌手",v.seasonMvp],
    ["GOAT模型",state.goatMethodology||"四维数据模型"],["v1.8.1更新",v.note]
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
