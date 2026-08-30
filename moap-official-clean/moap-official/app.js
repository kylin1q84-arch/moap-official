import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/+esm";
import { CERTIFIED_SNAPSHOT } from "./certified-data.js";
import { HONOR_CATALOG } from "./honor-details.js";
import { calculateHonorSystem, buildMslStatusCenter } from "./analytics-engine.js";
import { buildRecordCenter, buildDataLeaderboard } from "./records-engine.js";
import { buildGoatSystem } from "./goat-engine.js";
import { validateMoapData } from "./data-validation.js";
import { MOAP_CONFIG } from "./config.js";
import {
  initAnimationSystem,
  prefersReducedMotion,
  transitionView,
  animateRecordCenterEntry,
  transitionRecordContent,
  animateNumbers,
  animateRecordDetails,
  animatePlayerCenterEntry,
  animatePlayerSeasonNumbers,
  transitionPlayerProfile,
  transitionPlayerData,
  animateHonorCenterEntry,
  transitionHonorContent,
  animateHonorDetails,
  animateHonorCards
} from "./animations.js";
let state = JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT));
clearLegacyRivalState(state);
let currentView = "overview";
let currentPlayer = "P001";
let matchLimit = 15;
let monthlyReportMonth = "";
let monthlyReportMonthTouched = false;
let recordSection = "single";
let recordType = "all";
let recordSeason = "all";
let dataSeason = "all";
let dataMatchType = "all";
let dataMetric = "points";
let playerSeasonMatchType = "all";
let playerSeasonMetric = "points";
let rivalMode = "cumulative";
let selectedRivalPair = null;
const selectedMatchPlayers = new Set();

const NAV = [
  ["overview","联赛总览"],
  ["records","记录中心"],
  ["status","状态中心"],
  ["player","个人中心"],
  ["matches","比赛中心"],
  ["rival","对位中心"],
  ["honors","荣誉中心"],
  ["system","系统审计"],
  ["entry","录入比赛"]
];


const VENUE_OVERRIDES = {
  MSL0026: "拾月金秋茶馆（浦南一里店）",
  MSL0069: "七囍茶室（厦门站店）"
};
function normalizedVenue(matchId, venue){ return VENUE_OVERRIDES[String(matchId||"")] || venue || ""; }

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
  target.matches.forEach(match=>{match.venue=normalizedVenue(match.matchId,match.venue);});
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
  target.version={...(target.version||{}),version:"v2.3.0 Matchup & Honor Detail Upgrade",releaseStage:"Official Feature Release",releaseDate:"2026-08-24",currentStatus:"exact multi-player filtering, matchup averages, integrated honor evidence, compact player profile and latest-month reporting",formulaIntegrity:validation.healthScore===100?"PASS":"CHECK WARNINGS",certification:"LIVE DATA VERIFIED",currentGoat:top?.player||"—",goatIndex:top?.goatIndex||0,honorKing:honorTop?`${honorTop.name} · ${stats[honorTop.playerId].honorPoints}`:"—",seasonMvp:awardWinners("H003"),note:"比赛中心升级完全匹配多选；对位中心新增累计/场均并整合汇总；荣誉详情支持逐牌手逐指标追溯；个人中心荣誉并入档案首页；月报默认最新比赛月份。"};
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
  target.rivalryMeta={startDate:null,trackedMatches:0,entries:0,mode:"DIRECTIONAL_CELL_MATRIX"};
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
    matchId:m.id,season:m.season_id,round:m.round,date:m.match_date,matchType:m.match_type,venue:normalizedVenue(m.id,m.venue),isHomeVenue:!!m.is_home_venue,notes:m.notes||"",
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

  // 精准对位采用“方向格独立记录”：
  // A→B 与 B→A 是两条独立数据，不要求互为相反数，也绝不通过一侧反推另一侧。
  // points 可为正、负或 0；每名牌手一行所有方向格的合计必须等于该场比赛总分。
  const matchupRows=(db.matchups||[]).map(x=>({
    id:x.id,matchId:x.match_id,fromPlayerId:x.from_player_id,toPlayerId:x.to_player_id,
    points:Number(x.points),createdAt:x.created_at||null
  })).filter(x=>Number.isFinite(x.points)&&nameBy[x.fromPlayerId]&&nameBy[x.toPlayerId]&&x.fromPlayerId!==x.toPlayerId);
  const matchById=Object.fromEntries(matches.map(m=>[m.matchId,m]));
  const rivalNet={},rivalHistory={};
  players.forEach(a=>{rivalNet[a.name]={};rivalHistory[a.name]={};players.forEach(b=>{
    rivalNet[a.name][b.name]=a.playerId===b.playerId?null:0;
    rivalHistory[a.name][b.name]=[];
  });});
  matchupRows.forEach(t=>{
    const from=nameBy[t.fromPlayerId],to=nameBy[t.toPlayerId],points=Number(t.points),m=matchById[t.matchId];
    rivalNet[from][to]+=points;
    const base={matchId:t.matchId,date:m?.date||"—",season:m?.season||"—",round:m?.round??"—",matchType:m?.matchType||"—",venue:m?.venue||"未填写场地",points};
    rivalHistory[from][to].push({...base,net:points});
  });
  Object.values(rivalHistory).forEach(row=>Object.values(row).forEach(items=>items.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.matchId).localeCompare(String(a.matchId)))));
  const rivalSummary=players.map(p=>{
    const rows=matchupRows.filter(t=>t.fromPlayerId===p.playerId);
    const eat=rows.filter(t=>Number(t.points)>0).reduce((sum,t)=>sum+Number(t.points),0);
    const eaten=rows.filter(t=>Number(t.points)<0).reduce((sum,t)=>sum+Math.abs(Number(t.points)),0);
    const total=rows.reduce((sum,t)=>sum+Number(t.points),0);
    return {playerId:p.playerId,player:p.name,eat,eaten,total};
  });
  const trackedMatchIds=[...new Set(matchupRows.map(x=>x.matchId))];
  const trackedDates=trackedMatchIds.map(id=>matchById[id]?.date).filter(Boolean).sort();
  const rivalryMeta={
    startDate:trackedDates[0]||null,
    trackedMatches:trackedMatchIds.length,
    entries:matchupRows.length,
    nonZeroEntries:matchupRows.filter(x=>Number(x.points)!==0).length,
    mode:"DIRECTIONAL_CELL_MATRIX"
  };

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
  const version={...CERTIFIED_SNAPSHOT.version,version:"v2.3.0 Matchup & Honor Detail Upgrade",releaseStage:"Official Feature Release",releaseDate:"2026-08-24",currentStatus:"exact multi-player filtering, matchup averages, integrated honor evidence, compact player profile and latest-month reporting",formulaIntegrity:healthScore===100?"PASS":"CHECK WARNINGS",certification:"LIVE DATA VERIFIED",note:"比赛中心升级完全匹配多选；对位中心新增累计/场均并整合汇总；荣誉详情支持逐牌手逐指标追溯；个人中心荣誉并入档案首页；月报默认最新比赛月份。",currentGoat:topGoat?.player||"—",goatIndex:topGoat?.goatIndex||0,honorKing:topHonor?`${topHonor.player} · ${topHonor.honorPoints}`:"—",seasonMvp:awardWinners("H003"),scoringKing:"已由记录中心替代"};
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
const matchupPlayerNameHtml = name => {
  const text=String(name??"");
  const compact=[...text].length===2?" two-char":"";
  return `<span class="matchup-player-name${compact}">${escapeHtml(text)}</span>`;
};
const PLAYER_PORTRAITS={P001:"luohaihong.png",P002:"chenfeng.png",P003:"chenyusheng.png",P004:"wutaojun.png",P005:"chenrongsheng.png"};
function playerPortraitHtml(player){
  const file=PLAYER_PORTRAITS[player?.playerId]||`${player?.playerId||"player"}.png`;
  return `<div class="player-portrait-shell"><img class="player-portrait-img" src="/assets/players/${escapeHtml(file)}" alt="${escapeHtml(player?.name||"牌手")}头像" onload="this.parentElement.classList.add('has-image')" onerror="this.remove()"><div class="player-portrait-placeholder"><span>${escapeHtml(initials(player?.name||"牌"))}</span><small>头像预留</small></div></div>`;
}
function matchOrdinal(matchId){return Number(String(matchId||"").replace(/\D/g,""))||0;}
function latestActualSeason(){return [...new Set((state.matches||[]).map(m=>m.season).filter(Boolean))].sort((a,b)=>Number(String(a).replace(/\D/g,""))-Number(String(b).replace(/\D/g,""))).at(-1)||"S3";}


function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2200);
}

function initNav(){
  const desktop=$("#sidebarNav"), mobile=$("#mobileNav");
  const visibleNav = NAV.filter(([id])=>id!=="entry" || currentRole==="admin");
  desktop.innerHTML = visibleNav.map(([id,label])=>`<button type="button" class="nav-btn ${id==="overview"?"active":""}" data-nav="${id}">${label}</button>`).join("");
  mobile.innerHTML = desktop.innerHTML;
  $$('[data-nav]').forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.nav)));
}

function renderViewContent(id){
  if(id==="overview") renderOverview();
  if(id==="records") renderRecords();
  if(id==="status") renderStatus();
  if(id==="player") renderPlayer();
  if(id==="matches") renderMatches(true);
  if(id==="rival") renderRival();
  if(id==="honors") renderHonors();
  if(id==="system") renderSystem();
}

