import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/+esm";
import { CERTIFIED_SNAPSHOT } from "./certified-data.js";
import { MOAP_CONFIG } from "./config.js";
import { canonicalizeMatchIds } from "./match-id.js";
import { correctSourceData } from "./source-data-corrections.js";
import { normalizeOfficialMatchArchive } from "./official-match-normalization.js";
import { calculateHonorSystem } from "./analytics-engine.js";
import { buildRecordCenter } from "./records-engine.js";
import { buildGoatSystem } from "./goat-engine.js";
import { ACHIEVEMENT_CATALOG, buildAchievementSystem } from "./achievements-engine.js";

const VIEW_ID="achievements";
const DATA_TTL=30000;
const OFFICIAL_IDS=new Set(["ACH001","ACH002","ACH003"]);
const CATEGORY_ORDER=["all","official","career","mvp","explosion","streak","special","history"];
const CATEGORY_LABELS={all:"全部",official:"官方荣誉",career:"生涯",mvp:"MVP",explosion:"爆发",streak:"连续",special:"特殊",history:"历史身份"};
const RARITY_ZH={standard:"普通",rare:"稀有",epic:"史诗",legendary:"传奇"};

let archive=null;
let achievementSystem=null;
let selectedPlayerId="";
let selectedCategory="all";
let selectedStatus="all";
let loadedAt=0;
let loadingPromise=null;
let achievementRouteActive=false;
let modalAchievement=null;

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const fmtScore=value=>value==null?"—":`${Number(value)>0?"+":""}${Number(value).toFixed(Number.isInteger(Number(value))?0:1)}`;

