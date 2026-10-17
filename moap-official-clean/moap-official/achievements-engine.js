const CATEGORY_LABELS = Object.freeze({
  official: "官方荣誉",
  career: "生涯",
  mvp: "MVP",
  explosion: "爆发",
  streak: "连续",
  special: "特殊",
  history: "历史身份"
});

const RARITY_LABELS = Object.freeze({
  standard: "STANDARD",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY"
});

export const ACHIEVEMENT_CATALOG = Object.freeze([
  {id:"ACH001",title:"赛季之王",category:"official",rarity:"legendary",description:"首次获得 MOAP 赛季总冠军。",icon:"crown-laurel",honorId:"H001"},
  {id:"ACH002",title:"巅峰桂冠",category:"official",rarity:"legendary",description:"首次获得 MOAP 巅峰赛冠军。",icon:"peak-trophy",honorId:"H002"},
  {id:"ACH003",title:"年度之星",category:"official",rarity:"legendary",description:"首次获得 MOAP 年度最有价值牌手。",icon:"star-crown",honorId:"H003"},

  {id:"ACH004",title:"初次登场",category:"career",rarity:"standard",description:"完成 1 场正式 MOAP 牌局。",icon:"flag",metric:"games",target:1},
  {id:"ACH005",title:"渐入佳境",category:"career",rarity:"standard",description:"累计参加 10 场正式牌局。",icon:"milestone",mark:"10",metric:"games",target:10},
  {id:"ACH006",title:"历练之路",category:"career",rarity:"standard",description:"累计参加 25 场正式牌局。",icon:"shield",mark:"25",metric:"games",target:25},
  {id:"ACH007",title:"半百征程",category:"career",rarity:"rare",description:"累计参加 50 场正式牌局。",icon:"shield",mark:"50",metric:"games",target:50},
  {id:"ACH008",title:"常青之路",category:"career",rarity:"epic",description:"累计参加 75 场正式牌局。",icon:"laurel-shield",mark:"75",metric:"games",target:75},
  {id:"ACH009",title:"百场传奇",category:"career",rarity:"legendary",description:"累计参加 100 场正式牌局。",icon:"laurel",mark:"100",metric:"games",target:100},

  {id:"ACH010",title:"第一颗星",category:"mvp",rarity:"standard",description:"首次获得 MVP。",icon:"star",metric:"mvps",target:1},
  {id:"ACH011",title:"星光初现",category:"mvp",rarity:"standard",description:"生涯累计获得 5 次 MVP。",icon:"star-ring",mark:"5",metric:"mvps",target:5},
  {id:"ACH012",title:"MVP常客",category:"mvp",rarity:"rare",description:"生涯累计获得 10 次 MVP。",icon:"double-star",mark:"10",metric:"mvps",target:10},
  {id:"ACH013",title:"MVP大师",category:"mvp",rarity:"epic",description:"生涯累计获得 20 次 MVP。",icon:"crown-star",mark:"20",metric:"mvps",target:20},
  {id:"ACH014",title:"四星闪耀",category:"mvp",rarity:"epic",description:"首次获得 4 星 MVP。",icon:"starburst",mark:"4★",metric:"mvpStars",target:4,exactStar:4},
  {id:"ACH015",title:"五星加冕",category:"mvp",rarity:"legendary",description:"首次获得 5 星 MVP。",icon:"crown-star",mark:"5★",metric:"mvpStars",target:5,exactStar:5},

  {id:"ACH016",title:"锋芒初现",category:"explosion",rarity:"standard",description:"单场最终积分达到 +50。",icon:"flame",metric:"score",target:50},
  {id:"ACH017",title:"强势爆发",category:"explosion",rarity:"rare",description:"单场最终积分达到 +65。",icon:"double-flame",metric:"score",target:65},
  {id:"ACH018",title:"火力全开",category:"explosion",rarity:"rare",description:"单场最终积分达到 +80。",icon:"burst",metric:"score",target:80},
  {id:"ACH019",title:"九十之境",category:"explosion",rarity:"epic",description:"单场最终积分达到 +90。",icon:"bolt",mark:"90",metric:"score",target:90},
  {id:"ACH020",title:"破百时刻",category:"explosion",rarity:"legendary",description:"单场最终积分达到 +100。",icon:"burst",mark:"100",metric:"score",target:100},
  {id:"ACH021",title:"极境爆发",category:"explosion",rarity:"legendary",description:"单场最终积分达到 +120。",icon:"supernova",mark:"120",metric:"score",target:120},

  {id:"ACH022",title:"稳定序章",category:"streak",rarity:"standard",description:"连续 3 场实际参赛保持非负分。",icon:"chain",mark:"3",metric:"positiveStreak",target:3},
  {id:"ACH023",title:"五场不败",category:"streak",rarity:"rare",description:"连续 5 场实际参赛保持非负分。",icon:"chain-shield",mark:"5",metric:"positiveStreak",target:5},
  {id:"ACH024",title:"黄金七连",category:"streak",rarity:"epic",description:"连续 7 场实际参赛保持非负分。",icon:"gold-chain",mark:"7",metric:"positiveStreak",target:7},
  {id:"ACH025",title:"双星连耀",category:"streak",rarity:"rare",description:"连续 2 场实际参赛获得 MVP。",icon:"double-star",mark:"2",metric:"mvpStreak",target:2},
  {id:"ACH026",title:"三冠连城",category:"streak",rarity:"legendary",description:"连续 3 场实际参赛获得 MVP。",icon:"triple-crown",mark:"3",metric:"mvpStreak",target:3},

  {id:"ACH027",title:"独行赢家",category:"special",rarity:"rare",description:"首次在正式牌局中完成独赢。",icon:"solo-sword",metric:"soloWins",target:1},
  {id:"ACH028",title:"三度独行",category:"special",rarity:"epic",description:"生涯累计完成 3 次独赢。",icon:"triple-blade",mark:"3",metric:"soloWins",target:3},
  {id:"ACH029",title:"极限统治",category:"special",rarity:"epic",description:"单场本人积分减去其他实际参赛牌手平均积分达到 +100。",icon:"scepter",metric:"dominance",target:100},
  {id:"ACH030",title:"绝地反击",category:"special",rarity:"epic",description:"上一场实际参赛 ≤ -50，下一场实际参赛 ≥ +50。",icon:"comeback",metric:"comeback"},
  {id:"ACH031",title:"一骑绝尘",category:"special",rarity:"legendary",description:"单场排名第 1，且领先第 2 名至少 80 分。",icon:"spear-crown",metric:"lead",target:80},

  {id:"ACH032",title:"登顶 GOAT",category:"history",rarity:"legendary",description:"任意一场正式牌局结束后，GOAT 历史排名达到第 1。",icon:"goat-crown",metric:"goat"}
].map(item=>Object.freeze({...item,categoryLabel:CATEGORY_LABELS[item.category],rarityLabel:RARITY_LABELS[item.rarity]})));

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