function showView(id,{immediate=false}={}){
  if(id==="entry"&&currentRole!=="admin"){toast("当前账号为只读成员");id="overview";}
  const outgoing=$(".view.active"),incoming=$(`.view[data-view="${id}"]`);
  const swap=()=>{
    currentView=id;
    $$(".view").forEach(v=>v.classList.toggle("active",v.dataset.view===id));
    $$("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));
    if(!immediate)window.scrollTo({top:0,behavior:prefersReducedMotion()?"auto":"smooth"});
    renderViewContent(id);
    animateNumbers(incoming);
    if(id==="records")animateRecordCenterEntry(incoming);
    if(id==="player")animatePlayerCenterEntry(incoming);
    if(id==="honors")animateHonorCenterEntry(incoming);
  };
  transitionView({outgoing,incoming,swap,immediate});
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

function availableReportMonths(){
  return [...new Set((state.matches||[]).map(m=>String(m.date||"").slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)))].sort().reverse();
}
function monthLabel(month){
  if(!/^\d{4}-\d{2}$/.test(String(month)))return month||"—";
  const [y,m]=month.split("-");return `${y}年${Number(m)}月`;
}
function normalizeRows(rows,getter){
  const values=rows.map(getter).map(Number),lo=Math.min(...values),hi=Math.max(...values);
  return row=>Math.abs(hi-lo)<1e-9?(Math.abs(hi)<1e-9?0:.5):(Number(getter(row))-lo)/(hi-lo);
}
function monthlyPlayerStats(month){
  const matches=(state.matches||[]).filter(m=>String(m.date||"").startsWith(month));
  return (state.players||[]).map(p=>{
    const entries=[];
    for(const match of matches){
      const result=(match.results||[]).find(r=>r.playerId===p.playerId&&!r.isAbsent&&r.score!=null);if(!result)continue;
      const opponents=(match.results||[]).filter(r=>r.playerId!==p.playerId&&!r.isAbsent&&r.score!=null);
      const opponentAverage=opponents.length?opponents.reduce((n,r)=>n+Number(r.score),0)/opponents.length:0;
      const score=Number(result.score),dominance=score-opponentAverage;
      entries.push({match,result,score,isMvp:!!result.isMvp,isPositive:score>=0,isExplosion:score>=50,bgr:bgrValue(score),isSolo:score>=0&&opponents.length>0&&opponents.every(r=>Number(r.score)<0),dominance});
    }
    if(!entries.length)return null;
    const mvps=entries.filter(x=>x.isMvp),positive=entries.filter(x=>x.isPositive),explosions=entries.filter(x=>x.isExplosion),solo=entries.filter(x=>x.isSolo);
    return {playerId:p.playerId,player:p.name,games:entries.length,total:entries.reduce((n,x)=>n+x.score,0),average:entries.reduce((n,x)=>n+x.score,0)/entries.length,mvpCount:mvps.length,mvpPoints:mvps.reduce((n,x)=>n+x.score,0),positiveCount:positive.length,positivePoints:positive.reduce((n,x)=>n+x.score,0),positiveRate:positive.length/entries.length,explosionCount:explosions.length,explosionPoints:explosions.reduce((n,x)=>n+x.score,0),bgr:explosions.reduce((n,x)=>n+x.bgr,0),soloCount:solo.length,soloPoints:solo.reduce((n,x)=>n+x.score,0),best:Math.max(...entries.map(x=>x.score)),worst:Math.min(...entries.map(x=>x.score)),maxDominance:Math.max(...entries.map(x=>x.dominance)),entries};
  }).filter(Boolean);
}
function monthlyBestPlayer(rows){
  if(!rows.length)return null;
  const nTotal=normalizeRows(rows,r=>r.total),nAvg=normalizeRows(rows,r=>r.average),nMvpCount=normalizeRows(rows,r=>r.mvpCount),nMvpPoints=normalizeRows(rows,r=>r.mvpPoints),nPosCount=normalizeRows(rows,r=>r.positiveCount),nPosRate=normalizeRows(rows,r=>r.positiveRate),nExplosion=normalizeRows(rows,r=>r.explosionCount),nBgr=normalizeRows(rows,r=>r.bgr),nSolo=normalizeRows(rows,r=>r.soloCount),nSoloPoints=normalizeRows(rows,r=>r.soloPoints);
  const rated=rows.map(r=>{
    const mvp=nMvpCount(r)*.6+nMvpPoints(r)*.4;
    const positive=nPosCount(r)*.6+nPosRate(r)*.4;
    const explosion=nExplosion(r)*.5+nBgr(r)*.5;
    const solo=nSolo(r)*.6+nSoloPoints(r)*.4;
    const score=(nTotal(r)*.30+nAvg(r)*.15+mvp*.20+positive*.20+explosion*.10+solo*.05)*100;
    return {...r,monthlyScore:Number(score.toFixed(1))};
  }).sort((a,b)=>b.monthlyScore-a.monthlyScore||b.total-a.total||b.average-a.average||String(a.playerId).localeCompare(String(b.playerId)));
  return rated[0];
}
function monthlyBestStage(month,predicate,label){
  const matches=(state.matches||[]).filter(m=>String(m.date||"").startsWith(month));
  let best=null;
  for(const p of state.players||[]){
    let current=[];const stages=[];const close=()=>{if(current.length)stages.push(current);current=[];};
    for(const match of matches){
      const r=(match.results||[]).find(x=>x.playerId===p.playerId);if(!r||r.isAbsent||r.score==null)continue;
      const item={match,score:Number(r.score),isMvp:!!r.isMvp};if(predicate(item))current.push(item);else close();
    }close();
    for(const stage of stages){const points=stage.reduce((n,x)=>n+x.score,0);const candidate={player:p.name,length:stage.length,points,start:stage[0].match.date,end:stage.at(-1).match.date,label};if(!best||candidate.length>best.length||(candidate.length===best.length&&candidate.points>best.points))best=candidate;}
  }
  return best;
}
function monthlyRecordEvents(month){
  const ordered=[...(state.matches||[])];const events=[];
  for(let i=0;i<ordered.length;i++){
    const match=ordered[i];if(!String(match.date||"").startsWith(month))continue;
    const before=buildRecordCenter(state.players||[],ordered.slice(0,i)).views?.all?.all||{};
    const after=buildRecordCenter(state.players||[],ordered.slice(0,i+1)).views?.all?.all||{};
    for(const section of ["single","continuous"]){
      for(const record of after[section]||[]){
        const touched=(record.ranking||[]).filter(row=>row.rank===1&&(row.evidence||[]).some(e=>e.matchId===match.matchId));if(!touched.length)continue;
        const prev=(before[section]||[]).find(x=>x.id===record.id);const cv=record.value==null?null:Number(record.value),pv=prev?.value==null?null:Number(prev.value);if(cv==null)continue;
        const improved=pv==null||(record.direction==="asc"?cv<pv-1e-9:cv>pv+1e-9);const tied=pv!=null&&Math.abs(cv-pv)<=1e-9&&touched.some(row=>!(prev?.holderNames||[]).includes(row.player));if(!improved&&!tied)continue;
        events.push({date:match.date,matchId:match.matchId,type:pv==null?"新创造":improved?"打破":"追平",name:record.name,players:[...new Set(touched.map(x=>x.player))].join(" / "),value:record.displayValue});
      }
    }
  }
  return events;
}
function latestRecapHtml(){
  const recap=buildDetailedLatestRecap();
  if(!recap)return '<div class="empty">暂无比赛可生成战报</div>';
  return `<article class="ai-recap ai-recap-detailed"><div class="ai-recap-head"><div><span class="chip gold">MSL 赛后简报</span><h3>${escapeHtml(recap.title)}</h3><small>${escapeHtml(recap.meta)}</small></div></div><p>${escapeHtml(recap.body)}</p><div class="recap-bullets">${recap.bullets.map(x=>`<div>${escapeHtml(x)}</div>`).join("")}</div>${recap.recordNotes.length?`<div class="recap-records"><strong>🏆 纪录动态</strong>${recap.recordNotes.map(x=>`<span>${escapeHtml(x)}</span>`).join("")}</div>`:""}<div class="match-scores">${recap.scores.map(x=>`<span class="score-pill ${x.isMvp?"mvp":""}">${escapeHtml(x.player)} <b class="${scoreClass(x.score)}">${fmtScore(x.score)}</b>${x.isMvp?" · MVP":""}</span>`).join("")}</div></article>`;
}
function renderMonthlyReport(){
  const select=$("#monthlyReportMonth"),months=availableReportMonths();if(!select)return;
  if(!monthlyReportMonth||!months.includes(monthlyReportMonth)||(!monthlyReportMonthTouched&&monthlyReportMonth!==months[0]))monthlyReportMonth=months[0]||"";
  select.innerHTML=months.map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join("")||'<option value="">暂无月份</option>';select.value=monthlyReportMonth;
  const matches=(state.matches||[]).filter(m=>String(m.date||"").startsWith(monthlyReportMonth));const rows=monthlyPlayerStats(monthlyReportMonth),best=monthlyBestPlayer(rows);const holder=$("#monthlyReport");
  if(!matches.length||!rows.length){holder.innerHTML='<div class="empty">该月份暂无正式比赛。</div>';return;}
  const firstIndex=(state.matches||[]).findIndex(m=>m.matchId===matches[0].matchId),lastIndex=(state.matches||[]).findIndex(m=>m.matchId===matches.at(-1).matchId),season=matches.at(-1).season;
  const beforeRanks=seasonRankSnapshot((state.matches||[]).slice(0,Math.max(0,firstIndex)),season),afterRanks=seasonRankSnapshot((state.matches||[]).slice(0,lastIndex+1),season);
  const ranked=[...rows].sort((a,b)=>b.total-a.total||b.average-a.average||String(a.playerId).localeCompare(String(b.playerId))).map((r,i)=>({...r,monthRank:i+1}));
  const topSingle=rows.flatMap(r=>r.entries.map(e=>({...e,player:r.player}))).sort((a,b)=>b.score-a.score)[0];const lowSingle=rows.flatMap(r=>r.entries.map(e=>({...e,player:r.player}))).sort((a,b)=>a.score-b.score)[0];const maxLead=rows.flatMap(r=>r.entries.map(e=>({...e,player:r.player}))).sort((a,b)=>b.dominance-a.dominance)[0];
  const bestPositive=monthlyBestStage(monthlyReportMonth,x=>x.score>=0,"连续正分"),bestMvp=monthlyBestStage(monthlyReportMonth,x=>x.isMvp,"连续MVP"),bestExplosion=monthlyBestStage(monthlyReportMonth,x=>x.score>=50,"连续爆发");const recordEvents=monthlyRecordEvents(monthlyReportMonth);
  const standingRows=ranked.map(r=>{const before=beforeRanks.find(x=>x.playerId===r.playerId),after=afterRanks.find(x=>x.playerId===r.playerId);let change="—";if(after&&!before)change=`新入榜 #${after.rank}`;else if(after&&before)change=before.rank===after.rank?`#${after.rank} —`:`#${before.rank} → #${after.rank} ${after.rank<before.rank?"↑":"↓"}${Math.abs(after.rank-before.rank)}`;return `<tr><td><span class="rank ${r.monthRank===1?"top":""}">${r.monthRank}</span></td><td>${escapeHtml(r.player)}</td><td>${r.games}</td><td class="${scoreClass(r.total)}">${fmtScore(r.total)}</td><td>${fmtAvg(r.average)}</td><td>${escapeHtml(change)}</td></tr>`;}).join("");
  const mvpText=[...rows].sort((a,b)=>b.mvpCount-a.mvpCount||b.mvpPoints-a.mvpPoints).map(r=>`${r.player} ${r.mvpCount}次 / ${fmtScore(r.mvpPoints)}`).join("；");
  const positiveText=[...rows].sort((a,b)=>b.positiveCount-a.positiveCount||b.positiveRate-a.positiveRate).map(r=>`${r.player} ${r.positiveCount}场(${fmtPct(r.positiveRate)})`).join("；");
  const explosionText=[...rows].sort((a,b)=>b.explosionCount-a.explosionCount||b.bgr-a.bgr).map(r=>`${r.player} ${r.explosionCount}场 / BGR ${r.bgr}`).join("；");
  const soloText=[...rows].sort((a,b)=>b.soloCount-a.soloCount||b.soloPoints-a.soloPoints).map(r=>`${r.player} ${r.soloCount}次 / ${fmtScore(r.soloPoints)}`).join("；");
  const stageText=[bestPositive,bestMvp,bestExplosion].filter(Boolean).map(x=>`${x.player} ${x.label}${x.length}场，阶段${fmtScore(x.points)} (${x.start}→${x.end})`).join("；")||"本月暂无连续表现记录";
  const now=new Date(),currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,bestTitle=monthlyReportMonth===currentMonth?"当前月最佳牌手":"月最佳牌手";
  holder.innerHTML=`<div class="monthly-hero"><div><span>${escapeHtml(monthLabel(monthlyReportMonth))}</span><h4>${bestTitle} · ${escapeHtml(best?.player||"—")}</h4><p>月度综合评分 ${best?.monthlyScore??"—"} · 仅用于月报，不计入官方荣誉</p></div><b>${best?.monthlyScore??"—"}</b></div><div class="monthly-kpis"><div><span>本月比赛</span><b>${matches.length}场</b></div><div><span>最高单场</span><b class="${scoreClass(topSingle?.score)}">${escapeHtml(topSingle?.player||"—")} ${fmtScore(topSingle?.score)}</b></div><div><span>最低单场</span><b class="${scoreClass(lowSingle?.score)}">${escapeHtml(lowSingle?.player||"—")} ${fmtScore(lowSingle?.score)}</b></div><div><span>最大领先分差</span><b>${escapeHtml(maxLead?.player||"—")} ${maxLead?`${Number(maxLead.dominance)>=0?"+":""}${Number(maxLead.dominance).toFixed(1)}`:"—"}</b></div></div><div class="monthly-section"><h4>本月积分及赛季排名变化</h4><div class="table-scroll"><table><thead><tr><th>月排名</th><th>牌手</th><th>场次</th><th>本月积分</th><th>本月场均</th><th>${escapeHtml(season)}排名变化</th></tr></thead><tbody>${standingRows}</tbody></table></div></div><div class="monthly-grid"><article><h4>MVP情况</h4><p>${escapeHtml(mvpText)}</p></article><article><h4>正分情况</h4><p>${escapeHtml(positiveText)}</p></article><article><h4>爆发情况</h4><p>${escapeHtml(explosionText)}</p></article><article><h4>独赢</h4><p>${escapeHtml(soloText)}</p></article></div><div class="monthly-section"><h4>本月最佳连续表现</h4><p>${escapeHtml(stageText)}</p></div><div class="monthly-section"><h4>本月新创造 / 打破的纪录</h4>${recordEvents.length?`<div class="monthly-record-list">${recordEvents.map(e=>`<span><b>${escapeHtml(e.type)}</b> · ${escapeHtml(e.players)} · ${escapeHtml(e.name)} ${escapeHtml(e.value)} <small>${escapeHtml(e.date)} · ${escapeHtml(e.matchId)}</small></span>`).join("")}</div>`:'<p class="muted">本月没有新增、打破或追平当前有效纪录。</p>'}</div><small class="monthly-method">月最佳牌手评分：本月总积分30% + 本月场均积分15% + 本月MVP表现20% + 本月正分表现20% + 本月爆发表现10% + 本月独赢表现5%。</small>`;
}
function renderOverview(){
  const goat=[...(state.goat||[])].sort((a,b)=>a.rank-b.rank)[0]||{};$("#goatName").textContent=goat.player||"—";
  $("#overviewKpis").innerHTML=[["正式比赛",state.matches.length+" 场","S1至今完整记录"],["当前赛季",latestActualSeason(),"自动识别最新赛季"],["当前GOAT",goat.player||"—",Number(goat.goatIndex||0).toFixed(1)+" 指数"]].map((x,i)=>`<div class="card kpi ${i===2?"overview-goat-kpi":""}"><div class="kpi-label">${x[0]}</div><div class="kpi-value">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  $("#latestAiRecap").innerHTML=latestRecapHtml();renderMonthlyReport();
}
$("#monthlyReportMonth")?.addEventListener("change",e=>{monthlyReportMonthTouched=true;monthlyReportMonth=e.target.value;renderMonthlyReport();animateNumbers($("#monthlyReport"));});

function movementText(r){return r.movement>0?`↑${r.movement}`:r.movement<0?`↓${Math.abs(r.movement)}`:"—";}
function seasonRankSnapshot(matches,season){
  const rows=(state.players||[]).map(p=>{
    const entries=matches.filter(m=>m.season===season).map(m=>m.results.find(r=>r.playerId===p.playerId&&!r.isAbsent&&r.score!=null)).filter(Boolean);
    return {playerId:p.playerId,player:p.name,total:entries.reduce((n,r)=>n+Number(r.score),0),games:entries.length};
  }).filter(x=>x.games>0).sort((a,b)=>b.total-a.total||String(a.playerId).localeCompare(String(b.playerId)));
  let rank=0,prev=null;return rows.map((r,i)=>{if(i===0||r.total!==prev)rank=i+1;prev=r.total;return {...r,rank};});
}
function latestRecordHighlights(latest){
  const ordered=[...(state.matches||[])];if(ordered.length<2)return [];
  const previousCenter=buildRecordCenter(state.players||[],ordered.slice(0,-1));
  const currentCenter=state.recordCenter||buildRecordCenter(state.players||[],ordered);
  const notes=[];
  const sections=["single","continuous"];
  for(const section of sections){
    const currentRecords=currentCenter.views?.all?.all?.[section]||[],previousRecords=previousCenter.views?.all?.all?.[section]||[];
    for(const record of currentRecords){
      const topRows=(record.ranking||[]).filter(x=>x.rank===1);
      const touched=topRows.filter(row=>(row.evidence||[]).some(e=>e.matchId===latest.matchId));
      if(!touched.length)continue;
      const previous=previousRecords.find(x=>x.id===record.id),currentValue=Number(record.value),previousValue=previous?.value==null?null:Number(previous.value);
      const improved=previousValue==null||(record.direction==="asc"?currentValue<previousValue-1e-9:currentValue>previousValue+1e-9);
      const tied=previousValue!=null&&Math.abs(currentValue-previousValue)<=1e-9&&touched.some(row=>!(previous?.holderNames||[]).includes(row.player));
      if(!improved&&!tied)continue;
      const who=[...new Set(touched.map(x=>x.player))].join(" / ");
      notes.push(`${who}${improved?"刷新":"追平"}${record.name}：${record.displayValue}`);
    }
  }
  return notes.slice(0,5);
}
function buildDetailedLatestRecap(){
  const latest=(state.matches||[]).at(-1);if(!latest)return null;
  const pp=(latest.results||[]).filter(r=>!r.isAbsent&&r.score!=null).sort((a,b)=>Number(b.score)-Number(a.score));
  if(!pp.length)return null;
  const top=pp[0],second=pp[1],bottom=pp.at(-1),season=latest.season,mvpRows=pp.filter(x=>x.isMvp);
  const opponentsFor=result=>pp.filter(x=>x.playerId!==result.playerId);
  const events=pp.map(r=>{const opponents=opponentsFor(r),avg=opponents.length?opponents.reduce((n,x)=>n+Number(x.score),0)/opponents.length:0;return {...r,opponentAverage:avg,dominance:Number(r.score)-avg,isSolo:Number(r.score)>=0&&opponents.every(x=>Number(x.score)<0),isBigWin:Number(r.score)-avg>=100,bgr:bgrValue(r.score)};});
  const bigStages=events.filter(x=>Number(x.score)>=50),solo=events.filter(x=>x.isSolo),bigWins=events.filter(x=>x.isBigWin);
  const currentRanks=seasonRankSnapshot(state.matches,season),previousRanks=seasonRankSnapshot(state.matches.slice(0,-1),season);
  const rankChanges=currentRanks.map(r=>{const prev=previousRanks.find(x=>x.playerId===r.playerId);return prev&&prev.rank!==r.rank?`${r.player} ${prev.rank}→${r.rank}`:null;}).filter(Boolean);
  const recordNotes=latestRecordHighlights(latest);
  const matchupRows=(state.matchups||[]).filter(x=>x.matchId===latest.matchId);
  let matchupNote="";
  if(matchOrdinal(latest.matchId)>=67&&matchupRows.length){
    const byId=Object.fromEntries((state.players||[]).map(p=>[p.playerId,p.name]));
    const high=[...matchupRows].sort((a,b)=>Number(b.points)-Number(a.points))[0],low=[...matchupRows].sort((a,b)=>Number(a.points)-Number(b.points))[0];
    const bits=[];
    if(high&&Number(high.points)>0)bits.push(`最大单向吃分：${byId[high.fromPlayerId]}→${byId[high.toPlayerId]} ${fmtScore(high.points)}`);
    if(low&&Number(low.points)<0)bits.push(`最大单向被吃：${byId[low.fromPlayerId]}→${byId[low.toPlayerId]} ${fmtScore(low.points)}`);
    matchupNote=bits.join("；");
  }
  const bullets=[];
  bullets.push(`本场MVP：${(mvpRows.length?mvpRows:[top]).map(x=>`${x.player} ${fmtScore(x.score)}`).join(" / ")}；最高分领先第二名${top&&second?Number(top.score)-Number(second.score):0}分，全场首尾分差${top&&bottom?Number(top.score)-Number(bottom.score):0}分。`);
  bullets.push(`本场${pp.filter(x=>Number(x.score)>=0).length}人正分、${pp.filter(x=>Number(x.score)<0).length}人负分${bigStages.length?`；爆发场次：${bigStages.map(x=>`${x.player} ${fmtScore(x.score)}(BGR ${x.bgr})`).join("、")}`:"；无爆发场次"}。`);
  if(solo.length)bullets.push(`独赢：${solo.map(x=>`${x.player} ${fmtScore(x.score)}`).join("、")}。`);
  if(bigWins.length)bullets.push(`大胜：${bigWins.map(x=>`${x.player}，统治分差 +${x.dominance.toFixed(1)}`).join("；")}。`);
  if(rankChanges.length)bullets.push(`赛季积分榜发生变化：${rankChanges.join("；")}。`);else bullets.push(`本场结束后${season}积分榜名次未发生变化。`);
  if(matchupNote)bullets.push(`精准对位：${matchupNote}。`);
  return {title:`${(mvpRows.length?mvpRows:[top]).map(x=>x.player).join(" / ")}拿下${latest.season}第${latest.round}局MVP`,meta:`${latest.matchId} · ${latest.date} · ${latest.matchType} · ${latest.venue||"未填写场地"}`,body:`${top.player}以${fmtScore(top.score)}领跑本场，${bottom.player}以${fmtScore(bottom.score)}收官。以下为本轮完整数据摘要。`,bullets,recordNotes,scores:pp.map(x=>({player:x.player,score:Number(x.score),isMvp:!!x.isMvp}))};
}

function renderStatus(){
  const center=state.statusCenter||{rankings:[],storylines:[],methodology:"",gameRecap:null},rows=center.rankings||[];
  const hot=rows[0],cold=rows.at(-1),up=[...rows].sort((a,b)=>b.movement-a.movement||b.indexChange-a.indexChange)[0],mvp=rows.find(r=>r.latest?.isMvp)||rows[0];
  $("#statusKpis").innerHTML=[
    ["当前最火热",hot?.player||"—",hot?`${hot.powerIndex} 状态指数`:"暂无"],
    ["当前最低迷",cold?.player||"—",cold?`${cold.powerIndex} 状态指数`:"暂无"],
    ["行情上升",up?.player||"—",up?`${movementText(up)} · 指数 ${up.indexChange>=0?"+":""}${up.indexChange}`:"暂无"],
    ["最新MVP",mvp?.latest?.isMvp?mvp.player:"—",mvp?.latest?`${mvp.latest.season} 第${mvp.latest.round}局`:"暂无"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>8?22:28}px">${escapeHtml(x[1])}</div><div class="kpi-sub">${escapeHtml(x[2])}</div></div>`).join("");
  $("#powerRanking").innerHTML=rows.map(r=>`<button type="button" class="power-card" data-status-player="${r.playerId}"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div class="power-card-main"><div class="power-card-title"><strong>${escapeHtml(r.player)}</strong><span class="stock ${r.report.trendKey==="up"?"up":r.report.trendKey==="down"?"down":"hold"}">${escapeHtml(r.report.headline)}</span></div><div class="power-card-meta"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.archetype)}</span><span>近5场 ${fmtScore(r.recentTotal)}</span><span>${escapeHtml(r.seasonPerformance?.season||latestActualSeason())} OVR ${r.seasonPerformance?.rating??"—"}</span><span>生涯OVR ${r.career?.overallRating??"—"}</span></div><div class="bar"><i style="width:${Math.max(4,r.powerIndex)}%"></i></div></div><div class="power-score"><b>${r.powerIndex}</b><small>${movementText(r)}</small></div></button>`).join("");
  $("#stockWatch").innerHTML=rows.map(r=>`<button type="button" class="stock-row" data-status-player="${r.playerId}"><div><strong>${escapeHtml(r.player)}</strong><span>${escapeHtml(r.report.headline)}</span></div><b class="${r.indexChange>0?"score-pos":r.indexChange<0?"score-neg":""}">${r.indexChange>0?"+":""}${r.indexChange}</b></button>`).join("");
  $("#statusStorylines").innerHTML=(center.storylines||[]).map(x=>`<div class="storyline-item">${escapeHtml(x)}</div>`).join("");
  $("#statusMethodology").innerHTML=`<p>${escapeHtml(center.methodology||"")}</p><h4 class="method-title">近期状态指数</h4><div class="method-bars"><span>近期加权净分 <b>35%</b></span><span>正分率 <b>20%</b></span><span>MVP <b>15%</b></span><span>BGR <b>10%</b></span><span>走势 <b>10%</b></span><span>相对赛季表现 <b>10%</b></span></div><h4 class="method-title">当前赛季OVR</h4><div class="method-bars"><span>得分表现 <b>30%</b></span><span>比赛质量 <b>25%</b></span><span>MVP影响力 <b>20%</b></span><span>爆发能力 <b>15%</b></span><span>稳定性 <b>10%</b></span></div><h4 class="method-title">生涯综合评分 OVR</h4><div class="method-bars"><span>历季累计积分 <b>25%</b></span><span>生涯场均 <b>20%</b></span><span>生涯正分率 <b>15%</b></span><span>MVP率 <b>15%</b></span><span>场均BGR <b>10%</b></span><span>官方荣誉积分 <b>15%</b></span></div><h4 class="method-title">GOAT指数</h4><div class="method-bars"><span>官方荣誉 <b>40%</b></span><span>生涯表现 <b>30%</b></span><span>历史纪录 <b>15%</b></span><span>持续性与适应性 <b>15%</b></span></div><small>当前赛季OVR只读取当前赛季数据；近期状态、生涯OVR和赛季OVR均不影响官方荣誉。</small>`;
}

function renderPlayerScouting(pid){
  const r=state.statusCenter?.rankings?.find(x=>x.playerId===pid),el=$("#playerScouting");if(!el)return;
  if(!r){el.innerHTML='<div class="empty">暂无状态分析</div>';return;}
  const report=r.report||{},trendClass=report.trendKey==="up"?"up":report.trendKey==="down"?"down":"hold";
  const career=r.career||{},goat=state.goat?.find(x=>x.playerId===pid)||{};
  const seasonCards=(career.seasonHistory||[]).map(s=>`<article class="career-season-card"><div><span>${escapeHtml(s.season)}</span><b>${escapeHtml(s.ratingLabel||"赛季评价")}</b></div><strong>${s.rating??"—"}</strong><small>积分 ${fmtScore(s.total||0)} · 排名 #${s.totalRank||"—"} · 场均 ${fmtAvg(s.average||0)} · MVP ${s.mvps||0}</small></article>`).join("")||'<div class="empty">暂无历季数据</div>';
  const goatBreakdown=Object.values(goat.breakdown||{}).map(item=>`<div><span>${escapeHtml(item.label)}</span><b>${Number(item.score||0).toFixed(1)}<small> / ${item.max}</small></b><i><em style="width:${Math.min(100,Number(item.score||0)/Number(item.max||1)*100)}%"></em></i></div>`).join("");
  const goatFacts=(goat.evaluation?.facts||[]).map(item=>`<span>• ${escapeHtml(item)}</span>`).join("");
  const goatChange=Number(goat.indexChange||0),goatMove=Number(goat.movement||0);
  el.innerHTML=`<div class="scouting-report"><header><div><span class="stock ${trendClass}">${escapeHtml(report.headline||"持续观望")}</span><h3>${escapeHtml(r.label)} · MSL实力榜 #${r.rank}</h3><p>${escapeHtml(report.summary||"")}</p></div><div class="scouting-index"><b>${r.powerIndex}</b><small>近期状态指数</small></div></header>
  <div class="goat-evaluation"><div class="goat-evaluation-head"><div><span>MSL历史地位</span><h4>GOAT综合评价</h4><b>${escapeHtml(goat.evaluation?.label||"历史观察中")}</b></div><div class="goat-rating"><strong>${Number(goat.goatIndex||0).toFixed(1)}</strong><small>GOAT INDEX</small><span>联盟 #${goat.rank||"—"}${goatMove?` · ${goatMove>0?"↑":"↓"}${Math.abs(goatMove)}`:""}</span></div></div><p>${escapeHtml(goat.evaluation?.summary||"暂无GOAT综合评价。")}</p><div class="goat-component-grid">${goatBreakdown}</div><div class="goat-change-reason"><b class="${goatChange>0?"score-pos":goatChange<0?"score-neg":""}">${goatChange>0?"+":""}${goatChange.toFixed(1)}</b><span>${escapeHtml(goat.changeReason||"")}</span></div><div class="goat-fact-list">${goatFacts}</div><p class="goat-outlook">${escapeHtml(goat.evaluation?.outlook||"")}</p><small class="goat-method-note">${escapeHtml(state.goatMethodology||"")}</small></div>
  <div class="career-evaluation"><div class="career-evaluation-head"><div><span>${escapeHtml(career.seasonRange||"S1–S3")}</span><h4>历季生涯综合评价</h4><b>${escapeHtml(report.careerLabel||"生涯观察中")}</b></div><div class="career-ovr"><strong>${career.overallRating??"—"}</strong><small>OVERALL</small><span>联盟 #${career.overallRank||"—"}</span></div></div><p>${escapeHtml(report.careerSummary||"暂无足够的历季数据。")}</p><div class="career-metric-grid"><div><span>历季参赛</span><b>${career.games||0}场</b></div><div><span>累计积分</span><b class="${scoreClass(career.total||0)}">${fmtScore(career.total||0)}</b></div><div><span>生涯场均</span><b>${fmtAvg(career.average||0)}</b></div><div><span>正分率</span><b>${fmtPct(career.positiveRate||0)}</b></div><div><span>MVP</span><b>${career.mvps||0}次</b></div><div><span>BGR</span><b>${career.bgr||0}</b></div><div><span>荣誉分</span><b>${career.honorPoints||0}</b></div></div><div class="career-analysis-copy"><h5>整体评价</h5><p>${escapeHtml(report.careerEvaluation||"")}</p><h5>长期展望</h5><p>${escapeHtml(report.careerOutlook||"")}</p></div><div class="career-two-col"><section><h5>生涯优势</h5>${(report.careerStrengths||[]).map(x=>`<span>✓ ${escapeHtml(x)}</span>`).join("")||'<span>暂无突出单项</span>'}</section><section><h5>长期隐忧</h5>${(report.careerRisks||[]).map(x=>`<span>• ${escapeHtml(x)}</span>`).join("")||'<span>暂无明显预警</span>'}</section></div><div class="career-season-stack"><h5>历季表现</h5>${seasonCards}</div></div>
  <div class="scouting-columns"><section><h4>近期亮点</h4>${(report.strengths||[]).map(x=>`<span>✓ ${escapeHtml(x)}</span>`).join("")}</section><section><h4>潜在风险</h4>${(report.risks||[]).map(x=>`<span>• ${escapeHtml(x)}</span>`).join("")}</section><section><h4>下一场关注</h4><p>${escapeHtml(report.next||"")}</p></section></div><footer>牌手类型：${escapeHtml(r.archetype)} · 生涯定位：${escapeHtml(report.careerLabel||"—")} · 最近5场：${r.recent.map(x=>`${x.score>=0?"+":""}${x.score}`).join(" / ")||"暂无"}</footer></div>`;
}

document.addEventListener("click",e=>{const b=e.target.closest("[data-status-player]");if(!b)return;currentPlayer=b.dataset.statusPlayer;$("#playerSelect").value=currentPlayer;showView("player");});

function formatRecordValue(record,value=record?.value){
  if(value==null||!Number.isFinite(Number(value)))return "—";
  const number=Number(value),unit=record?.unit||"";const prefix=record?.forcePlus&&number>0?"+":"";
  if(unit==="分/场")return `${prefix}${number.toFixed(2)} 分/场`;if(unit==="%")return `${(number*100).toFixed(2)}%`;return `${prefix}${number.toFixed(Number.isInteger(number)?0:2)}${unit?` ${unit}`:""}`;
}
function recordHolderText(record){return record?.holderNames?.length?record.holderNames.join(" / "):"暂无记录";}
function recordCurrentHolders(record){return (record?.ranking||[]).filter(row=>row.rank===1);}
function recordFirstHolder(record){return [...recordCurrentHolders(record)].sort((a,b)=>String(a.createdAt||"9999").localeCompare(String(b.createdAt||"9999"))||String(a.playerId).localeCompare(String(b.playerId)))[0]||null;}
function recordLatestCoHolder(record,first){return [...recordCurrentHolders(record)].filter(row=>!first||row.playerId!==first.playerId).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))||String(a.playerId).localeCompare(String(b.playerId)))[0]||null;}
function dataMetricLabel(metric){return ({points:"积分",mvp:"MVP",positive:"正分",negative:"负分",soloWin:"独赢",soloLoss:"独输",explosion:"爆发",explosionTier:"爆发档位"})[metric]||"积分";}
function renderDataLeaderboard(){
  const seasonSel=$("#dataSeasonFilter"),typeSel=$("#dataMatchTypeFilter"),metricSel=$("#dataMetricFilter");if(!seasonSel)return;
  dataSeason=seasonSel.value||dataSeason;dataMatchType=typeSel.value||dataMatchType;dataMetric=metricSel.value||dataMetric;
  const rows=buildDataLeaderboard(state.players||[],state.matches||[],{season:dataSeason,type:dataMatchType,metric:dataMetric});
  const head=$("#dataLeaderboardHead"),body=$("#dataLeaderboardBody");
  if(dataMetric==="points"){
    head.innerHTML='<tr><th>排名</th><th>牌手</th><th>场次</th><th>积分</th><th>场均积分</th><th>最高累计积分</th><th>最低累计积分</th></tr>';
    body.innerHTML=rows.map(r=>`<tr><td><span class="rank ${r.rank===1?"top":""}">${r.rank}</span></td><td><strong>${escapeHtml(r.player)}</strong></td><td>${r.games}</td><td class="${scoreClass(r.total)}">${fmtScore(r.total)}</td><td>${fmtAvg(r.average)}</td><td class="${scoreClass(r.cumulativeHigh)}">${fmtScore(r.cumulativeHigh)}</td><td class="${scoreClass(r.cumulativeLow)}">${fmtScore(r.cumulativeLow)}</td></tr>`).join("");
  }else if(dataMetric==="explosionTier"){
    head.innerHTML='<tr><th>排名</th><th>牌手</th><th>场次</th><th>50+</th><th>60+</th><th>70+</th><th>80+</th><th>90+</th><th>100+</th><th>BGR指数</th></tr>';
    body.innerHTML=rows.map(r=>{const x=r.explosionBins||{};return `<tr><td><span class="rank ${r.rank===1?"top":""}">${r.rank}</span></td><td><strong>${escapeHtml(r.player)}</strong></td><td>${r.games}</td><td>${x.over50||0}</td><td>${x.over60||0}</td><td>${x.over70||0}</td><td>${x.over80||0}</td><td>${x.over90||0}</td><td>${x.over100||0}</td><td><b>${r.bgr||0}</b></td></tr>`;}).join("");
  }else{
    const key=dataMetric,labels={mvp:["MVP次数","MVP积分","MVP场均积分","MVP率"],positive:["正分次数","正分积分","正分场均积分","正分率"],negative:["负分次数","负分积分","负分场均积分","负分率"],soloWin:["独赢次数","独赢积分","独赢场均积分","独赢率"],soloLoss:["独输次数","独输积分","独输场均积分","独输率"],explosion:["爆发次数","爆发积分","爆发场均积分","爆发率"]}[key];
    head.innerHTML=`<tr><th>排名</th><th>牌手</th><th>场次</th><th>${labels[0]}</th><th>${labels[1]}</th><th>${labels[2]}</th><th>${labels[3]}</th></tr>`;
    body.innerHTML=rows.map(r=>{const x=r[key];return `<tr><td><span class="rank ${r.rank===1?"top":""}">${r.rank}</span></td><td><strong>${escapeHtml(r.player)}</strong></td><td>${r.games}</td><td>${x.count}</td><td class="${scoreClass(x.points)}">${fmtScore(x.points)}</td><td>${x.count?fmtAvg(x.average):"—"}</td><td>${fmtPct(x.rate)}</td></tr>`;}).join("");
  }
  if(!rows.length)body.innerHTML=`<tr><td colspan="10" class="empty">当前筛选范围暂无数据。</td></tr>`;
}
function renderRecords({includeLeaderboard=true}={}){
  const center=state.recordCenter||buildRecordCenter(state.players||[],state.matches||[]);const seasonSel=$("#recordSeasonFilter");if(seasonSel){recordSeason=seasonSel.value||recordSeason;seasonSel.value=recordSeason;}
  const records=center.views?.[recordSeason]?.[recordType]?.[recordSection]||[];
  $$('[data-record-section]').forEach(button=>button.classList.toggle('active',button.dataset.recordSection===recordSection));const typeSel=$("#recordTypeFilter");if(typeSel)typeSel.value=recordType;
  const sectionNames={single:"单场记录",continuous:"连续记录"},typeNames={all:"全部比赛",four:"四人局",five:"五人局"},seasonName=recordSeason==="all"?"全部赛季":recordSeason;
  $("#recordSummary").innerHTML=`<div><b>${sectionNames[recordSection]}</b><span>${seasonName} · ${typeNames[recordType]} · 共 ${records.length} 项记录</span></div><small>${escapeHtml(center.methodology||"")}</small>`;
  $("#recordTableHead").innerHTML='<tr><th>记录名称</th><th>保持者</th><th>记录</th><th>创造时间</th><th></th></tr>';
  $("#recordTableBody").innerHTML=records.map(record=>`<tr class="record-row" data-record-id="${escapeHtml(record.id)}"><td><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(record.rule)}</small></td><td>${escapeHtml(recordHolderText(record))}</td><td><b class="${record.value!=null&&Number(record.value)<0?"score-neg":"score-pos"}">${escapeHtml(record.displayValue||formatRecordValue(record))}</b></td><td>${escapeHtml(record.createdAt||"—")}</td><td><button type="button" class="btn record-detail-btn" data-record-id="${escapeHtml(record.id)}">查看详情</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">暂无记录。</td></tr>';
  if(includeLeaderboard)renderDataLeaderboard();
}
function currentRecordById(recordId){return state.recordCenter?.views?.[recordSeason]?.[recordType]?.[recordSection]?.find(record=>record.id===recordId)||null;}
function ensureRecordModal(){if($("#recordModalBackdrop"))return;document.body.insertAdjacentHTML("beforeend",`<div class="record-modal-backdrop" id="recordModalBackdrop" hidden><section class="record-modal" role="dialog" aria-modal="true" aria-labelledby="recordModalTitle"><button type="button" class="record-modal-close" id="recordModalClose" aria-label="关闭">×</button><div id="recordModalBody"></div></section></div>`);$("#recordModalBackdrop").addEventListener("mousedown",event=>{if(event.target.id==="recordModalBackdrop")closeRecordModal();});$("#recordModalClose").addEventListener("click",closeRecordModal);}
function closeRecordModal(){
  const modal=$("#recordModalBackdrop");if(!modal||modal.hidden)return;
  animateRecordDetails(modal,{open:false,onComplete:()=>{modal.hidden=true;document.body.classList.remove("modal-open");}});
}
function recordRankingNote(row){const parts=[];if(row.season)parts.push(row.season);if(row.length)parts.push(`连续${row.length}场`);if(row.startDate&&row.endDate)parts.push(`${row.startDate} 至 ${row.endDate}`);if(row.matchId)parts.push(row.matchId);return parts.join(" · ");}
function renderRecordEvidence(evidence){if(!evidence?.length)return '<div class="empty">暂无可展示的比赛明细。</div>';let cumulative=0,currentPlayer="";return evidence.map(item=>{if(item.player!==currentPlayer){currentPlayer=item.player||"";cumulative=0;}cumulative+=Number(item.score||0);const margin=item.dominanceMargin!=null?` · 领先均分 ${Number(item.dominanceMargin)>=0?"+":""}${Number(item.dominanceMargin).toFixed(2)}`:"";const player=item.player?`${escapeHtml(item.player)} · `:"";return `<article><div><strong>${player}${escapeHtml(item.season||"")} 第${escapeHtml(item.round??"—")}局 · ${escapeHtml(item.date||"—")}</strong><span>${escapeHtml(item.matchType||"—")} · ${escapeHtml(item.venue||"未填写场地")}${escapeHtml(margin)}</span></div><div><b class="${scoreClass(item.score)}">${fmtScore(item.score)}</b><small>阶段累计 ${fmtScore(cumulative)}</small></div></article>`;}).join("");}
function openRecordModal(recordId){
  const record=currentRecordById(recordId);if(!record)return;ensureRecordModal();const topFive=(record.ranking||[]).filter(row=>Number(row.rank)<=5);const ranking=topFive.map(row=>`<div class="record-ranking-row ${row.rank===1?"is-holder":""}"><span>#${row.rank}</span><div><strong>${escapeHtml(row.player)}</strong><small>${escapeHtml(recordRankingNote(row))}</small></div><b>${escapeHtml(formatRecordValue(record,row.value))}</b><time>${escapeHtml(row.createdAt||"—")}</time></div>`).join("")||'<div class="empty">暂无历史排名。</div>';
  const holders=recordCurrentHolders(record),first=recordFirstHolder(record),latest=recordLatestCoHolder(record,first);const typeName=recordType==="all"?"全部比赛":recordType==="four"?"四人局":"五人局",seasonName=recordSeason==="all"?"全部赛季":recordSeason,recentTie=latest?`${latest.player} · ${latest.createdAt}`:"暂无后来追平";
  const infoGrid=`<div><span>保持者</span><b>${escapeHtml(recordHolderText(record))}</b></div><div><span>当前记录</span><b>${escapeHtml(record.displayValue)}</b></div><div><span>首次创造</span><b>${escapeHtml(first?`${first.player} · ${first.createdAt}`:"—")}</b></div><div><span>最近追平</span><b>${escapeHtml(recentTie)}</b></div>`;
  const evidence=(record.evidence||[]).length?record.evidence:holders.flatMap(item=>item.evidence||[]);
  $("#recordModalBody").innerHTML=`<header class="record-modal-header"><div><p>${escapeHtml(seasonName)} · ${escapeHtml(typeName)} · ${recordSection==="single"?"单场记录":"连续记录"}</p><h2 id="recordModalTitle">${escapeHtml(record.name)}</h2><strong>${escapeHtml(recordHolderText(record))} · ${escapeHtml(record.displayValue)}</strong></div><span class="record-holder-badge">MSL RECORD</span></header><section class="record-modal-section"><h3>记录信息</h3><p>${escapeHtml(record.rule)}</p><div class="record-info-grid">${infoGrid}</div></section><section class="record-modal-section"><h3>历史排名 · 前5名</h3><div class="record-ranking-list">${ranking}</div></section><section class="record-modal-section"><h3>纪录过程</h3><div class="record-evidence-list">${renderRecordEvidence(evidence)}</div></section><footer class="record-modal-footer">记录由MOAP正式比赛数据实时计算 · 并列第5名完整保留 · 允许并列保持</footer>`;
  const modal=$("#recordModalBackdrop");modal.hidden=false;document.body.classList.add("modal-open");animateRecordDetails(modal,{open:true});animateNumbers(modal);
}
function refreshRecordResults(updateState){
  const root=$('.view[data-view="records"]');
  transitionRecordContent({
    targets:[$("#recordSummary"),root?.querySelector(".record-center-card .record-table-scroll")].filter(Boolean),
    update:()=>{updateState();renderRecords({includeLeaderboard:false});},
    onUpdated:()=>animateNumbers(root)
  });
}
function refreshDataLeaderboard(updateState){
  const root=$('.view[data-view="records"]');
  transitionRecordContent({
    targets:[root?.querySelector(".record-data-leaderboard .table-scroll")].filter(Boolean),
    update:()=>{updateState();renderDataLeaderboard();},
    onUpdated:()=>animateNumbers(root?.querySelector(".record-data-leaderboard"))
  });
}
document.addEventListener("click",event=>{const sectionButton=event.target.closest("[data-record-section]");if(sectionButton){refreshRecordResults(()=>{recordSection=sectionButton.dataset.recordSection;});return;}const detailButton=event.target.closest("[data-record-id]");if(detailButton&&currentView==="records"){openRecordModal(detailButton.dataset.recordId);return;}});
$("#recordSeasonFilter")?.addEventListener("change",e=>refreshRecordResults(()=>{recordSeason=e.target.value;}));
$("#recordTypeFilter")?.addEventListener("change",e=>refreshRecordResults(()=>{recordType=e.target.value;}));
$("#dataSeasonFilter")?.addEventListener("change",e=>refreshDataLeaderboard(()=>{dataSeason=e.target.value;}));
$("#dataMatchTypeFilter")?.addEventListener("change",e=>refreshDataLeaderboard(()=>{dataMatchType=e.target.value;}));
$("#dataMetricFilter")?.addEventListener("change",e=>refreshDataLeaderboard(()=>{dataMetric=e.target.value;}));

function renderMatchPlayerOptions(){
  const holder=$("#matchPlayerOptions");if(!holder)return;
  const valid=new Set((state.players||[]).map(p=>p.playerId));
  [...selectedMatchPlayers].forEach(id=>{if(!valid.has(id))selectedMatchPlayers.delete(id);});
  holder.innerHTML=(state.players||[]).map(p=>`<label class="match-player-option"><input type="checkbox" data-match-player="${escapeHtml(p.playerId)}" ${selectedMatchPlayers.has(p.playerId)?"checked":""}><span>${escapeHtml(p.name)}</span></label>`).join("");
  updateMatchPlayerTrigger();
}
function updateMatchPlayerTrigger(){
  const button=$("#matchPlayerTrigger");if(!button)return;
  const names=(state.players||[]).filter(p=>selectedMatchPlayers.has(p.playerId)).map(p=>p.name);
  button.textContent=!names.length?"全部牌手":names.length===1?names[0]:names.length===2?names.join("、"):`已选择${names.length}名牌手`;
  button.title=names.length?names.join("、"):"不限制牌手";
  const count=$("#matchPlayerCount");if(count)count.textContent=`已选择${names.length}人`;
}
function populateSelects(){
  const opts=state.players.map(p=>`<option value="${p.playerId}">${p.name}</option>`).join("");
  $("#playerSelect").innerHTML=opts; $("#honorPlayer").innerHTML=opts;
  renderMatchPlayerOptions();
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
  const svg=$("#trendChart"),arr=playerTimeline(pid);
  const wrap=svg?.closest?.(".trend-wrap");
  if(wrap&&!wrap.querySelector(".trend-tooltip")){
    wrap.insertAdjacentHTML("beforeend",'<div class="trend-tooltip" role="tooltip" aria-hidden="true"><strong data-trend-title></strong><span data-trend-date></span><span data-trend-mvp hidden>MVP</span><span data-trend-score></span><span data-trend-total></span></div>');
  }
  if(!arr.length){svg.innerHTML="";return}
  const W=760,H=250,pad={l:42,r:18,t:18,b:30};
  const vals=arr.map(x=>x.cumulative),min=Math.min(0,...vals),max=Math.max(0,...vals),range=(max-min)||1;
  const x=i=>pad.l+(W-pad.l-pad.r)*(i/(arr.length-1||1));
  const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/range);
  const pts=arr.map((d,i)=>`${x(i)},${y(d.cumulative)}`).join(" ");
  const area=`${x(0)},${y(0)} ${pts} ${x(arr.length-1)},${y(0)}`;
  const grid=[0,.25,.5,.75,1].map(t=>{const v=min+range*t;return `<line class="axis" x1="${pad.l}" y1="${y(v)}" x2="${W-pad.r}" y2="${y(v)}"/><text class="chart-label" x="3" y="${y(v)+3}">${Math.round(v)}</text>`}).join("");
  const dots=arr.map((d,i)=>`<circle class="trend-dot" cx="${x(i)}" cy="${y(d.cumulative)}" r="3.2" data-season="${escapeHtml(d.season||"")}" data-round="${escapeHtml(String(d.round??""))}" data-date="${escapeHtml(d.date||"")}" data-mvp="${d.isMvp?"true":"false"}" data-score="${escapeHtml(fmtScore(d.score))}" data-score-value="${Number(d.score)}" data-cumulative="${escapeHtml(fmtScore(d.cumulative))}"><title>${escapeHtml([d.season,d.round?`第${d.round}场`:"",d.date,d.isMvp?"MVP":"",fmtScore(d.score),`累计 ${fmtScore(d.cumulative)}`].filter(Boolean).join(" · "))}</title></circle>`).join("");
  svg.innerHTML=`<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d7b25b" stop-opacity=".24"/><stop offset="100%" stop-color="#d7b25b" stop-opacity="0"/></linearGradient><clipPath id="trendAreaClip"><rect class="trend-area-reveal" x="${pad.l}" y="${pad.t}" width="${W-pad.l-pad.r}" height="${H-pad.t-pad.b}"/></clipPath></defs>${grid}<polygon class="trend-area" clip-path="url(#trendAreaClip)" points="${area}"/><polyline class="trend-line" points="${pts}"/><line class="trend-guide" x1="${x(arr.length-1)}" y1="${pad.t}" x2="${x(arr.length-1)}" y2="${H-pad.b}"/>${dots}<text class="chart-label" x="${pad.l}" y="${H-7}">${arr[0].season} · 第1场</text><text class="chart-label" text-anchor="end" x="${W-pad.r}" y="${H-7}">${arr[arr.length-1].season} · 第${arr[arr.length-1].round}场</text>`;
  $("#chartCaption").textContent=`${arr.length}场 · 当前累计 ${fmtScore(arr[arr.length-1].cumulative)}`;
}
function seasonGrade(rating){return rating>=92?"S":rating>=86?"A+":rating>=80?"A":rating>=74?"B+":rating>=68?"B":rating>=62?"C+":"C";}
function renderCurrentSeasonPerformance(pid){
  const holder=$("#currentSeasonPerformance"),meta=$("#currentSeasonPerformanceMeta");if(!holder)return;
  const r=state.statusCenter?.rankings?.find(x=>x.playerId===pid),perf=r?.seasonPerformance,career=r?.career||{};
  if(!perf){holder.innerHTML='<div class="empty">当前赛季暂无有效数据</div>';return;}
  const season=perf.season||latestActualSeason(),dims=perf.dimensionScores||{},diff=Number(perf.rating||0)-Number(career.overallRating||0);
  if(meta)meta.textContent=`${season}独立评分 · 只使用${season}比赛数据`;
  const dimList=[["得分表现",dims.scoring,30],["比赛质量",dims.quality,25],["MVP影响力",dims.mvpImpact,20],["爆发能力",dims.bigStage,15],["稳定性",dims.stability,10]];
  const compareText=Math.abs(diff)<2?"接近个人生涯水准":diff>0?`高于生涯OVR ${diff}分`:`低于生涯OVR ${Math.abs(diff)}分`;
  const compareClass=diff>1?"score-pos":diff<-1?"score-neg":"";
  holder.innerHTML=`<div class="season-performance-shell"><div class="season-rating-hero"><div><span>${escapeHtml(season)} SEASON RATING</span><strong>${perf.rating}</strong><b>${seasonGrade(perf.rating)} · 联盟 #${perf.rank}</b></div><div class="season-compare"><small>生涯OVR ${career.overallRating??"—"}</small><b class="${compareClass}">${diff>0?"+":""}${diff}</b><span>${escapeHtml(compareText)}</span></div></div><div class="season-dimension-grid">${dimList.map(([name,value,weight])=>`<div class="season-dimension"><div><span>${name}</span><b>${Number(value||0).toFixed(1)}</b></div><div class="bar"><i style="width:${Math.max(2,Math.min(100,Number(value||0)))}%"></i></div><small>权重 ${weight}%</small></div>`).join("")}</div><div class="season-core-stats"><div><span>赛季积分</span><b class="${scoreClass(perf.total)}">${fmtScore(perf.total)}</b></div><div><span>场均</span><b>${fmtAvg(perf.average)}</b></div><div><span>正分率</span><b>${fmtPct(perf.positiveRate)}</b></div><div><span>MVP</span><b>${perf.mvps}次</b></div><div><span>MVP率</span><b>${fmtPct(perf.mvpRate)}</b></div><div><span>BGR</span><b>${perf.bgr}</b></div><div><span>爆发场次</span><b>${perf.bigStageCount}场</b></div><div><span>最高单场</span><b class="${scoreClass(perf.best)}">${fmtScore(perf.best)}</b></div></div><div class="season-performance-copy"><div><strong>${escapeHtml(r.report?.seasonLabel||perf.ratingLabel)}</strong><p>${escapeHtml(r.report?.seasonSummary||"")}</p></div><div><strong>赛季观察</strong><p>${escapeHtml(r.report?.seasonOutlook||"")}</p></div></div><small class="season-rating-method">${escapeHtml(state.statusCenter?.currentSeasonRating?.methodology||"")}</small></div>`;
}