const EMBLEM_ICONS={
  "crown-laurel":'<path d="M38 62 30 42l17 9 13-23 13 23 17-9-8 20H38Z"/><path d="M35 69h50"/><path d="M28 88c8-12 17-18 29-19M92 88C84 76 75 70 63 69"/>',
  "peak-trophy":'<path d="m31 73 20-27 10 13 10-21 20 35"/><path d="M42 78h36v8H42z"/><path d="M49 86v8h22v-8"/>',
  "star-crown":'<path d="m60 30 7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2Z"/><path d="m40 85 8-8 12 8 12-8 8 8"/>',
  flag:'<path d="M43 91V31"/><path d="M44 34h34l-8 12 8 12H44"/>',
  milestone:'<path d="M35 82h50"/><path d="M42 74V52h14V38h14v36h14"/>',
  shield:'<path d="M60 27 85 37v20c0 18-10 30-25 38-15-8-25-20-25-38V37Z"/>',
  "laurel-shield":'<path d="M60 30 80 38v18c0 15-8 25-20 32-12-7-20-17-20-32V38Z"/><path d="M30 84c-9-12-11-27-5-40M90 84c9-12 11-27 5-40"/>',
  laurel:'<path d="M35 89c-13-15-17-35-8-55M85 89c13-15 17-35 8-55"/><path d="M39 92h42"/>',
  star:'<path d="m60 28 9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3Z"/>',
  "star-ring":'<circle cx="60" cy="60" r="31"/><path d="m60 39 6 12 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2Z"/>',
  "double-star":'<path d="m49 38 6 12 13 2-9 9 2 13-12-6-11 6 2-13-9-9 13-2Z"/><path d="m75 51 4 8 9 1-7 7 2 9-8-4-8 4 2-9-7-7 9-1Z"/>',
  "crown-star":'<path d="M34 61 30 42l17 10 13-24 13 24 17-10-5 19Z"/><path d="m60 67 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z"/>',
  starburst:'<path d="M60 25v18M60 77v18M25 60h18M77 60h18M35 35l13 13M72 72l13 13M85 35 72 48M48 72 35 85"/><path d="m60 44 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z"/>',
  flame:'<path d="M58 29c7 13 22 24 22 40 0 13-9 23-22 23S36 82 36 69c0-10 6-18 15-29 0 10 5 14 7 18 4-8 3-17 0-29Z"/>',
  "double-flame":'<path d="M48 34c5 10 15 18 15 30 0 10-7 18-17 18S29 74 29 64c0-8 5-15 11-23 0 7 4 10 6 13 3-6 3-13 2-20Z"/><path d="M76 47c5 8 12 14 12 23 0 9-6 16-15 16-5 0-9-2-12-5 7-5 10-11 10-19 0-5-1-9-3-13 3 2 5 4 8 7 2-4 2-6 0-9Z"/>',
  burst:'<path d="M60 24 67 43 85 35 77 53 97 60 77 67 85 85 67 77 60 97 53 77 35 85 43 67 23 60 43 53 35 35 53 43Z"/>',
  bolt:'<path d="M65 23 35 65h22l-4 32 32-47H63Z"/>',
  supernova:'<circle cx="60" cy="60" r="17"/><path d="M60 20v22M60 78v22M20 60h22M78 60h22M32 32l16 16M72 72l16 16M88 32 72 48M48 72 32 88"/><path d="m60 27 4 7 8-1-3 8 6 5-8 3-1 8-6-5-6 5-1-8-8-3 6-5-3-8 8 1Z"/>',
  chain:'<path d="M47 68 37 78a13 13 0 0 0 18 18l13-13"/><path d="m73 52 10-10a13 13 0 1 0-18-18L52 37"/><path d="m47 73 26-26"/>',
  "chain-shield":'<path d="M60 28 80 36v17c0 15-8 25-20 32-12-7-20-17-20-32V36Z"/><path d="m48 63 8 8 17-20"/>',
  "gold-chain":'<circle cx="43" cy="60" r="13"/><circle cx="77" cy="60" r="13"/><path d="M53 60h14"/><path d="M25 84c10 7 21 10 35 10s25-3 35-10"/>',
  "triple-crown":'<path d="m27 67-3-15 12 7 8-15 8 15 12-7-4 15Z"/><path d="m60 57-3-15 12 7 8-15 8 15 12-7-4 15Z"/><path d="M38 78h50"/>',
  "solo-sword":'<path d="m35 87 47-47 5-15-15 5-47 47Z"/><path d="m32 70 18 18M29 91l11-11"/><circle cx="82" cy="31" r="4"/>',
  "triple-blade":'<path d="m32 88 32-51 4-13 5 13-32 51M52 91l19-55 1-14 8 12-19 55M25 75l43-38 8-11 2 14-43 38"/>',
  scepter:'<path d="M60 32v55"/><circle cx="60" cy="27" r="10"/><path d="M47 87h26M50 95h20"/><path d="M29 60h20M71 60h20M35 45l14 8M85 45l-14 8"/>',
  comeback:'<path d="M25 78c17 0 18-36 36-36 10 0 17 7 24 18"/><path d="m75 50 10 10 10-10"/><path d="M28 91h64"/>',
  "spear-crown":'<path d="m31 92 47-61 9-5-2 10-47 61Z"/><path d="M46 45 41 31l13 8 7-14 8 14 13-8-5 15"/>',
  "goat-crown":'<path d="M31 61 27 39l19 11 14-26 14 26 19-11-5 22Z"/><path d="M36 68h48"/><path d="M43 91h34"/><path d="M50 76h20v15H50z"/>'
};