function orderedMatches(matches){
  return [...(matches||[])].sort((a,b)=>
    String(a.date||"").localeCompare(String(b.date||"")) ||
    num(a.round)-num(b.round) ||
    String(a.matchId||"").localeCompare(String(b.matchId||""))
  );
}

function playedRows(match){
  return (match?.results||[]).filter(row=>!row.isAbsent&&row.score!=null);
}

function mvpStarLevel(score){
  const value=num(score);
  if(value>=100)return 5;
  if(value>=80)return 4;
  if(value>=65)return 3;
  if(value>=50)return 2;
  return 1;
}

function evidenceFrom(match,result,extra={}){
  if(!match)return null;
  return {
    matchId:match.matchId||"",
    season:match.season||"",
    round:match.round??null,
    date:match.date||"",
    matchType:match.matchType||"",
    venue:match.venue||"",
    playerId:result?.playerId||extra.playerId||"",
    player:result?.player||extra.player||"",
    score:result?.score==null?null:num(result.score),
    isMvp:!!result?.isMvp,
    ...extra
  };
}

function playerEntries(player,matches){
  const entries=[];
  for(const match of matches){
    const result=(match.results||[]).find(row=>row.playerId===player.playerId);
    if(!result||result.isAbsent||result.score==null)continue;
    const rows=playedRows(match);
    const opponents=rows.filter(row=>row.playerId!==player.playerId);
    const opponentAverage=opponents.length?opponents.reduce((sum,row)=>sum+num(row.score),0)/opponents.length:0;
    const sorted=[...rows].sort((a,b)=>num(b.score)-num(a.score)||String(a.playerId).localeCompare(String(b.playerId)));
    const leader=sorted[0];
    const second=sorted[1];
    const nonNegative=rows.filter(row=>num(row.score)>=0);
    const solo=nonNegative.length===1&&nonNegative[0].playerId===player.playerId&&rows.every(row=>row.playerId===player.playerId||num(row.score)<0);
    entries.push({
      match,
      result,
      score:num(result.score),
      isMvp:!!result.isMvp,
      mvpStars:result.isMvp?mvpStarLevel(result.score):0,
      solo,
      dominance:num(result.score)-opponentAverage,
      lead:leader?.playerId===player.playerId&&second?num(leader.score)-num(second.score):null
    });
  }
  return entries;
}