function playerSeasonDataRow(pid,season,type,metric){
  return buildDataLeaderboard(state.players||[],state.matches||[],{season,type,metric}).find(row=>row.playerId===pid)||null;
}
function renderPlayerSeasonData(pid){
  const typeSel=$("#playerSeasonMatchType"),metricSel=$("#playerSeasonMetric"),head=$("#playerSeasonHead"),body=$("#playerSeasonTable");if(!head||!body)return;
  playerSeasonMatchType=typeSel?.value||playerSeasonMatchType;playerSeasonMetric=metricSel?.value||playerSeasonMetric;
  const seasons=[...new Set((state.matches||[]).map(m=>m.season).filter(Boolean))].sort((a,b)=>Number(String(a).replace(/\D/g,""))-Number(String(b).replace(/\D/g,"")));
  const scopes=[...seasons,"all"];
  const labels=scope=>scope==="all"?"合计":scope;
  if(playerSeasonMetric==="points"){
    head.innerHTML='<tr><th>赛季</th><th>场次</th><th>积分</th><th>场均积分</th><th>单场最高积分</th><th>单场最低积分</th></tr>';
    body.innerHTML=scopes.map(scope=>{const r=playerSeasonDataRow(pid,scope,playerSeasonMatchType,"points");if(!r)return `<tr><td><span class="chip ${scope==="all"?"":"gold"}">${labels(scope)}</span></td><td colspan="5" class="muted">暂无参赛数据</td></tr>`;return `<tr class="${scope==="all"?"season-total-row":""}"><td><span class="chip ${scope==="all"?"":"gold"}">${labels(scope)}</span></td><td>${r.games}</td><td class="${scoreClass(r.total)}">${fmtScore(r.total)}</td><td>${fmtAvg(r.average)}</td><td class="${scoreClass(r.best)}">${fmtScore(r.best)}</td><td class="${scoreClass(r.worst)}">${fmtScore(r.worst)}</td></tr>`;}).join("");
  }else if(playerSeasonMetric==="explosionTier"){
    head.innerHTML='<tr><th>赛季</th><th>场次</th><th>50+</th><th>60+</th><th>70+</th><th>80+</th><th>90+</th><th>100+</th><th>BGR指数</th></tr>';
    body.innerHTML=scopes.map(scope=>{const r=playerSeasonDataRow(pid,scope,playerSeasonMatchType,"explosionTier");if(!r)return `<tr><td><span class="chip ${scope==="all"?"":"gold"}">${labels(scope)}</span></td><td colspan="8" class="muted">暂无参赛数据</td></tr>`;const x=r.explosionBins||{};return `<tr class="${scope==="all"?"season-total-row":""}"><td><span class="chip ${scope==="all"?"":"gold"}">${labels(scope)}</span></td><td>${r.games}</td><td>${x.over50||0}</td><td>${x.over60||0}</td><td>${x.over70||0}</td><td>${x.over80||0}</td><td>${x.over90||0}</td><td>${x.over100||0}</td><td><b>${r.bgr||0}</b></td></tr>`;}).join("");
  }else{
    const labelsBy={mvp:["MVP次数","MVP积分","MVP场均积分","MVP率"],positive:["正分次数","正分积分","正分场均积分","正分率"],negative:["负分次数","负分积分","负分场均积分","负分率"],soloWin:["独赢次数","独赢积分","独赢场均积分","独赢率"],soloLoss:["独输次数","独输积分","独输场均积分","独输率"],explosion:["爆发次数","爆发积分","爆发场均积分","爆发率"]};
    const cols=labelsBy[playerSeasonMetric];
    head.innerHTML=`<tr><th>赛季</th><th>场次</th><th>${cols[0]}</th><th>${cols[1]}</th><th>${cols[2]}</th><th>${cols[3]}</th></tr>`;
    body.innerHTML=scopes.map(scope=>{const r=playerSeasonDataRow(pid,scope,playerSeasonMatchType,playerSeasonMetric);if(!r)return `<tr><td><span class="chip ${scope==="all"?"":"gold"}">${labels(scope)}</span></td><td colspan="5" class="muted">暂无参赛数据</td></tr>`;const x=r[playerSeasonMetric];return `<tr class="${scope==="all"?"season-total-row":""}"><td><span class="chip ${scope==="all"?"":"gold"}">${labels(scope)}</span></td><td>${r.games}</td><td>${x.count}</td><td class="${scoreClass(x.points)}">${fmtScore(x.points)}</td><td>${x.count?fmtAvg(x.average):"—"}</td><td>${fmtPct(x.rate)}</td></tr>`;}).join("");
  }
  [...body.querySelectorAll("tr")].forEach((row,rowIndex)=>{
    const scope=scopes[rowIndex]||("row-"+rowIndex);
    [...row.children].forEach((cell,cellIndex)=>{
      if(cellIndex===0||cell.classList.contains("muted"))return;
      const target=cell.querySelector(":scope > b")||cell;
      target.setAttribute("data-player-number","");
      target.dataset.animationKey=`player-season-${scope}-${cellIndex}`;
    });
  });
}