function ensureSection(){
  if($(`.view[data-view="${VIEW_ID}"]`))return;
  const main=$("main");
  if(!main)return;
  const section=document.createElement("section");
  section.className="view achievement-center-view";
  section.dataset.view=VIEW_ID;
  section.innerHTML=`
    <header class="achievement-masthead page-identity">
      <div class="page-identity-copy">
        <span class="page-identity-eyebrow achievement-eyebrow">成就档案 / MOAP</span>
        <h2 class="page-identity-title">成就中心</h2>
        <p class="page-identity-description">记录每位牌手在 MOAP 生涯中解锁的重要成就</p>
      </div>
      <div class="achievement-data-source page-identity-meta"><span>数据来源</span><strong id="achievementDataSource">等待载入</strong></div>
    </header>

    <section class="achievement-profile-stage" aria-labelledby="achievementProfileTitle">
      <div class="achievement-player-header">
        <div><span>01 / 成就档案</span><h3 id="achievementProfileTitle">选择牌手</h3><small id="achievementPlayerCode">—</small></div>
        <div class="achievement-player-tabs" id="achievementPlayerTabs" role="tablist" aria-label="切换牌手"></div>
      </div>
      <div class="achievement-summary-grid">
        <div><span>已解锁</span><strong id="achievementUnlocked">—</strong><small>已解锁 / 全部</small></div>
        <div><span>完成度</span><strong id="achievementCompletion">—</strong><small>生涯成就收集率</small></div>
        <div><span>传奇成就</span><strong id="achievementLegendary">—</strong><small>LEGENDARY</small></div>
        <div><span>最新解锁</span><strong id="achievementLatest">—</strong><small id="achievementLatestMeta">等待数据</small></div>
      </div>
    </section>

    <section class="achievement-official-stage" aria-labelledby="achievementOfficialTitle">
      <header class="achievement-section-head"><div><span>02 / MOAP OFFICIAL HONORS</span><h3 id="achievementOfficialTitle">官方荣誉</h3></div><small>正式荣誉 · 最高视觉规格</small></header>
      <div class="achievement-official-grid" id="achievementOfficialGrid"></div>
    </section>

    <section class="achievement-collection-stage" aria-labelledby="achievementCollectionTitle">
      <header class="achievement-section-head achievement-collection-head">
        <div><span>03 / ACHIEVEMENT COLLECTION</span><h3 id="achievementCollectionTitle">成就收藏</h3><small id="achievementCollectionCount">—</small></div>
        <div class="achievement-status-filter" id="achievementStatusFilter" role="group" aria-label="成就状态筛选">
          <button type="button" data-achievement-status="all" class="active">全部</button>
          <button type="button" data-achievement-status="unlocked">已解锁</button>
          <button type="button" data-achievement-status="locked">未解锁</button>
        </div>
      </header>
      <div class="achievement-category-tabs" id="achievementCategoryTabs" role="tablist" aria-label="成就分类"></div>
      <div class="achievement-grid" id="achievementGrid"></div>
    </section>

    <section class="achievement-recent-stage" aria-labelledby="achievementRecentTitle">
      <header class="achievement-section-head"><div><span>04 / RECENT UNLOCKS</span><h3 id="achievementRecentTitle">最近解锁</h3></div><small>最近达成的 5 项成就</small></header>
      <div class="achievement-recent-list" id="achievementRecentList"></div>
    </section>
  `;
  const records=$('.view[data-view="records"]');
  if(records?.nextSibling)records.parentNode.insertBefore(section,records.nextSibling);
  else main.appendChild(section);
  ensureModal();
  bindSectionEvents(section);
}

function navButton(){
  const button=document.createElement("button");
  button.type="button";
  button.className="nav-btn achievement-nav-btn";
  button.dataset.nav=VIEW_ID;
  button.textContent="成就中心";
  button.addEventListener("click",()=>openAchievementView());
  return button;
}

function ensureNavigation(){
  const desktop=$("#sidebarNav");
  if(desktop&&!desktop.querySelector(`[data-nav="${VIEW_ID}"]`)){
    const records=desktop.querySelector('[data-nav="records"]');
    if(records)records.after(navButton());
  }
  const mobile=$("#mobileNav");
  if(mobile&&!mobile.querySelector(`[data-nav="${VIEW_ID}"]`)){
    const records=mobile.querySelector('[data-nav="records"]');
    if(records)records.after(navButton());
  }
}

function positionDesktopIndicator(){
  const nav=$("#sidebarNav"),button=nav?.querySelector(`[data-nav="${VIEW_ID}"]`),indicator=nav?.querySelector(".nav-active-indicator");
  if(!button||!indicator)return;
  indicator.style.height=`${button.offsetHeight||41}px`;
  indicator.style.transform=`translate3d(0,${button.offsetTop}px,0)`;
  indicator.style.opacity="1";
}