function firstCountEvidence(entries,predicate,target){
  let count=0;
  for(const entry of entries){
    if(!predicate(entry))continue;
    count+=1;
    if(count>=target)return evidenceFrom(entry.match,entry.result,{count});
  }
  return null;
}

function firstThresholdEvidence(entries,getter,target){
  for(const entry of entries){
    const value=getter(entry);
    if(Number.isFinite(value)&&value>=target)return evidenceFrom(entry.match,entry.result,{value});
  }
  return null;
}

function firstStreakEvidence(entries,predicate,target){
  let streak=0;
  for(const entry of entries){
    streak=predicate(entry)?streak+1:0;
    if(streak>=target)return evidenceFrom(entry.match,entry.result,{streak});
  }
  return null;
}

function currentStreak(entries,predicate){
  let streak=0;
  for(let i=entries.length-1;i>=0;i-=1){
    if(predicate(entries[i]))streak+=1;
    else break;
  }
  return streak;
}

function firstComebackEvidence(entries){
  for(let i=1;i<entries.length;i+=1){
    if(entries[i-1].score<=-50&&entries[i].score>=50){
      return evidenceFrom(entries[i].match,entries[i].result,{previousScore:entries[i-1].score,previousMatchId:entries[i-1].match.matchId});
    }
  }
  return null;
}

function seasonEndMatch(matches,season){
  return [...matches].filter(match=>match.season===season).at(-1)||null;
}

function honorEvidence(playerId,honorId,honors,matches){
  const awards=(honors?.[playerId]||[])
    .filter(award=>award.honorId===honorId)
    .sort((a,b)=>String(a.scope||"").localeCompare(String(b.scope||""),undefined,{numeric:true}));
  if(!awards.length)return {evidence:null,count:0,awards:[]};

  const award=awards[0];
  const settlementHonor=honorId==="H001"||honorId==="H003";
  const direct=settlementHonor?null:(award.details?.evidence||[]).find(item=>item?.matchId);
  const match=settlementHonor
    ? seasonEndMatch(matches,award.scope)
    : (direct?matches.find(item=>item.matchId===direct.matchId):seasonEndMatch(matches,award.scope));
  const result=match?.results?.find(row=>row.playerId===playerId);
  const evidenceType=settlementHonor?"season_settlement":"direct_match";

  return {
    evidence:match
      ? evidenceFrom(match,result,{awardScope:award.scope,awardName:award.name||"",evidenceType})
      : {season:award.scope||"",awardScope:award.scope||"",awardName:award.name||"",evidenceType:"season_settlement"},
    count:awards.length,
    awards
  };
}

function progress(value,target,{prefix="",suffix=""}={}){
  const safeTarget=Math.max(1,num(target));
  const safeValue=Math.max(0,num(value));
  return {
    value:safeValue,
    target:safeTarget,
    percent:clamp(safeValue/safeTarget*100,0,100),
    label:`${prefix}${safeValue}${suffix} / ${prefix}${safeTarget}${suffix}`
  };
}

function scoreProgress(value,target){
  const current=Number.isFinite(Number(value))?num(value):0;
  return {
    value:current,
    target,
    percent:clamp(Math.max(0,current)/target*100,0,100),
    label:`个人最高 ${current>0?"+":""}${current} / +${target}`
  };
}