function renderPlayer(){
  const pid=currentPlayer,p=state.players.find(x=>x.playerId===pid),c=playerCareer(pid),prof=state.profiles[pid];
  const statusRow=state.statusCenter?.rankings?.find(x=>x.playerId===pid),career=statusRow?.career||{},seasonPerf=statusRow?.seasonPerformance||{};
  const honors=state.honors[pid]||[],groups=groupPlayerHonors(honors);
  $("#playerHeader").innerHTML=`<div class="profile-identity">${playerPortraitHtml(p)}<div class="profile-name-block"><span class="profile-kicker">MSL PLAYER PROFILE</span><h3>${escapeHtml(p.name)}</h3><div class="muted">${pid} · 荣誉排名第 ${prof.honorRank}</div><div class="profile-rating-pills"><span>生涯OVR <b>${career.overallRating??"—"}</b></span><span>${escapeHtml(seasonPerf.season||latestActualSeason())} OVR <b>${seasonPerf.rating??"—"}</b></span></div></div></div><span class="chip gold profile-goat-chip">${c.goatRank===1?"CURRENT GOAT":"GOAT #"+c.goatRank}</span>`;
  const topGroups=groups.slice(0,4);
  const summary=$("#profileHonorSummary");if(summary)summary.textContent=`${groups.length}类奖项 · 生涯累计${honors.length}次`;
  const list=$("#profileHonorList");if(list)list.innerHTML=topGroups.map(g=>profileHonorRowHtml(pid,g)).join("")||'<div class="empty">暂无荣誉记录</div>';
  const allBtn=$("#profileHonorsAll");if(allBtn){allBtn.hidden=!groups.length;allBtn.dataset.playerHonorsAll=pid;}
  renderCurrentSeasonPerformance(pid);
  renderPlayerSeasonData(pid);
  drawTrend(pid);
  const rec=playerTimeline(pid).slice(-5).reverse();
  $("#recentMatchesPlayer").innerHTML=rec.map((r,index)=>`<div class="score-row ${r.isMvp?"mvp":""} ${index===0?"recent-latest":""}" data-recent-match data-recent-index="${index}"><div class="left"><span class="chip">${r.season}·${r.round}</span><span>${r.date}</span>${r.isMvp?'<span class="chip gold recent-mvp-badge">MVP</span>':""}</div><b class="${scoreClass(r.score)}" data-player-number data-animation-key="player-recent-${index}">${fmtScore(r.score)}</b></div>`).join("");
  renderPlayerScouting(pid);
}