function centerMobileNav(){
  const nav=$("#mobileNav"),button=nav?.querySelector(`[data-nav="${VIEW_ID}"]`);
  if(!nav||!button)return;
  const left=Math.max(0,button.offsetLeft-(nav.clientWidth-button.offsetWidth)/2);
  nav.scrollTo({left,behavior:"smooth"});
}

async function openAchievementView({playerId=null}={}){
  ensureSection();
  ensureNavigation();
  achievementRouteActive=true;
  $$(".view").forEach(view=>view.classList.toggle("active",view.dataset.view===VIEW_ID));
  $$('[data-nav]').forEach(button=>button.classList.toggle("active",button.dataset.nav===VIEW_ID));
  positionDesktopIndicator();
  centerMobileNav();
  window.scrollTo({top:0,behavior:"auto"});

  const playerSelect=$("#playerSelect");
  if(playerId)selectedPlayerId=playerId;
  else if(playerSelect?.value)selectedPlayerId=playerSelect.value;

  renderLoading();
  try{
    await ensureData();
    if(!selectedPlayerId||!archive.players.some(player=>player.playerId===selectedPlayerId))selectedPlayerId=archive.players[0]?.playerId||"";
    renderAchievements();
  }catch(error){
    renderError(error);
  }
}

function renderLoading(){
  const grid=$("#achievementGrid");
  if(grid&&!achievementSystem)grid.innerHTML='<div class="achievement-loading"><span></span><strong>正在读取成就档案</strong><small>同步云端牌局并回放历史解锁条件</small></div>';
}

function renderError(error){
  const grid=$("#achievementGrid");
  if(grid)grid.innerHTML=`<div class="achievement-error"><strong>成就档案暂时无法载入</strong><span>${escapeHtml(error?.message||"未知错误")}</span><button type="button" id="achievementRetry">重新载入</button></div>`;
  $("#achievementRetry")?.addEventListener("click",()=>{loadedAt=0;loadingPromise=null;openAchievementView({playerId:selectedPlayerId});});
}

async function fetchTable(sb,table){
  const {data,error}=await sb.from(table).select("*");
  if(error)throw new Error(`${table}: ${error.message}`);
  return data||[];
}

function certifiedArchive(){
  return {
    source:"认证基线",
    players:JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT.players||[])),
    matches:JSON.parse(JSON.stringify(CERTIFIED_SNAPSHOT.matches||[]))
  };
}

async function fetchArchive(){
  if(!MOAP_CONFIG.supabaseUrl||!MOAP_CONFIG.supabaseKey)return certifiedArchive();
  const sb=createClient(MOAP_CONFIG.supabaseUrl,MOAP_CONFIG.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try{
    const [players,seasons,matches,results]=await Promise.all([
      fetchTable(sb,"players"),fetchTable(sb,"seasons"),fetchTable(sb,"matches"),fetchTable(sb,"match_results")
    ]);
    if(!players.length||!matches.length||!results.length)throw new Error("云端数据为空");
    const normalized=normalizeOfficialMatchArchive(correctSourceData(canonicalizeMatchIds({players,seasons,matches,results,awards:[],matchups:[]}))).db;
    const mappedPlayers=normalized.players.map(player=>({playerId:player.id,name:player.name,joinSeason:player.join_season,status:player.active?"Active":"Inactive"}));
    const names=Object.fromEntries(mappedPlayers.map(player=>[player.playerId,player.name]));
    const resultMap={};
    normalized.results.forEach(result=>(resultMap[result.match_id]??=[]).push(result));
    const mappedMatches=normalized.matches.slice().sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date))||num(a.round)-num(b.round)||String(a.id).localeCompare(String(b.id))).map(match=>({
      matchId:match.id,
      season:match.season_id,
      round:match.round,
      date:match.match_date,
      matchType:match.match_type,
      venue:match.venue||"",
      results:(resultMap[match.id]||[]).map(result=>({
        playerId:result.player_id,
        player:names[result.player_id]||result.player_id,
        score:result.score==null?null:Number(result.score),
        isMvp:!!result.is_mvp,
        isAbsent:!!result.is_absent
      }))
    }));
    return {source:"SUPABASE · 云端实时",players:mappedPlayers,matches:mappedMatches};
  }catch(error){
    console.warn("Achievement center cloud read failed; using certified snapshot.",error);
    return {...certifiedArchive(),warning:error.message};
  }
}