function resultForDefinition(def,{player,entries,honors,matches,goatFirstByPlayer}){
  if(def.honorId){
    const found=honorEvidence(player.playerId,def.honorId,honors,matches);
    return {unlocked:!!found.evidence,evidence:found.evidence,count:found.count,progress:null};
  }

  if(def.metric==="games"){
    const evidence=entries.length>=def.target?evidenceFrom(entries[def.target-1].match,entries[def.target-1].result,{count:def.target}):null;
    return {unlocked:!!evidence,evidence,count:entries.length,progress:progress(entries.length,def.target)};
  }

  if(def.metric==="mvps"){
    const mvps=entries.filter(entry=>entry.isMvp);
    const evidence=mvps.length>=def.target?evidenceFrom(mvps[def.target-1].match,mvps[def.target-1].result,{count:def.target}):null;
    return {unlocked:!!evidence,evidence,count:mvps.length,progress:progress(mvps.length,def.target)};
  }

  if(def.metric==="mvpStars"){
    const evidence=entries.find(entry=>entry.isMvp&&entry.mvpStars===def.exactStar);
    const best=Math.max(0,...entries.filter(entry=>entry.isMvp).map(entry=>entry.mvpStars));
    return {unlocked:!!evidence,evidence:evidence?evidenceFrom(evidence.match,evidence.result,{starLevel:evidence.mvpStars}):null,count:best,progress:evidence?null:{value:best,target:def.target,percent:clamp(best/def.target*100,0,100),label:`最高 ${best}★ / ${def.target}★`}};
  }

  if(def.metric==="score"){
    const evidence=firstThresholdEvidence(entries,entry=>entry.score,def.target);
    const best=entries.length?Math.max(...entries.map(entry=>entry.score)):0;
    return {unlocked:!!evidence,evidence,count:best,progress:scoreProgress(best,def.target)};
  }

  if(def.metric==="positiveStreak"){
    const evidence=firstStreakEvidence(entries,entry=>entry.score>=0,def.target);
    const current=currentStreak(entries,entry=>entry.score>=0);
    return {unlocked:!!evidence,evidence,count:current,progress:progress(current,def.target,{suffix:"场"})};
  }

  if(def.metric==="mvpStreak"){
    const evidence=firstStreakEvidence(entries,entry=>entry.isMvp,def.target);
    const current=currentStreak(entries,entry=>entry.isMvp);
    return {unlocked:!!evidence,evidence,count:current,progress:progress(current,def.target,{suffix:"场"})};
  }

  if(def.metric==="soloWins"){
    const evidence=firstCountEvidence(entries,entry=>entry.solo,def.target);
    const count=entries.filter(entry=>entry.solo).length;
    return {unlocked:!!evidence,evidence,count,progress:progress(count,def.target,{suffix:"次"})};
  }

  if(def.metric==="dominance"){
    const evidence=firstThresholdEvidence(entries,entry=>entry.dominance,def.target);
    const best=entries.length?Math.max(...entries.map(entry=>entry.dominance)):0;
    return {unlocked:!!evidence,evidence,count:best,progress:{value:best,target:def.target,percent:clamp(Math.max(0,best)/def.target*100,0,100),label:`最高 +${Math.max(0,best).toFixed(1)} / +${def.target}`}};
  }

  if(def.metric==="comeback"){
    const evidence=firstComebackEvidence(entries);
    return {unlocked:!!evidence,evidence,count:evidence?1:0,progress:null};
  }

  if(def.metric==="lead"){
    const evidence=firstThresholdEvidence(entries,entry=>entry.lead,def.target);
    const values=entries.map(entry=>entry.lead).filter(Number.isFinite);
    const best=values.length?Math.max(...values):0;
    return {unlocked:!!evidence,evidence,count:best,progress:{value:best,target:def.target,percent:clamp(Math.max(0,best)/def.target*100,0,100),label:`最大领先 +${Math.max(0,best).toFixed(0)} / +${def.target}`}};
  }

  if(def.metric==="goat"){
    const evidence=goatFirstByPlayer?.[player.playerId]||null;
    return {unlocked:!!evidence,evidence,count:evidence?1:0,progress:null};
  }

  return {unlocked:false,evidence:null,count:0,progress:null};
}

export function buildAchievementSystem(players,matches,{honors={},goatFirstByPlayer={}}={}){
  const ordered=orderedMatches(matches);
  const byPlayer={};

  for(const player of players||[]){
    const entries=playerEntries(player,ordered);
    const achievements=ACHIEVEMENT_CATALOG.map(def=>{
      const result=resultForDefinition(def,{player,entries,honors,matches:ordered,goatFirstByPlayer});
      return {
        ...def,
        ...result,
        unlockedAt:result.evidence?.date||"",
        unlockedSeason:result.evidence?.season||result.evidence?.awardScope||""
      };
    });
    const unlocked=achievements.filter(item=>item.unlocked);
    const legendary=unlocked.filter(item=>item.rarity==="legendary").length;
    const latest=[...unlocked].sort((a,b)=>
      String(b.evidence?.date||"").localeCompare(String(a.evidence?.date||"")) ||
      num(b.evidence?.round)-num(a.evidence?.round) ||
      String(b.id).localeCompare(String(a.id))
    )[0]||null;
    byPlayer[player.playerId]={
      playerId:player.playerId,
      player:player.name,
      total:ACHIEVEMENT_CATALOG.length,
      unlocked:unlocked.length,
      completion:ACHIEVEMENT_CATALOG.length?unlocked.length/ACHIEVEMENT_CATALOG.length*100:0,
      legendary,
      latest,
      achievements,
      recent:[...unlocked].sort((a,b)=>String(b.evidence?.date||"").localeCompare(String(a.evidence?.date||""))||num(b.evidence?.round)-num(a.evidence?.round)).slice(0,5)
    };
  }

  return {
    catalog:ACHIEVEMENT_CATALOG,
    categories:CATEGORY_LABELS,
    rarityLabels:RARITY_LABELS,
    total:ACHIEVEMENT_CATALOG.length,
    byPlayer
  };
}