$("#playerSelect").addEventListener("change",e=>{
  const nextPlayer=e.target.value,root=$('.view[data-view="player"]');
  transitionPlayerProfile({
    root,
    update:()=>{currentPlayer=nextPlayer;renderPlayer();},
    onUpdated:()=>animateNumbers(root)
  });
});
document.addEventListener("click",e=>{const b=e.target.closest("[data-player-honors-all]");if(b)openAllPlayerHonorsModal(b.dataset.playerHonorsAll);});
$("#playerSeasonMatchType")?.addEventListener("change",e=>{
  const nextType=e.target.value,target=$('.player-season-data-card .table-scroll');
  transitionPlayerData({
    target,
    update:()=>{playerSeasonMatchType=nextType;renderPlayerSeasonData(currentPlayer);},
    onUpdated:()=>animatePlayerSeasonNumbers(target)
  });
});
$("#playerSeasonMetric")?.addEventListener("change",e=>{
  const nextMetric=e.target.value,target=$('.player-season-data-card .table-scroll');
  transitionPlayerData({
    target,
    update:()=>{playerSeasonMetric=nextMetric;renderPlayerSeasonData(currentPlayer);},
    onUpdated:()=>animatePlayerSeasonNumbers(target)
  });
});

function matchCard(m){
  const played=m.results.filter(r=>!r.isAbsent).sort((a,b)=>b.score-a.score),precise=matchOrdinal(m.matchId)>=67;
  return `<article class="card match-card ${precise?"match-card-clickable":""}" ${precise?`data-match-id="${escapeHtml(m.matchId)}" tabindex="0" role="button" aria-label="查看${escapeHtml(m.matchId)}比赛详情"`:""}><div class="match-meta"><div><strong>${m.season} 第${m.round}局 · ${m.matchType}</strong><div><small>${m.date} · ${escapeHtml(m.venue||"未填写场地")}</small></div></div><div class="match-card-id"><span class="chip">${m.matchId}</span>${precise?'<small>查看比赛详情 →</small>':""}</div></div><div class="match-scores">${played.map(r=>`<span class="score-pill ${r.isMvp?"mvp":""}">${escapeHtml(r.player)} <b class="${scoreClass(r.score)}">${fmtScore(r.score)}</b>${r.isMvp?" · MVP":""}</span>`).join("")}</div></article>`;
}
function ensureMatchModal(){
  if($("#matchModalBackdrop"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="honor-modal-backdrop" id="matchModalBackdrop" hidden><section class="honor-modal match-detail-modal" role="dialog" aria-modal="true" aria-labelledby="matchModalTitle"><button type="button" class="honor-modal-close" id="matchModalClose" aria-label="关闭">×</button><div id="matchModalBody"></div></section></div>`);
  $("#matchModalBackdrop").addEventListener("mousedown",e=>{if(e.target.id==="matchModalBackdrop")closeMatchModal();});$("#matchModalClose").addEventListener("click",closeMatchModal);
}
function closeMatchModal(){const m=$("#matchModalBackdrop");if(m){m.hidden=true;if($("#honorModalBackdrop")?.hidden!==false)document.body.classList.remove("modal-open");}}
function singleMatchMatrixHtml(match){
  const participants=match.results.filter(r=>!r.isAbsent&&r.score!=null),ids=participants.map(r=>r.playerId),nameBy=Object.fromEntries(participants.map(r=>[r.playerId,r.player]));
  const rows=(state.matchups||[]).filter(x=>x.matchId===match.matchId),cell=new Map(rows.map(x=>[`${x.fromPlayerId}|${x.toPlayerId}`,Number(x.points)]));
  if(!rows.length)return '<div class="empty">精准对位尚未录入。</div>';
  let html=`<div class="matrix-wrap"><table class="matrix match-detail-matrix"><thead><tr><th>攻击方 ↓</th>${ids.map(id=>`<th>${escapeHtml(nameBy[id])}</th>`).join("")}<th>吃分</th><th>被吃分</th><th>净积分</th><th>比赛分</th><th>校验</th></tr></thead><tbody>`;
  ids.forEach(from=>{
    const values=ids.filter(to=>to!==from).map(to=>cell.has(`${from}|${to}`)?cell.get(`${from}|${to}`):null),complete=values.every(v=>v!==null),eat=values.filter(v=>v>0).reduce((a,b)=>a+b,0),eaten=values.filter(v=>v<0).reduce((a,b)=>a+Math.abs(b),0),net=values.filter(v=>v!==null).reduce((a,b)=>a+b,0),score=Number(participants.find(r=>r.playerId===from)?.score||0),ok=complete&&Math.abs(net-score)<1e-9;
    html+=`<tr><td><div class="player-cell matchup-player-cell"><span class="avatar">${initials(nameBy[from])}</span>${matchupPlayerNameHtml(nameBy[from])}</div></td>${ids.map(to=>{if(to===from)return '<td class="matchup-diagonal">—</td>';const key=`${from}|${to}`;if(!cell.has(key))return '<td class="muted">—</td>';const v=cell.get(key),cls=v>0?"pos":v<0?"neg":"neutral";return `<td><span class="matrix-cell ${cls}">${fmtScore(v)}</span></td>`}).join("")}<td class="score-pos">${fmtScore(eat)}</td><td class="score-neg">${eaten?`-${eaten}`:"0"}</td><td class="${scoreClass(net)}">${fmtScore(net)}</td><td class="${scoreClass(score)}">${fmtScore(score)}</td><td><span class="${ok?"status-pass":"status-fail"}">${ok?"一致":complete?"不一致":"未完整"}</span></td></tr>`;
  });
  return html+'</tbody></table></div><small class="match-detail-note">方向格独立统计：A→B 与 B→A 不互相反推；吃分、被吃分与净积分均按本场原始方向格汇总。</small>';
}
function openMatchModal(matchId){
  const match=(state.matches||[]).find(m=>m.matchId===matchId);if(!match)return;
  ensureMatchModal();const pp=match.results.filter(r=>!r.isAbsent).sort((a,b)=>b.score-a.score);
  const precise=matchOrdinal(match.matchId)>=67?`<div class="honor-modal-section"><h3>本场精准对位矩阵</h3>${singleMatchMatrixHtml(match)}</div>`:"";
  $("#matchModalBody").innerHTML=`<header class="honor-modal-header"><span class="honor-modal-grade grade A">局</span><div><p>${escapeHtml(match.season)} 第${match.round}局 · ${escapeHtml(match.matchType)}</p><h2 id="matchModalTitle">${escapeHtml(match.matchId)} 比赛详情</h2><strong>${escapeHtml(match.date)} · ${escapeHtml(match.venue||"未填写场地")}</strong></div></header><div class="honor-modal-section"><h3>本场成绩</h3><div class="match-scores">${pp.map(r=>`<span class="score-pill ${r.isMvp?"mvp":""}">${escapeHtml(r.player)} <b class="${scoreClass(r.score)}">${fmtScore(r.score)}</b>${r.isMvp?" · MVP":""}</span>`).join("")}</div></div>${precise}`;
  $("#matchModalBackdrop").hidden=false;document.body.classList.add("modal-open");
}

function filteredMatches(){
  const season=$("#matchSeason").value,type=$("#matchType").value,q=$("#matchQuery").value.trim().toLowerCase();
  const selected=[...selectedMatchPlayers];
  return [...state.matches].reverse().filter(m=>{
    if(season!=="all"&&m.season!==season)return false;
    if(type!=="all"&&m.matchType!==type)return false;
    if(selected.length){
      const participants=m.results.filter(r=>!r.isAbsent&&r.score!=null).map(r=>r.playerId);
      const participantSet=new Set(participants);
      if(selected.length===1){if(!participantSet.has(selected[0]))return false;}
      else if(participantSet.size!==selected.length||!selected.every(playerId=>participantSet.has(playerId)))return false;
    }
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
["matchSeason","matchType"].forEach(id=>$("#"+id).addEventListener("change",()=>renderMatches(true)));
$("#matchQuery").addEventListener("input",()=>renderMatches(true));
$("#matchPlayerTrigger")?.addEventListener("click",()=>{const menu=$("#matchPlayerMenu"),button=$("#matchPlayerTrigger");const open=menu.hidden;menu.hidden=!open;button.setAttribute("aria-expanded",String(open));});
$("#matchPlayerClear")?.addEventListener("click",()=>{selectedMatchPlayers.clear();renderMatchPlayerOptions();renderMatches(true);});
document.addEventListener("change",e=>{const checkbox=e.target.closest?.("[data-match-player]");if(!checkbox)return;const id=checkbox.dataset.matchPlayer;if(checkbox.checked)selectedMatchPlayers.add(id);else selectedMatchPlayers.delete(id);updateMatchPlayerTrigger();renderMatches(true);});
document.addEventListener("click",e=>{const filter=e.target.closest?.(".match-player-filter");if(filter)return;const menu=$("#matchPlayerMenu"),button=$("#matchPlayerTrigger");if(menu&&!menu.hidden){menu.hidden=true;button?.setAttribute("aria-expanded","false");}});
$("#loadMoreBtn").addEventListener("click",()=>{matchLimit+=15;renderMatches()});
document.addEventListener("click",e=>{const card=e.target.closest("[data-match-id]");if(card&&currentView==="matches")openMatchModal(card.dataset.matchId);});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target?.matches?.("[data-match-id]")&&currentView==="matches")openMatchModal(e.target.dataset.matchId);if(e.key==="Escape"){closeMatchModal();closeRecordModal();}});

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
    html+=`<tr data-matchup-row="${a.playerId}"><td><div class="player-cell matchup-player-cell"><span class="avatar">${initials(a.name)}</span>${matchupPlayerNameHtml(a.name)}</div></td>`;
    ps.forEach(b=>{
      if(a.playerId===b.playerId)html+=`<td class="matchup-diagonal">—</td>`;
      else html+=`<td><input class="matchup-input" type="number" step="1" inputmode="numeric" data-matchup-from="${a.playerId}" data-matchup-to="${b.playerId}" aria-label="${escapeHtml(a.name)} 对 ${escapeHtml(b.name)} 的独立方向对位分"></td>`;
    });
    html+=`<td><strong data-row-total="${a.playerId}">0</strong></td><td><strong data-entry-score-view="${a.playerId}">—</strong></td></tr>`;
  });
  $("#entryMatchupMatrix").innerHTML=html+"</tbody>";
  $$(".matchup-input").forEach(input=>{
    input.addEventListener("input",e=>{
      // 每个方向格完全独立：不再自动修改反向格。
      updateMatchupCellStyle(e.target);validateEntry();
    });
    input.addEventListener("blur",e=>{
      // 0 是合法且需要明确填写的对位结果。
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
  const ps=state.players,nets=Object.fromEntries(ps.map(p=>[p.playerId,0])),matchups=[];
  const selected=new Set(ps.filter(p=>$("#check-"+p.playerId)?.checked).map(p=>p.playerId));
  let valid=true,complete=true;
  ps.forEach(a=>ps.forEach(b=>{
    if(a.playerId===b.playerId||!selected.has(a.playerId)||!selected.has(b.playerId))return;
    const input=$(`[data-matchup-from="${a.playerId}"][data-matchup-to="${b.playerId}"]`);
    const raw=input?.value.trim()??"";
    if(raw===""){complete=false;valid=false;return;}
    const value=Number(raw);
    if(!Number.isInteger(value)){valid=false;return;}
    nets[a.playerId]+=value;
    // 0 也保存：这样数据库能明确区分“已填写0”和“没有录入这个方向格”。
    matchups.push({from_player_id:a.playerId,to_player_id:b.playerId,points:value});
  }));
  return {valid,complete,nets,matchups};
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
  const matchupOk=matchup.valid&&matchup.complete&&comparisons.every(x=>x.ok);
  const ok=basicOk&&matchupOk;
  const el=$("#entryValidation");el.className="validation "+(ok?"ok":"bad");
  el.textContent=`比赛人数 ${rows.length}/${required} · 比赛分合计 ${sum>0?"+":""}${sum} · 方向矩阵 ${matchup.complete?"已完整填写":"有未填写格"} · 对位行和 ${matchupOk?"全部匹配":"存在不一致"} · ${ok?"可以保存":"请完成校验"}`;
  $("#matchupValidation").className="validation "+(matchupOk?"ok":"bad");
  $("#matchupValidation").innerHTML=`<span class="matchup-check ${matchup.complete?"pass":"fail"}">${matchup.complete?"所有方向格均已填写":"每个参赛牌手之间的两个方向格都要分别填写（0也要填）"}</span>`+comparisons.map(x=>`<span class="matchup-check ${x.ok?"pass":"fail"}">${escapeHtml(x.player)}：对位行和 ${fmtScore(x.rowTotal)} / 比赛 ${x.selected?(x.raw===""?"未填":fmtScore(x.score)):"缺席"}</span>`).join("");
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
      venue:$("#entryVenue").value||"未填写场地",notes:"MOAP云端网页录入 · 精准对位方向矩阵",
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

function fmtRivalValue(n){const v=Number(n||0);return rivalMode==="average"?`${v>0?"+":""}${v.toFixed(2)}`:fmtScore(v);}
function fmtRivalEaten(n){const v=Number(n||0);if(!v)return rivalMode==="average"?"0.00":"0";return rivalMode==="average"?`-${v.toFixed(2)}`:`-${Number.isInteger(v)?v:v.toFixed(2)}`;}
function rivalPairGames(a,b){
  return (state.rivalHistory?.[a]?.[b]||[]).length;
}
function rivalDisplayMatrix(){
  if(rivalMode==="cumulative")return state.rivalNet||{};
  const out={};
  (state.players||[]).forEach(a=>{out[a.name]={};(state.players||[]).forEach(b=>{
    if(a.playerId===b.playerId){out[a.name][b.name]=null;return;}
    const games=rivalPairGames(a.name,b.name);
    out[a.name][b.name]=games?Number(state.rivalNet?.[a.name]?.[b.name]||0)/games:0;
  });});
  return out;
}
function renderMatrix(target,dataMatrix,clickable=false){
  const names=state.players.map(p=>p.name);
  let html=`<thead><tr><th>攻击方（吃分） ↓</th>${names.map(n=>`<th>${escapeHtml(n)}</th>`).join("")}<th class="matrix-summary-head">吃分</th><th class="matrix-summary-head">被吃分</th><th class="matrix-summary-head">净分</th></tr></thead><tbody>`;
  const summaryRows=rivalSummaryForMode();
  names.forEach(a=>{
    const summary=summaryRows.find(r=>r.player===a)||{eat:0,eaten:0,total:0};
    html+=`<tr><td><div class="player-cell matchup-player-cell"><span class="avatar">${initials(a)}</span>${matchupPlayerNameHtml(a)}</div></td>`;
    names.forEach(b=>{
      if(a===b)html+=`<td class="matchup-diagonal">—</td>`;
      else{
        const v=Number(dataMatrix?.[a]?.[b]||0),cls=v>0?"pos":v<0?"neg":"neutral";
        html+=`<td><button type="button" class="matrix-cell ${cls}" ${clickable?`data-rival-a="${escapeHtml(a)}" data-rival-b="${escapeHtml(b)}"`:""}>${fmtRivalValue(v)}</button></td>`;
      }
    });
    html+=`<td class="matrix-summary-cell score-pos">${fmtRivalValue(summary.eat)}</td><td class="matrix-summary-cell score-neg">${fmtRivalEaten(summary.eaten)}</td><td class="matrix-summary-cell ${scoreClass(summary.total)}">${fmtRivalValue(summary.total)}</td></tr>`;
  });
  target.innerHTML=html+"</tbody>";
}
function rivalSummaryForMode(){
  const rows=[...(state.rivalSummary||[])];
  if(rivalMode==="cumulative")return rows;
  return rows.map(row=>{
    const name=row.player;
    const matchIds=new Set();
    Object.values(state.rivalHistory?.[name]||{}).forEach(items=>(items||[]).forEach(item=>matchIds.add(item.matchId)));
    const games=matchIds.size;
    return {...row,games,eat:games?Number(row.eat||0)/games:0,eaten:games?Number(row.eaten||0)/games:0,total:games?Number(row.total||0)/games:0};
  });
}
function renderRival(){
  const matrix=rivalDisplayMatrix();
  renderMatrix($("#netMatrix"),matrix,true);
  $$('[data-rival-a]').forEach(b=>b.addEventListener("click",()=>showRivalDetail(b.dataset.rivalA,b.dataset.rivalB)));
  const meta=state.rivalryMeta||{startDate:null,trackedMatches:0,entries:0};
  $("#rivalKpis").innerHTML=[
    ["统计起点",meta.startDate||"等待首场","旧比赛不参与推算"],
    ["已记录比赛",meta.trackedMatches+" 场","仅含精准对位明细"],
    ["矩阵方向格",meta.entries+" 条",`${meta.nonZeroEntries??0} 条非零`],
    ["当前口径",rivalMode==="average"?"场均":"累计",rivalMode==="average"?"方向净分÷共同记录场次":"方向原始格累计"]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>8?20:27}px">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  const rows=rivalSummaryForMode();
  $("#rivalSummaryTable").innerHTML=rows.map(r=>`<tr><td><div class="player-cell matchup-player-cell"><span class="avatar">${initials(r.player)}</span>${matchupPlayerNameHtml(r.player)}</div></td><td class="score-pos">${fmtRivalValue(r.eat)}</td><td class="score-neg">${fmtRivalEaten(r.eaten)}</td><td class="${scoreClass(r.total)}">${fmtRivalValue(r.total)}</td></tr>`).join("");
  if(!meta.entries){
    $("#rivalDetail").className="empty";$("#rivalDetail").textContent="暂无新制对位记录。";
    return;
  }
  if(selectedRivalPair)showRivalDetail(selectedRivalPair[0],selectedRivalPair[1]);
}
function setRivalMode(mode){
  rivalMode=mode==="average"?"average":"cumulative";
  $$('[data-rival-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.rivalMode===rivalMode));
  renderRival();
  animateNumbers($('.view[data-view="rival"]'));
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-rival-mode]");if(b)setRivalMode(b.dataset.rivalMode);});
function ensureRivalDetailModal(){
  if($("#rivalDetailModalBackdrop"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="rival-detail-modal-backdrop" id="rivalDetailModalBackdrop" hidden><section class="rival-detail-modal" role="dialog" aria-modal="true" aria-labelledby="rivalDetailModalTitle"><button type="button" class="rival-detail-modal-close" id="rivalDetailModalClose" aria-label="关闭">×</button><div id="rivalDetailModalBody"></div></section></div>`);
  $("#rivalDetailModalBackdrop").addEventListener("mousedown",e=>{if(e.target.id==="rivalDetailModalBackdrop")closeRivalDetailModal();});
  $("#rivalDetailModalClose").addEventListener("click",closeRivalDetailModal);
}
function closeRivalDetailModal(){
  const modal=$("#rivalDetailModalBackdrop");
  if(modal){modal.hidden=true;document.body.classList.remove("modal-open");}
}
function openRivalDetailModal(a,b){
  ensureRivalDetailModal();
  const history=state.rivalHistory?.[a]?.[b]||[];
  const reverseHistory=state.rivalHistory?.[b]?.[a]||[];
  const forward=Number(state.rivalNet?.[a]?.[b]||0),reverse=Number(state.rivalNet?.[b]?.[a]||0);
  const summarize=items=>({
    eat:items.filter(item=>Number(item.net)>0).reduce((sum,item)=>sum+Number(item.net),0),
    eaten:items.filter(item=>Number(item.net)<0).reduce((sum,item)=>sum+Math.abs(Number(item.net)),0),
    net:items.reduce((sum,item)=>sum+Number(item.net),0)
  });
  const f=summarize(history),r=summarize(reverseHistory);
  const rows=history.map((item,index)=>`<tr><td>${index+1}</td><td>${escapeHtml(item.matchId)}</td><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.venue||"—")}</td><td class="${scoreClass(item.net)}">${fmtScore(item.net)}</td></tr>`).join("");
  $("#rivalDetailModalBody").innerHTML=`<header class="rival-detail-modal-header"><div><p>精准对位明细</p><h2 id="rivalDetailModalTitle">${escapeHtml(a)} → ${escapeHtml(b)}</h2><strong>${history.length} 场方向记录 · 累计 ${fmtScore(forward)}</strong></div><span class="record-holder-badge">MATCHUP DETAIL</span></header>
    <div class="kpis rival-detail-kpis rival-detail-page-kpis">
      <div class="mini-stat"><span>${escapeHtml(a)}→${escapeHtml(b)} 净积分</span><strong class="${scoreClass(forward)}">${fmtScore(forward)}</strong></div>
      <div class="mini-stat"><span>吃分 / 被吃分</span><strong>${fmtScore(f.eat)} / ${f.eaten?`-${f.eaten}`:"0"}</strong></div>
      <div class="mini-stat"><span>${escapeHtml(b)}→${escapeHtml(a)} 净积分</span><strong class="${scoreClass(reverse)}">${fmtScore(reverse)}</strong></div>
      <div class="mini-stat"><span>反向吃分 / 被吃分</span><strong>${fmtScore(r.eat)} / ${r.eaten?`-${r.eaten}`:"0"}</strong></div>
    </div>
    <section class="record-modal-section"><h3>${escapeHtml(a)} → ${escapeHtml(b)} 比赛明细</h3>${history.length?`<div class="table-scroll"><table class="rival-detail-table"><thead><tr><th>#</th><th>比赛</th><th>日期</th><th>场地</th><th>方向分</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">这个方向暂时没有对位记录。</div>'}</section>
    <footer class="record-modal-footer">两个方向完全独立记录，不互为相反数；明细直接读取对应方向格。</footer>`;
  $("#rivalDetailModalBackdrop").hidden=false;
  document.body.classList.add("modal-open");
}
function showRivalDetail(a,b){
  selectedRivalPair=[a,b];
  const history=state.rivalHistory?.[a]?.[b]||[],reverseHistory=state.rivalHistory?.[b]?.[a]||[];
  const forwardRaw=Number(state.rivalNet?.[a]?.[b]||0),reverseRaw=Number(state.rivalNet?.[b]?.[a]||0);
  const forward=rivalMode==="average"&&history.length?forwardRaw/history.length:forwardRaw,reverse=rivalMode==="average"&&reverseHistory.length?reverseRaw/reverseHistory.length:reverseRaw;
  const summarize=items=>({
    eat:items.filter(item=>Number(item.net)>0).reduce((sum,item)=>sum+Number(item.net),0),
    eaten:items.filter(item=>Number(item.net)<0).reduce((sum,item)=>sum+Math.abs(Number(item.net)),0),
    net:items.reduce((sum,item)=>sum+Number(item.net),0)
  });
  let f=summarize(history),r=summarize(reverseHistory);
  if(rivalMode==="average"){if(history.length)f={eat:f.eat/history.length,eaten:f.eaten/history.length,net:f.net/history.length};if(reverseHistory.length)r={eat:r.eat/reverseHistory.length,eaten:r.eaten/reverseHistory.length,net:r.net/reverseHistory.length};}
  $("#rivalDetail").className="";
  $("#rivalDetail").innerHTML=`<div class="player-head"><span class="avatar">${initials(a)}</span><div><h3 style="margin:0">${escapeHtml(a)} → ${escapeHtml(b)}</h3><div class="muted" style="margin-top:5px">${rivalMode==="average"?"场均":"累计"}方向概览</div></div></div>
    <div class="kpis rival-detail-kpis" style="margin-top:16px">
      <div class="mini-stat"><span>${escapeHtml(a)}→${escapeHtml(b)} 净积分</span><strong class="${scoreClass(forward)}">${fmtRivalValue(forward)}</strong></div>
      <div class="mini-stat"><span>吃分 / 被吃分</span><strong>${fmtRivalValue(f.eat)} / ${fmtRivalEaten(f.eaten)}</strong></div>
      <div class="mini-stat"><span>${escapeHtml(b)}→${escapeHtml(a)} 净积分</span><strong class="${scoreClass(reverse)}">${fmtRivalValue(reverse)}</strong></div>
      <div class="mini-stat"><span>反向吃分 / 被吃分</span><strong>${fmtRivalValue(r.eat)} / ${fmtRivalEaten(r.eaten)}</strong></div>
    </div>
    <div class="validation">两个方向完全独立记录，不要求互为相反数。当前显示${rivalMode==="average"?"场均":"累计"}口径；逐场明细不在本页叠加。</div>
    <button type="button" class="btn rival-detail-open-btn" data-rival-detail-open="${escapeHtml(`${a}|${b}`)}">查看明细记录 · ${history.length}场</button>`;
}
document.addEventListener("click",e=>{
  const button=e.target.closest("[data-rival-detail-open]");
  if(!button)return;
  const [a,b]=button.dataset.rivalDetailOpen.split("|");
  openRivalDetailModal(a,b);
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeRivalDetailModal();});

function scopeOrder(scope){if(scope==="CAREER")return 999;const n=Number(String(scope).replace(/\D/g,""));return Number.isFinite(n)?n:500;}
function groupPlayerHonors(honors){
  const map=new Map();
  honors.forEach(h=>{const key=h.honorId;if(!map.has(key))map.set(key,{honorId:key,name:h.name,grade:h.grade,category:h.category,awards:[],points:0});const group=map.get(key);group.awards.push(h);group.points+=Number(h.points||0);});
  const catalogOrder=Object.fromEntries(HONOR_CATALOG.map((item,index)=>[item.honorId,index]));
  return [...map.values()].map(group=>({...group,awards:group.awards.sort((a,b)=>scopeOrder(a.scope)-scopeOrder(b.scope))})).sort((a,b)=>{
    const gradeOrder={A:1,B:2,C:3,D:4,"":5};return (gradeOrder[a.grade]||9)-(gradeOrder[b.grade]||9)||(catalogOrder[a.honorId]??999)-(catalogOrder[b.honorId]??999);
  });
}
function honorGroupHtml(pid,group){
  const scopes=group.awards.map(h=>h.scope==="CAREER"?"生涯":h.scope).join(" · ");
  return `<button type="button" class="honor-item honor-clickable honor-group-card honor-tier-${String(group.grade||"C").toLowerCase()}" data-honor-grade="${escapeHtml(group.grade||"C")}" data-honor-group="${escapeHtml(`${pid}|${group.honorId}`)}"><div class="honor-top"><div style="display:flex;align-items:center;gap:9px"><span class="grade ${group.grade}">${group.grade}</span><strong>${escapeHtml(group.name)}</strong></div><span class="chip gold">×${group.awards.length}</span></div><small>${escapeHtml(group.category||"官方荣誉")} · 累计 ${group.points} 荣誉分</small><div class="honor-scope-list">${escapeHtml(scopes)}</div><span class="honor-open-hint">点击查看各赛季评选过程与明细</span></button>`;
}
function profileHonorRowHtml(pid,group){
  const scopes=group.awards.map(h=>h.scope==="CAREER"?"生涯":h.scope).join(" · ");
  return `<button type="button" class="profile-honor-row honor-tier-${String(group.grade||"C").toLowerCase()}" data-honor-grade="${escapeHtml(group.grade||"C")}" data-honor-group="${escapeHtml(`${pid}|${group.honorId}`)}"><span class="grade ${group.grade}">${escapeHtml(group.grade)}</span><strong>${escapeHtml(group.name)}</strong><b>×${group.awards.length}</b><small>${escapeHtml(scopes)}</small></button>`;
}
function openAllPlayerHonorsModal(pid){
  const honors=state.honors?.[pid]||[],groups=groupPlayerHonors(honors),player=state.players.find(p=>p.playerId===pid)?.name||pid;
  ensureHonorModal();
  $("#honorModalBody").innerHTML=`<header class="honor-modal-header"><span class="honor-modal-grade grade A">荣</span><div><p>${escapeHtml(player)} · 官方荣誉履历</p><h2 id="honorModalTitle">全部荣誉</h2><strong>${groups.length}类奖项 · 生涯累计${honors.length}次</strong></div></header><div class="honor-modal-section"><div class="profile-honor-all-list">${groups.map(g=>profileHonorRowHtml(pid,g)).join("")||'<div class="empty">暂无荣誉记录</div>'}</div></div>`;
  revealHonorModal("mixed");
}

function honorHtml(h){
  const key=`${h.ownerPlayerId||""}|${h.scope}|${h.honorId}`;
  return `<button type="button" class="honor-item honor-clickable honor-tier-${String(h.grade||"C").toLowerCase()}" data-honor-grade="${escapeHtml(h.grade||"C")}" data-honor-key="${escapeHtml(key)}"><div class="honor-top"><div style="display:flex;align-items:center;gap:9px"><span class="grade ${h.grade}">${h.grade}</span><strong>${escapeHtml(h.name)}</strong></div><span class="chip">${escapeHtml(h.scope)}</span></div><small>${escapeHtml(h.category||"官方荣誉")} · 获奖值 ${typeof h.value==="number"?Number(h.value).toFixed(Number.isInteger(h.value)?0:2):escapeHtml(h.value)} · ${escapeHtml(h.status)}</small><span class="honor-open-hint">点击查看评选规则、完整排名与证据</span></button>`;
}
function formatHonorValue(value,unit=""){if(value===null||value===undefined)return "—";if(unit==="%")return `${(Number(value)*100).toFixed(1)}%`;if(typeof value==="number"&&!Number.isInteger(value))return `${value.toFixed(2)}${unit}`;return `${value}${unit}`;}
function ensureHonorModal(){
  if($("#honorModalBackdrop"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="honor-modal-backdrop" id="honorModalBackdrop" hidden><section class="honor-modal" role="dialog" aria-modal="true" aria-labelledby="honorModalTitle"><button type="button" class="honor-modal-close" id="honorModalClose" aria-label="关闭">×</button><div id="honorModalBody"></div></section></div>`);
  $("#honorModalBackdrop").addEventListener("mousedown",e=>{if(e.target.id==="honorModalBackdrop")closeHonorModal();});
  $("#honorModalClose").addEventListener("click",closeHonorModal);
}
function revealHonorModal(grade=""){
  const backdrop=$("#honorModalBackdrop");if(!backdrop)return;
  backdrop.hidden=false;document.body.classList.add("modal-open");
  animateNumbers($("#honorModalBody"));
  animateHonorDetails(backdrop,{open:true,grade});
}
function closeHonorModal(){
  const backdrop=$("#honorModalBackdrop");if(!backdrop||backdrop.hidden)return;
  animateHonorDetails(backdrop,{open:false,onComplete:()=>{
    backdrop.hidden=true;
    if($("#matchModalBackdrop")?.hidden!==false)document.body.classList.remove("modal-open");
  }});
}
function honorMetricEvidenceHtml(item){
  const evidence=item?.evidence||[];
  if(!evidence.length)return '<div class="empty compact">暂无需要逐场展开的原始比赛。</div>';
  let cumulative=0;
  return `<div class="honor-metric-evidence">${evidence.map(entry=>{
    const absent=!!entry.wasAbsent,score=absent?null:Number(entry.score),tag=entry.processTag?`<small>${escapeHtml(entry.processTag)}</small>`:"";
    const metricValue=absent?null:Number(entry.metricValue??score);
    if(!absent&&Number.isFinite(metricValue))cumulative+=metricValue;
    const bgr=entry.bgr!=null&&Number(entry.bgr)>0?` · BGR ${entry.bgr}`:"",counted=entry.metricValue!=null?` · 本项计入 ${fmtScore(metricValue)}`:"",running=!absent&&Number.isFinite(metricValue)?` · 过程累计 ${fmtScore(cumulative)}`:"";
    return `<button type="button" class="honor-evidence-match" data-honor-match-id="${escapeHtml(entry.matchId||"")}"><span><strong>${escapeHtml(entry.matchId||"—")} · ${escapeHtml(entry.date||"—")}</strong>${tag}<em>${escapeHtml(entry.matchType||"—")} · ${escapeHtml(entry.venue||"未填写场地")}${bgr}${counted}${running}${absent?" · 缺席":""}</em></span><b class="${absent?"":scoreClass(score)}">${absent?"缺席":fmtScore(score)}</b></button>`;
  }).join("")}</div>`;
}
function honorMetricChainHtml(item){
  const raw=item?.原始值??item?.结果??item?.数值??"—",standard=item?.标准分,contribution=item?.贡献分,weight=item?.权重;
  if(standard!=null&&contribution!=null&&weight)return `<div class="honor-calc-chain"><span>原始值 <b>${escapeHtml(raw)}</b></span><i>→</i><span>标准化 <b>${Number(standard).toFixed(2)}</b></span><i>→</i><span>× ${escapeHtml(weight)}</span><i>→</i><span>贡献分 <b>${Number(contribution).toFixed(2)}</b></span></div>`;
  return `<div class="honor-calc-chain"><span>官方统计结果 <b>${escapeHtml(raw)}</b></span>${item?.计算?`<i>·</i><span>${escapeHtml(item.计算)}</span>`:""}</div>`;
}
function honorMetricItemHtml(item,index,isComposite){
  const value=item?.原始值??item?.结果??item?.数值??"—",weight=item?.权重?` · ${item.权重}`:"";
  return `<article class="honor-metric-item"><div class="honor-metric-main"><span><b>条件${index+1}</b> ${escapeHtml(item?.指标||`指标${index+1}`)}${escapeHtml(weight)}</span><strong>${escapeHtml(value)}</strong>${isComposite&&item?.贡献分!=null?`<em>贡献 ${Number(item.贡献分).toFixed(2)}</em>`:""}</div><details class="honor-process-detail"><summary>查看过程明细</summary><div class="honor-process-detail-body">${honorMetricEvidenceHtml(item)}${honorMetricChainHtml(item)}</div></details></article>`;
}
function honorRankingCardHtml(row,isComposite,winners=[]){
  const formula=row.formula||[],winner=winners.includes(row.player),compact=isComposite?formula.map((item,index)=>`<span>${index+1}. ${escapeHtml(item.指标)} <b>${Number(item.贡献分||0).toFixed(2)}</b></span>`).join(""):"";
  const detailList=formula.map((item,index)=>honorMetricItemHtml(item,index,isComposite)).join("");
  return `<article class="honor-ranking-card ${winner?"is-winner":""}"><header><span class="rank ${row.rank===1?"top":""}">#${row.rank}</span><div><strong>${escapeHtml(row.player)}</strong>${winner?'<small>获奖牌手</small>':""}</div><b>${isComposite?`${Number(row.value||0).toFixed(2)} 综合分`:escapeHtml(formatHonorValue(row.value,row.unit))}</b></header>${isComposite?`<div class="honor-contribution-strip">${compact}</div><details class="honor-score-details"><summary>查看六项评分明细</summary><div class="honor-metric-list">${detailList}</div></details>`:`<div class="honor-metric-list">${detailList}</div>`}</article>`;
}
function honorDetailSections(h){
  const d=h.details||{},isComposite=h.honorId==="H001"||h.honorId==="H003",ranking=d.ranking||[],winners=d.winners||[];
  const cards=ranking.map(row=>honorRankingCardHtml(row,isComposite,winners)).join("")||'<div class="empty">暂无完整排名数据。</div>';
  return `<div class="honor-modal-section"><h3>评选规则</h3><p>${escapeHtml(d.rule||"暂无规则说明")}</p>${d.summary?`<p class="honor-modal-summary">${escapeHtml(d.summary)}</p>`:""}</div><div class="honor-modal-section"><h3>${isComposite?"完整排名 · 六项评分与过程证据":"完整排名 · 条件与过程证据"}</h3><div class="honor-ranking-cards">${cards}</div></div><footer class="honor-modal-footer">数据状态：${escapeHtml(d.calculationStatus||h.status)} · 荣誉分 ${Number(h.points||0)}</footer>`;
}