async function buildHistoricalGoatFirst(players,matches){
  const first={};
  if(!matches.length)return first;
  for(let index=0;index<matches.length;index+=1){
    const prefix=matches.slice(0,index+1);
    const honorSystem=calculateHonorSystem(players,prefix);
    const recordCenter=buildRecordCenter(players,prefix);
    const goatRows=buildGoatSystem(players,prefix,honorSystem.honors,recordCenter).rows||[];
    const leaders=goatRows.filter(row=>row.rank===1);
    const match=prefix.at(-1);
    leaders.forEach(row=>{
      if(first[row.playerId])return;
      const result=match?.results?.find(item=>item.playerId===row.playerId);
      first[row.playerId]={
        matchId:match?.matchId||"",
        season:match?.season||"",
        round:match?.round??null,
        date:match?.date||"",
        matchType:match?.matchType||"",
        venue:match?.venue||"",
        playerId:row.playerId,
        player:row.player,
        score:result?.score==null?null:Number(result.score),
        isMvp:!!result?.isMvp,
        goatIndex:row.goatIndex,
        goatRank:1
      };
    });
    if(index%6===5)await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    if(Object.keys(first).length===players.length)break;
  }
  return first;
}

async function ensureData(){
  if(achievementSystem&&Date.now()-loadedAt<DATA_TTL)return;
  if(loadingPromise)return loadingPromise;
  loadingPromise=(async()=>{
    archive=await fetchArchive();
    const honorSystem=calculateHonorSystem(archive.players,archive.matches);
    achievementSystem=buildAchievementSystem(archive.players,archive.matches,{honors:honorSystem.honors,goatFirstByPlayer:{}});
    if(achievementRouteActive)renderAchievements({goatPending:true});
    const goatFirstByPlayer=await buildHistoricalGoatFirst(archive.players,archive.matches);
    achievementSystem=buildAchievementSystem(archive.players,archive.matches,{honors:honorSystem.honors,goatFirstByPlayer});
    loadedAt=Date.now();
    loadingPromise=null;
    if(achievementRouteActive)renderAchievements();
  })().catch(error=>{loadingPromise=null;throw error;});
  return loadingPromise;
}

function categoryCounts(profile){
  const counts={all:profile.achievements.length};
  Object.keys(CATEGORY_LABELS).forEach(key=>{if(key!=="all")counts[key]=profile.achievements.filter(item=>item.category===key).length;});
  return counts;
}

function renderAchievements({goatPending=false}={}){
  if(!achievementSystem||!selectedPlayerId)return;
  const profile=achievementSystem.byPlayer[selectedPlayerId];
  if(!profile)return;
  const player=archive.players.find(item=>item.playerId===selectedPlayerId);
  $("#achievementDataSource").textContent=archive.warning?"认证基线 · 云端读取异常":archive.source;
  $("#achievementProfileTitle").textContent=player?.name||profile.player;
  $("#achievementPlayerCode").textContent=`${selectedPlayerId} · ACHIEVEMENT PROFILE${goatPending?" · GOAT历史回放中":""}`;
  $("#achievementUnlocked").textContent=`${profile.unlocked} / ${profile.total}`;
  $("#achievementCompletion").textContent=`${profile.completion.toFixed(0)}%`;
  $("#achievementLegendary").textContent=String(profile.legendary);
  $("#achievementLatest").textContent=profile.latest?.title||"尚未解锁";
  $("#achievementLatestMeta").textContent=profile.latest?.evidence?.date?`${profile.latest.evidence.season||""} · ${profile.latest.evidence.date}`:"等待首次达成";

  renderPlayerTabs(profile.playerId);
  renderCategoryTabs(profile);
  renderOfficial(profile);
  renderCollection(profile);
  renderRecent(profile);
  injectProfileAchievementLink();
}

function renderPlayerTabs(activeId){
  const host=$("#achievementPlayerTabs");
  if(!host)return;
  host.innerHTML=archive.players.map(player=>`<button type="button" role="tab" data-achievement-player="${escapeHtml(player.playerId)}" aria-selected="${player.playerId===activeId}" class="${player.playerId===activeId?"active":""}">${escapeHtml(player.name)}</button>`).join("");
}

function renderCategoryTabs(profile){
  const host=$("#achievementCategoryTabs"),counts=categoryCounts(profile);
  if(!host)return;
  host.innerHTML=CATEGORY_ORDER.map(category=>`<button type="button" role="tab" data-achievement-category="${category}" aria-selected="${category===selectedCategory}" class="${category===selectedCategory?"active":""}"><span>${CATEGORY_LABELS[category]}</span><small>${counts[category]||0}</small></button>`).join("");
}

function emblemSvg(item,{large=false}={}){
  const paths=EMBLEM_ICONS[item.icon]||EMBLEM_ICONS.star;
  const mark=item.mark?`<text x="60" y="66" text-anchor="middle" class="achievement-emblem-mark">${escapeHtml(item.mark)}</text>`:"";
  return `<svg class="achievement-emblem-svg ${large?"is-large":""}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <path class="achievement-emblem-frame" d="M60 7 98 28v44L60 113 22 92V28Z"/>
    <circle class="achievement-emblem-ring" cx="60" cy="60" r="43"/>
    <g class="achievement-emblem-rays"><path d="M60 13v10M60 97v10M13 60h10M97 60h10M27 27l8 8M85 85l8 8M93 27l-8 8M35 85l-8 8"/></g>
    <g class="achievement-emblem-glyph">${paths}</g>${mark}
  </svg>`;
}

function achievementCard(item,{official=false}={}){
  const state=item.unlocked?"is-unlocked":"is-locked";
  const progress=item.progress&&!item.unlocked?`<div class="achievement-progress"><div><span>${escapeHtml(item.progress.label)}</span><b>${Math.round(item.progress.percent)}%</b></div><i><em style="width:${Math.max(0,Math.min(100,item.progress.percent))}%"></em></i></div>`:"";
  const meta=item.unlocked?unlockMeta(item):"尚未达成";
  const repeat=item.count>1&&item.honorId?`<span class="achievement-repeat">×${item.count}</span>`:"";
  return `<button type="button" class="achievement-card ${state} rarity-${item.rarity} ${official?"is-official":""}" data-achievement-id="${item.id}">
    <div class="achievement-card-top"><span>${item.rarityLabel}</span>${item.unlocked?'<b class="achievement-unlocked-check">✓</b>':'<b class="achievement-lock-dot"></b>'}</div>
    <div class="achievement-emblem-wrap">${emblemSvg(item,{large:official})}${repeat}</div>
    <div class="achievement-card-copy"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.description)}</p></div>
    ${progress||`<div class="achievement-card-meta">${escapeHtml(meta)}</div>`}
  </button>`;
}

function unlockMeta(item){
  const evidence=item.evidence||{};
  if(item.honorId)return [evidence.awardScope||evidence.season,item.count>1?`累计 ${item.count} 次`:"已解锁"].filter(Boolean).join(" · ");
  return [evidence.season,evidence.matchId].filter(Boolean).join(" · ")||"已解锁";
}

function renderOfficial(profile){
  const host=$("#achievementOfficialGrid");
  if(!host)return;
  host.innerHTML=profile.achievements.filter(item=>OFFICIAL_IDS.has(item.id)).map(item=>achievementCard(item,{official:true})).join("");
}