function openHonorModal(h){
  ensureHonorModal();const d=h.details||{};
  $("#honorModalBody").innerHTML=`<header class="honor-modal-header"><span class="honor-modal-grade grade ${h.grade}">${escapeHtml(h.grade)}</span><div><p>${escapeHtml(h.scope)} · ${escapeHtml(h.category||"官方荣誉")}</p><h2 id="honorModalTitle">${escapeHtml(h.name)}</h2><strong>${escapeHtml(d.winner||"—")} · ${escapeHtml(formatHonorValue(h.value,d.unit))}</strong></div></header>${honorDetailSections(h)}`;
  revealHonorModal(h.grade);
}
function openHonorGroupModal(pid,honorId){
  const awards=(state.honors?.[pid]||[]).filter(h=>h.honorId===honorId).sort((a,b)=>scopeOrder(a.scope)-scopeOrder(b.scope));if(!awards.length)return;
  const first=awards[0],player=state.players.find(p=>p.playerId===pid)?.name||pid,totalPoints=awards.reduce((sum,h)=>sum+Number(h.points||0),0);
  ensureHonorModal();
  const seasons=awards.map((h,index)=>`<details class="honor-season-detail" ${index===awards.length-1?"open":""}><summary><span><b>${escapeHtml(h.scope==="CAREER"?"生涯":h.scope)}</b> · ${escapeHtml(formatHonorValue(h.value,h.details?.unit))}</span><span>${Number(h.points||0)}分 · ${escapeHtml(h.status)}</span></summary><div class="honor-season-body">${honorDetailSections(h)}</div></details>`).join("");
  $("#honorModalBody").innerHTML=`<header class="honor-modal-header"><span class="honor-modal-grade grade ${first.grade}">${escapeHtml(first.grade)}</span><div><p>${escapeHtml(player)} · 官方荣誉汇总</p><h2 id="honorModalTitle">${escapeHtml(first.name)} ×${awards.length}</h2><strong>${awards.length}次获奖 · 累计 ${totalPoints} 荣誉分</strong></div></header><div class="honor-modal-section"><h3>赛季获奖明细</h3><div class="honor-season-stack">${seasons}</div></div>`;
  revealHonorModal(first.grade);
}