function filteredCollection(profile){
  return profile.achievements.filter(item=>!OFFICIAL_IDS.has(item.id)).filter(item=>selectedCategory==="all"||item.category===selectedCategory).filter(item=>selectedStatus==="all"||(selectedStatus==="unlocked"?item.unlocked:!item.unlocked));
}

function renderCollection(profile){
  const rows=filteredCollection(profile),host=$("#achievementGrid");
  if($("#achievementCollectionCount"))$("#achievementCollectionCount").textContent=`显示 ${rows.length} / ${profile.achievements.length-3} 枚收藏成就`;
  if(!host)return;
  host.innerHTML=rows.length?rows.map(item=>achievementCard(item)).join(""):'<div class="achievement-empty">当前筛选条件下没有成就。</div>';
}

function renderRecent(profile){
  const host=$("#achievementRecentList");
  if(!host)return;
  host.innerHTML=profile.recent.length?profile.recent.map((item,index)=>`<button type="button" class="achievement-recent-row" data-achievement-id="${item.id}"><span>${String(index+1).padStart(2,"0")}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></div><b>${escapeHtml([item.evidence?.season,item.evidence?.matchId].filter(Boolean).join(" · ")||item.evidence?.awardScope||"已解锁")}</b></button>`).join(""):'<div class="achievement-empty">暂无已解锁成就。</div>';
}

function bindSectionEvents(section){
  section.addEventListener("click",event=>{
    const player=event.target.closest("[data-achievement-player]");
    if(player){selectedPlayerId=player.dataset.achievementPlayer;renderAchievements();return;}
    const category=event.target.closest("[data-achievement-category]");
    if(category){selectedCategory=category.dataset.achievementCategory;renderAchievements();return;}
    const status=event.target.closest("[data-achievement-status]");
    if(status){selectedStatus=status.dataset.achievementStatus;$$('[data-achievement-status]').forEach(button=>button.classList.toggle("active",button.dataset.achievementStatus===selectedStatus));renderCollection(achievementSystem.byPlayer[selectedPlayerId]);return;}
    const card=event.target.closest("[data-achievement-id]");
    if(card)openAchievementModal(card.dataset.achievementId);
  });
}

function ensureModal(){
  if($("#achievementModalBackdrop"))return;
  const backdrop=document.createElement("div");
  backdrop.id="achievementModalBackdrop";
  backdrop.className="achievement-modal-backdrop";
  backdrop.hidden=true;
  backdrop.innerHTML='<section class="achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievementModalTitle"><button type="button" class="achievement-modal-close" aria-label="关闭">×</button><div id="achievementModalBody"></div></section>';
  document.body.appendChild(backdrop);
  backdrop.addEventListener("mousedown",event=>{if(event.target===backdrop)closeAchievementModal();});
  backdrop.querySelector(".achievement-modal-close").addEventListener("click",closeAchievementModal);
}