function openHonorBoardModal(season,honorId){
  const row=(state.honorBoard||[]).find(x=>x.scope===season&&x.honorId===honorId);if(!row)return;
  const synthetic={ownerPlayerId:row.winnerIds?.[0]||"",scope:row.scope,honorId:row.honorId,name:row.name,grade:row.grade,category:row.category,value:row.value,points:Number(row.points||honorCatalogItem(row.honorId)?.points||0),status:row.status,details:row.details||{rule:honorCatalogItem(row.honorId)?.rule||"",unit:row.unit,winner:row.winners?.join(" / ")||"—",winners:row.winners||[],ranking:[],formula:[],evidence:[],summary:row.summary||""}};
  openHonorModal(synthetic);
}
document.addEventListener("click",e=>{
  const board=e.target.closest("[data-honor-board]");if(board){const [season,hid]=board.dataset.honorBoard.split("|");openHonorBoardModal(season,hid);return;}
  const group=e.target.closest("[data-honor-group]");if(group){const [pid,hid]=group.dataset.honorGroup.split("|");openHonorGroupModal(pid,hid);return;}
  const card=e.target.closest("[data-honor-key]");if(!card)return;const [pid,scope,hid]=card.dataset.honorKey.split("|");const h=(state.honors[pid]||[]).find(x=>x.scope===scope&&x.honorId===hid);if(h)openHonorModal(h);
});
document.addEventListener("click",e=>{const match=e.target.closest("[data-honor-match-id]");if(match&&match.dataset.honorMatchId){openMatchModal(match.dataset.honorMatchId);}});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHonorModal();});
function renderGoatRows(sel,limit=5){
  const rows=[...(state.goat||[])].sort((a,b)=>a.rank-b.rank).slice(0,limit);
  $(sel).innerHTML=rows.map(r=>{
    const b=r.breakdown||{};
    const change=Number(r.indexChange||0);
    const changeText=change>0?`+${change.toFixed(1)}`:change<0?change.toFixed(1):"—";
    return `<div class="goat-row goat-row-v2" data-rank-movement="${Number(r.movement||0)}"><span class="rank ${r.rank===1?"top":""}">${r.rank}</span><div><div class="goat-row-title"><strong>${escapeHtml(r.player)}</strong><span class="muted">${escapeHtml(r.evaluation?.label||"")}</span></div><div class="goat-breakdown-mini"><span>荣誉 ${Number(b.honors?.score||0).toFixed(1)}</span><span>生涯 ${Number(b.career?.score||0).toFixed(1)}</span><span>纪录 ${Number(b.records?.score||0).toFixed(1)}</span><span>持续 ${Number(b.longevity?.score||0).toFixed(1)}</span></div><div class="bar"><i style="width:${Math.max(3,Math.min(100,Number(r.goatIndex||0)))}%"></i></div></div><div class="goat-score-v2"><b>${Number(r.goatIndex||0).toFixed(1)}</b><small class="${change>0?"score-pos":change<0?"score-neg":""}">${changeText}</small></div></div>`;
  }).join("")||'<div class="empty">暂无GOAT评分</div>';
}
function renderHonorSeasonBoard(){
  const season=$("#honorBoardSeason")?.value||(state.seasons||[]).map(x=>x.id).at(-1),rows=state.honorBoard||[];
  $("#honorSeasonBoard").innerHTML=HONOR_CATALOG.map(c=>{
    const r=rows.find(x=>x.scope===season&&x.honorId===c.honorId);
    const status=!r?(c.honorId==="H022"?"未达成":"未计算"):r.status;
    const winner=r?.winners?.length?r.winners.join(" / "):status==="PENDING_TIEBREAK"?"待定":status==="NOT_AWARDED"?"本季不颁发":"—";
    const statusClass=status==="PENDING_TIEBREAK"?"pending":status==="NOT_AWARDED"||status==="未达成"?"empty-state":"awarded";
    return `<button type="button" class="honor-board-card honor-board-clickable honor-tier-${String(c.grade||"C").toLowerCase()} ${statusClass}" data-honor-grade="${escapeHtml(c.grade||"C")}" data-honor-board="${escapeHtml(`${season}|${c.honorId}`)}"><div class="honor-top"><div style="display:flex;align-items:center;gap:9px"><span class="grade ${c.grade}">${c.grade}</span><strong>${escapeHtml(c.name)}</strong></div><span class="chip">${escapeHtml(season)}</span></div><b>${escapeHtml(winner)}</b><small>${escapeHtml(c.rule)}</small><span class="honor-open-hint">点击查看评选详情与过程证据</span>${c.allowTie?'<span class="tie-note">允许并列</span>':'<span class="unique-note">唯一获奖</span>'}</button>`;
  }).join("");
}
function renderHonorStats(){
  const pid=$("#honorPlayer").value||currentPlayer, p=state.profiles[pid];
  $("#honorStats").innerHTML=[
    ["荣誉排名","#"+p.honorRank],["荣誉总数",p.honorCount],["A级荣誉",p.gradeA],["B级荣誉",p.gradeB],["荣誉积分",p.honorPoints],["GOAT指数",Number(state.goat.find(x=>x.playerId===pid)?.goatIndex||0).toFixed(1)]
  ].map(x=>`<div class="mini-stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
}
function renderHonors(){
  renderGoatRows("#goatRanking");
  renderHonorStats();
  renderHonorSeasonBoard();
}
$("#honorPlayer").addEventListener("change",()=>{
  const target=$("#honorStats");
  transitionHonorContent({
    targets:target,
    update:renderHonorStats,
    onUpdated:()=>animateNumbers(target)
  });
});
$("#honorBoardSeason")?.addEventListener("change",()=>{
  const target=$("#honorSeasonBoard");
  transitionHonorContent({
    targets:target,
    update:renderHonorSeasonBoard,
    onUpdated:()=>animateNumbers(target),
    onComplete:()=>animateHonorCards(target)
  });
});

function renderSystem(){
  $("#systemKpis").innerHTML=[
    ["当前版本",state.version.version,"Official Feature Release"],["认证状态",state.version.certification,state.version.formulaIntegrity],
    ["数据规模",state.matches.length+" 场",state.meta.results+" 条原始成绩"],["系统健康",state.meta.healthScore+"%",`${state.healthChecks.filter(x=>x.result==="PASS").length}/${state.healthChecks.length} 检查通过`]
  ].map(x=>`<div class="card kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value" style="font-size:${String(x[1]).length>14?20:27}px">${x[1]}</div><div class="kpi-sub">${x[2]}</div></div>`).join("");
  $("#healthList").innerHTML=(state.healthChecks||[]).map(h=>{
    const details=(h.details||[]).length?`<div class="health-details">${h.details.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`:"";
    return `<div class="health-item ${h.result==="PASS"?"health-pass":"health-fail"}"><div><strong>${escapeHtml(h.item)}</strong><div class="muted health-evidence">${escapeHtml(h.id)} · ${escapeHtml(h.evidence||"")} · 异常 ${Number(h.found||0)}</div>${details}</div><span class="${h.result==="PASS"?"status-pass":"status-fail"}">${escapeHtml(h.result)}</span></div>`;
  }).join("");
  const v=state.version;
  $("#versionInfo").innerHTML=[
    ["发布日期",v.releaseDate],["发布阶段",v.releaseStage],["当前状态",v.currentStatus],
    ["GOAT模型",state.goatMethodology||"四维数据模型"],["v2.3.0更新",v.note]
  ].map(x=>`<div class="honor-item"><strong>${x[0]}</strong><small>${x[1]}</small></div>`).join("");
}

$("#exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="MOAP_cloud_data.json";a.click();URL.revokeObjectURL(a.href);
  toast("当前云端数据快照已导出");
});



function initImmersiveBackground(){
  const bg=$("#ambientBackground");
  if(!bg||bg.dataset.ready==="1")return;
  bg.dataset.ready="1";
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const lowCpu=Number(navigator.hardwareConcurrency||8)<=4;
  const lowMemory=Number(navigator.deviceMemory||8)<=4;
  if(reduced||lowCpu||lowMemory){
    document.documentElement.classList.add("ambient-reduced");
    return;
  }
  const finePointer=window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
  if(!finePointer)return;
  let raf=0,lastX=0,lastY=0;
  const apply=()=>{
    raf=0;
    const nx=(lastX/window.innerWidth-.5)*2;
    const ny=(lastY/window.innerHeight-.5)*2;
    bg.style.setProperty("--parallax-x",`${(nx*12).toFixed(2)}px`);
    bg.style.setProperty("--parallax-y",`${(ny*9).toFixed(2)}px`);
  };
  window.addEventListener("pointermove",e=>{
    lastX=e.clientX;lastY=e.clientY;
    if(!raf)raf=requestAnimationFrame(apply);
  },{passive:true});
  window.addEventListener("pointerleave",()=>{
    bg.style.setProperty("--parallax-x","0px");
    bg.style.setProperty("--parallax-y","0px");
  },{passive:true});
}

function boot(){
  initImmersiveBackground();
  initAnimationSystem();
  initNav(); populateSelects(); initEntry();
  $("#versionBadge").textContent=state.version.version;
  showView("overview",{immediate:true});appBooted=true;
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