function openAchievementModal(id){
  const profile=achievementSystem?.byPlayer?.[selectedPlayerId];
  const item=profile?.achievements?.find(achievement=>achievement.id===id);
  if(!item)return;
  modalAchievement=item;
  const body=$("#achievementModalBody"),evidence=item.evidence||{};
  const progress=!item.unlocked&&item.progress?`<div class="achievement-modal-progress"><div><span>当前进度</span><strong>${escapeHtml(item.progress.label)}</strong></div><i><em style="width:${Math.max(0,Math.min(100,item.progress.percent))}%"></em></i></div>`:"";
  const facts=item.unlocked?`
    <div class="achievement-modal-facts">
      <div><span>解锁状态</span><b>已达成</b></div>
      <div><span>首次解锁</span><b>${escapeHtml([evidence.season||evidence.awardScope,evidence.matchId].filter(Boolean).join(" · ")||"已记录")}</b></div>
      <div><span>日期</span><b>${escapeHtml(evidence.date||"赛季结算")}</b></div>
      ${evidence.score!=null?`<div><span>成绩</span><b class="${evidence.score>=0?"is-positive":"is-negative"}">${fmtScore(evidence.score)}</b></div>`:""}
      ${evidence.matchId?`<div><span>当场MVP</span><b>${evidence.isMvp?"是":"否"}</b></div>`:""}
      ${item.honorId&&item.count>1?`<div><span>累计获得</span><b>${item.count} 次</b></div>`:""}
    </div>`:`<div class="achievement-modal-locked"><span>当前状态</span><strong>尚未达成</strong><p>完成条件后，徽章将自动点亮，并记录首次达成证据。</p></div>`;
  body.innerHTML=`
    <div class="achievement-modal-hero rarity-${item.rarity} ${item.unlocked?"is-unlocked":"is-locked"}">
      <div class="achievement-modal-emblem">${emblemSvg(item,{large:true})}</div>
      <div><span>${item.rarityLabel} · ${RARITY_ZH[item.rarity]}</span><h2 id="achievementModalTitle">${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p></div>
    </div>
    ${progress}${facts}
    ${evidence.matchId?`<button type="button" class="achievement-go-match" data-achievement-go-match="${escapeHtml(evidence.matchId)}">前往牌局中心 · ${escapeHtml(evidence.matchId)}</button>`:""}
  `;
  body.querySelector("[data-achievement-go-match]")?.addEventListener("click",event=>goToMatchCenter(event.currentTarget.dataset.achievementGoMatch));
  const backdrop=$("#achievementModalBackdrop");
  backdrop.hidden=false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(()=>backdrop.classList.add("is-open"));
}

function closeAchievementModal(){
  const backdrop=$("#achievementModalBackdrop");
  if(!backdrop||backdrop.hidden)return;
  backdrop.classList.remove("is-open");
  window.setTimeout(()=>{backdrop.hidden=true;if(!document.querySelector('.honor-modal-backdrop:not([hidden])'))document.body.classList.remove("modal-open");},160);
  modalAchievement=null;
}

function goToMatchCenter(matchId){
  closeAchievementModal();
  const nav=$('[data-nav="matches"]');
  nav?.click();
  window.setTimeout(()=>{
    const input=$("#matchQuery");
    if(!input)return;
    input.value=matchId;
    input.dispatchEvent(new Event("input",{bubbles:true}));
    input.dispatchEvent(new Event("change",{bubbles:true}));
    input.focus();
  },220);
}

function injectProfileAchievementLink(){
  const archiveSection=$('.view[data-view="player"] .profile-honors-home');
  if(!archiveSection||archiveSection.querySelector(".profile-achievement-link"))return;
  const button=document.createElement("button");
  button.type="button";
  button.className="profile-achievement-link";
  button.textContent="查看完整成就 →";
  button.addEventListener("click",()=>openAchievementView({playerId:$("#playerSelect")?.value||selectedPlayerId}));
  archiveSection.querySelector(".profile-honors-head")?.appendChild(button);
}

function installProfileObserver(){
  const target=$("main");
  if(!target)return;
  const observer=new MutationObserver(()=>injectProfileAchievementLink());
  observer.observe(target,{subtree:true,childList:true});
  injectProfileAchievementLink();
}

function installNavObserver(){
  const target=$("#sidebarNav");
  if(target)new MutationObserver(()=>ensureNavigation()).observe(target,{childList:true,subtree:true});
  const mobile=$("#mobileNav");
  if(mobile)new MutationObserver(()=>ensureNavigation()).observe(mobile,{childList:true,subtree:true});
}

function boot(){
  ensureSection();
  ensureNavigation();
  installNavObserver();
  installProfileObserver();
  document.addEventListener("click",event=>{
    const nav=event.target.closest("[data-nav]");
    if(nav&&nav.dataset.nav!==VIEW_ID){achievementRouteActive=false;closeAchievementModal();}
  },true);
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeAchievementModal();});
  window.addEventListener("resize",()=>{if(achievementRouteActive){positionDesktopIndicator();centerMobileNav();}},{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();
