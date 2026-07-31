import { HONOR_CATALOG } from "./honor-details.js";

const EPS=1e-9;
const byId=Object.fromEntries(HONOR_CATALOG.map(x=>[x.honorId,x]));
const seasonNumber=s=>Number(String(s||"").replace(/\D/g,""))||0;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const mean=a=>a.length?a.reduce((s,x)=>s+num(x),0)/a.length:0;
const sum=a=>a.reduce((s,x)=>s+num(x),0);
const std=a=>{if(!a.length)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(num(x)-m)**2)));};
const eq=(a,b)=>Math.abs(num(a)-num(b))<=EPS;
export function bgrValue(score){score=num(score);return score>=100?12:score>=90?8:score>=80?5:score>=70?3:score>=60?2:score>=50?1:0;}
function played(match){return (match.results||[]).filter(r=>!r.isAbsent&&r.score!=null);}
function playerResult(match,pid){return (match.results||[]).find(r=>r.playerId===pid);}
function sortedMatches(matches){return [...(matches||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))||num(a.round)-num(b.round)||String(a.matchId).localeCompare(String(b.matchId)));}
function eligiblePlayers(players,season){return players.filter(p=>seasonNumber(p.joinSeason)<=seasonNumber(season));}
function longestBoolean(schedule,predicate,{ignoreAbsent=false}={}){let cur=0,best=0;for(const x of schedule){if(x.absent&&ignoreAbsent)continue;if(predicate(x)){cur++;best=Math.max(best,cur);}else cur=0;}return best;}
function streakMetrics(schedule){let cur=[];const groups=[];for(const x of schedule){if(x.absent)continue;if(x.score>=0)cur.push(x);else{if(cur.length)groups.push(cur);cur=[];}}if(cur.length)groups.push(cur);const maxLength=Math.max(0,...groups.map(g=>g.length));const bestPoints=Math.max(0,...groups.filter(g=>g.length===maxLength).map(g=>sum(g.map(x=>x.score))));const extensions=sum(groups.map(g=>Math.max(0,g.length-1)));return {maxLength,bestPoints,extensions};}
function reboundMetric(entries){let best={amplitude:0,phaseTotal:0,bigStages:0,low:null,high:null,evidence:[]};for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){const phase=entries.slice(i+1,j+1);const candidate={amplitude:entries[j].score-entries[i].score,phaseTotal:sum(phase.map(x=>x.score)),bigStages:phase.filter(x=>x.score>=50).length,low:entries[i],high:entries[j],evidence:phase};if(compareTuple(candidate,best,[['amplitude','desc'],['phaseTotal','desc'],['bigStages','desc']])<0)best=candidate;}return best;}
function compareTuple(a,b,criteria){for(const [key,dir] of criteria){const av=num(a[key]),bv=num(b[key]);if(eq(av,bv))continue;return dir==='asc'?(av<bv?-1:1):(av>bv?-1:1);}return 0;}
function rankRows(rows,criteria){const sorted=[...rows].sort((a,b)=>compareTuple(a,b,criteria)||String(a.playerId).localeCompare(String(b.playerId)));let rank=0,prev=null;return sorted.map((r,i)=>{if(!prev||compareTuple(r,prev,criteria)!==0)rank=i+1;prev=r;return {...r,rank};});}
function typeStats(entries,type){const a=entries.filter(x=>x.matchType===type);const scores=a.map(x=>x.score);return {games:a.length,total:sum(scores),mvps:a.filter(x=>x.isMvp).length,positiveRate:a.length?a.filter(x=>x.score>=0).length/a.length:0,average:mean(scores)};}
function seasonMetrics(players,matches,season){const sm=sortedMatches(matches.filter(m=>m.season===season));const rows=[];for(const p of eligiblePlayers(players,season)){
  const schedule=sm.map(m=>{const r=playerResult(m,p.playerId);return {match:m,result:r,absent:!r||r.isAbsent||r.score==null,score:r&&!r.isAbsent&&r.score!=null?num(r.score):0,isMvp:!!(r&&!r.isAbsent&&r.isMvp),matchType:m.matchType};});
  const entries=schedule.filter(x=>!x.absent).map(x=>({matchId:x.match.matchId,date:x.match.date,round:x.match.round,matchType:x.match.matchType,venue:x.match.venue||"未填写场地",score:x.score,isMvp:x.isMvp,match:x.match}));
  const scores=entries.map(x=>x.score),positive=entries.filter(x=>x.score>=0),mvpEntries=entries.filter(x=>x.isMvp);
  const soloEntries=entries.filter(x=>{const pp=played(x.match);return x.score>=0&&pp.every(o=>o.playerId===p.playerId||num(o.score)<0);});
  const bigWins=entries.map(x=>{const opponents=played(x.match).filter(o=>o.playerId!==p.playerId);const margin=opponents.length?x.score-Math.min(...opponents.map(o=>num(o.score))):0;return {...x,margin};}).filter(x=>x.margin>=100);
  const last3=sm.slice(-3).map(m=>{const r=playerResult(m,p.playerId);return {match:m,score:r&&!r.isAbsent&&r.score!=null?num(r.score):0,isMvp:!!(r&&!r.isAbsent&&r.isMvp),absent:!r||r.isAbsent||r.score==null};});
  const streak=streakMetrics(schedule),rebound=reboundMetric(entries);
  rows.push({playerId:p.playerId,player:p.name,schedule,entries,games:entries.length,total:sum(scores),average:mean(scores),positiveRate:entries.length?positive.length/entries.length:0,positiveTotal:sum(positive.map(x=>x.score)),positiveAverage:mean(positive.map(x=>x.score)),best:scores.length?Math.max(...scores):0,worst:scores.length?Math.min(...scores):0,mvps:mvpEntries.length,mvpTotal:sum(mvpEntries.map(x=>x.score)),mvpAverage:mean(mvpEntries.map(x=>x.score)),longestMvp:longestBoolean(schedule,x=>!x.absent&&x.isMvp),four:typeStats(entries,"四人局"),five:typeStats(entries,"五人局"),soloCount:soloEntries.length,soloTotal:sum(soloEntries.map(x=>x.score)),soloAverage:mean(soloEntries.map(x=>x.score)),soloEntries,bgr:sum(scores.map(bgrValue)),longestBigStage:longestBoolean(schedule,x=>!x.absent&&x.score>=50),bigWinCount:bigWins.length,bigWinTotal:sum(bigWins.map(x=>x.margin)),maxLead:Math.max(0,...bigWins.map(x=>x.margin)),bigWins,longestStreak:streak.maxLength,longestStreakPoints:streak.bestPoints,streakExtensions:streak.extensions,last3Total:sum(last3.map(x=>x.score)),last3Mvps:last3.filter(x=>x.isMvp).length,last3Best:Math.max(0,...last3.map(x=>x.score)),last3,reboundAmplitude:rebound.amplitude,reboundTotal:rebound.phaseTotal,reboundBigStages:rebound.bigStages,rebound,crashCount:entries.filter(x=>x.score<=-40).length,crashTotal:sum(entries.filter(x=>x.score<=-40).map(x=>x.score)),crashWorst:Math.min(0,...entries.filter(x=>x.score<=-40).map(x=>x.score)),longestParticipation:longestBoolean(schedule,x=>!x.absent),longestAbsence:longestBoolean(schedule,x=>x.absent),volatility:std(scores)});
 }
 return {season,matches:sm,rows};
}
function normalizePositive(rows,key){const mx=Math.max(0,...rows.map(r=>Math.max(0,num(r[key]))));return r=>mx?Math.max(0,num(r[key]))/mx:0;}
function addAnnualScore(rows,championIds){const totalN=normalizePositive(rows,'total'),mvpMax=Math.max(0,...rows.map(r=>r.mvps)),avgN=normalizePositive(rows,'average'),rateMax=Math.max(0,...rows.map(r=>r.positiveRate)),bgrMax=Math.max(0,...rows.map(r=>r.bgr));return rows.map(r=>({...r,annualScore:totalN(r)*35+(mvpMax?r.mvps/mvpMax*25:0)+avgN(r)*15+(rateMax?r.positiveRate/rateMax*10:0)+(bgrMax?r.bgr/bgrMax*10:0)+(championIds.includes(r.playerId)?5:0)}));}
function criteriaText(criteria,row){return criteria.map(c=>({指标:c.label,数值:formatMetric(row[c.key],c.unit)}));}
function formatMetric(value,unit){if(unit==='%')return `${(num(value)*100).toFixed(2)}%`;if(unit==='分/场'||unit==='综合分'||unit==='波动指数')return `${num(value).toFixed(2)}${unit}`;return `${Number.isInteger(num(value))?num(value):num(value).toFixed(2)}${unit||''}`;}
function evidenceFor(id,row){if(id==='H010')return row.soloEntries;if(id==='H016')return row.bigWins.map(x=>({...x,margin:x.margin}));if(id==='H013')return row.last3.map(x=>({matchId:x.match.matchId,date:x.match.date,round:x.match.round,matchType:x.match.matchType,venue:x.match.venue||'未填写场地',score:x.score,wasAbsent:x.absent}));if(id==='H015')return [row.rebound.low,row.rebound.high].filter(Boolean).map(x=>({matchId:x.matchId,date:x.date,round:x.round,matchType:x.matchType,venue:x.venue,score:x.score}));return []}
function evaluateAward(scope,id,rows,criteria,{eligibility=()=>true,requirePositive=false}={}){const catalog=byId[id];const eligible=rows.filter(eligibility);if(!eligible.length)return {scope,honorId:id,catalog,status:'NOT_AWARDED',winners:[],ranking:[]};const tuple=criteria.map(c=>[c.key,c.dir]);const ranking=rankRows(eligible,tuple);const top=ranking[0];if(requirePositive&&num(top[criteria[0].key])<=0)return {scope,honorId:id,catalog,status:'NOT_AWARDED',winners:[],ranking,reason:'无人达到最低触发条件'};const tied=ranking.filter(r=>compareTuple(r,top,tuple)===0);const pending=!catalog.allowTie&&tied.length>1;const winners=pending?[]:(catalog.allowTie?tied:[top]);return {scope,honorId:id,catalog,status:pending?'PENDING_TIEBREAK':'LIVE_CALCULATED',winners,ranking,pending,criteria,summary:pending?`${scope} ${catalog.name}全部比较条件仍完全相同，暂不颁发。`:`${winners.map(x=>x.player).join(' / ')}获得${scope}${catalog.name}。`};}
function awardObject(result,row){const c=result.catalog;return {ownerPlayerId:row.playerId,scope:result.scope,honorId:c.honorId,name:c.name,grade:c.grade,category:c.category,value:num(row[result.criteria?.[0]?.key]??1),points:c.points,status:result.status,details:{rule:c.rule,unit:c.unit,winner:row.player,winners:result.winners.map(x=>x.player),officialValue:num(row[result.criteria?.[0]?.key]??1),calculationStatus:'LIVE_RECALCULATED_UNIQUE_RULES',ranking:result.ranking.map(r=>({playerId:r.playerId,player:r.player,value:num(r[result.criteria?.[0]?.key]??0),unit:c.unit,rank:r.rank,note:criteriaText(result.criteria||[],r).map(x=>`${x.指标} ${x.数值}`).join(' · ')})),formula:criteriaText(result.criteria||[],row),evidence:evidenceFor(c.honorId,row),summary:result.summary}};}
const C={
 H001:[{key:'total',dir:'desc',label:'总积分',unit:'分'},{key:'positiveRate',dir:'desc',label:'正分率',unit:'%'},{key:'best',dir:'desc',label:'单场最高',unit:'分'}],
 H002:[{key:'annualScore',dir:'desc',label:'年度综合评分',unit:'综合分'}],
 H003:[{key:'mvps',dir:'desc',label:'MVP场次',unit:'次'},{key:'mvpTotal',dir:'desc',label:'MVP场次累计积分',unit:'分'},{key:'longestMvp',dir:'desc',label:'最长连续MVP',unit:'场'}],
 H011:[{key:'four.total',dir:'desc'}],
};
function getPath(o,path){return String(path).split('.').reduce((v,k)=>v?.[k],o);}
function flattenFor(rows,fields){return rows.map(r=>{const x={...r};for(const [dest,path] of Object.entries(fields))x[dest]=getPath(r,path);return x;});}
function seasonAwards(players,matches,season){const base=seasonMetrics(players,matches,season);let rows=base.rows;const results=[];
 const push=(id,sourceRows,criteria,opts)=>{const res=evaluateAward(season,id,sourceRows,criteria,opts);results.push(res);return res;};
 const h1=push('H001',rows,[{key:'total',dir:'desc',label:'总积分',unit:'分'},{key:'positiveRate',dir:'desc',label:'正分率',unit:'%'},{key:'best',dir:'desc',label:'单场最高',unit:'分'}]);
 rows=addAnnualScore(rows,h1.winners.map(x=>x.playerId));
 push('H002',rows,[{key:'annualScore',dir:'desc',label:'年度综合评分',unit:'综合分'}]);
 push('H003',rows,[{key:'mvps',dir:'desc',label:'MVP场次',unit:'次'},{key:'mvpTotal',dir:'desc',label:'MVP场次累计积分',unit:'分'},{key:'longestMvp',dir:'desc',label:'最长连续MVP',unit:'场'}]);
 const four=flattenFor(rows,{typeTotal:'four.total',typeMvps:'four.mvps',typeRate:'four.positiveRate',typeGames:'four.games'});push('H011',four,[{key:'typeTotal',dir:'desc',label:'四人局总积分',unit:'分'},{key:'typeMvps',dir:'desc',label:'四人局MVP',unit:'次'},{key:'typeRate',dir:'desc',label:'四人局正分率',unit:'%'}],{eligibility:r=>r.typeGames>0});
 const five=flattenFor(rows,{typeTotal:'five.total',typeMvps:'five.mvps',typeRate:'five.positiveRate',typeGames:'five.games'});push('H012',five,[{key:'typeTotal',dir:'desc',label:'五人局总积分',unit:'分'},{key:'typeMvps',dir:'desc',label:'五人局MVP',unit:'次'},{key:'typeRate',dir:'desc',label:'五人局正分率',unit:'%'}],{eligibility:r=>r.typeGames>0});
 push('H004',rows,[{key:'average',dir:'desc',label:'场均积分',unit:'分/场'},{key:'positiveAverage',dir:'desc',label:'正分场均',unit:'分/场'},{key:'mvpAverage',dir:'desc',label:'MVP场均',unit:'分/场'}],{eligibility:r=>r.games>0});
 push('H005',rows,[{key:'positiveRate',dir:'desc',label:'正分率',unit:'%'},{key:'positiveTotal',dir:'desc',label:'正分累计积分',unit:'分'},{key:'positiveAverage',dir:'desc',label:'正分场均',unit:'分/场'}],{eligibility:r=>r.games>0});
 push('H007',rows,[{key:'games',dir:'desc',label:'参赛场次',unit:'场'},{key:'longestParticipation',dir:'desc',label:'最长连续参赛',unit:'场'}]);
 push('H010',rows,[{key:'soloCount',dir:'desc',label:'独赢场次',unit:'场'},{key:'soloTotal',dir:'desc',label:'独赢累计积分',unit:'分'},{key:'soloAverage',dir:'desc',label:'独赢场均',unit:'分/场'}],{requirePositive:true});
 push('H008',rows,[{key:'bgr',dir:'desc',label:'BGR指数',unit:'BGR'},{key:'best',dir:'desc',label:'单场最高',unit:'分'},{key:'longestBigStage',dir:'desc',label:'最长连续大场面',unit:'场'}],{eligibility:r=>r.games>0});
 push('H016',rows,[{key:'bigWinCount',dir:'desc',label:'大胜场次',unit:'场'},{key:'bigWinTotal',dir:'desc',label:'累计净胜分',unit:'分'},{key:'maxLead',dir:'desc',label:'最大领先分差',unit:'分'}],{requirePositive:true});
 push('H006',rows,[{key:'longestStreak',dir:'desc',label:'最长连庄',unit:'场'},{key:'longestStreakPoints',dir:'desc',label:'最长连庄阶段积分',unit:'分'},{key:'streakExtensions',dir:'desc',label:'连庄总次数',unit:'次'}],{eligibility:r=>r.games>0});
 push('H013',rows,[{key:'last3Total',dir:'desc',label:'最后3场总积分',unit:'分'},{key:'last3Mvps',dir:'desc',label:'最后3场MVP',unit:'次'},{key:'last3Best',dir:'desc',label:'最后3场最高',unit:'分'}]);
 push('H015',rows,[{key:'reboundAmplitude',dir:'desc',label:'最大反弹幅度',unit:'分'},{key:'reboundTotal',dir:'desc',label:'反弹阶段累计积分',unit:'分'},{key:'reboundBigStages',dir:'desc',label:'反弹阶段大场面',unit:'次'}],{requirePositive:true});
 push('H021',rows,[{key:'crashCount',dir:'desc',label:'≤-40场次',unit:'场'},{key:'crashTotal',dir:'asc',label:'翻车累计积分',unit:'分'},{key:'crashWorst',dir:'asc',label:'最低单场',unit:'分'}],{requirePositive:true});
 push('H017',rows,[{key:'total',dir:'asc',label:'总积分',unit:'分'},{key:'positiveRate',dir:'asc',label:'正分率',unit:'%'},{key:'worst',dir:'asc',label:'单场最低',unit:'分'}]);
 push('H019',rows,[{key:'games',dir:'asc',label:'参赛场次',unit:'场'},{key:'longestAbsence',dir:'desc',label:'最长连续缺席',unit:'场'}]);
 push('H018',rows,[{key:'volatility',dir:'desc',label:'波动指数',unit:'波动指数'},{key:'best',dir:'desc',label:'单场最高',unit:'分'},{key:'worst',dir:'asc',label:'单场最低',unit:'分'}],{eligibility:r=>r.games>0});
 const awards=[];for(const res of results)for(const w of res.winners)awards.push(awardObject(res,w));
 const winnersBy=id=>results.find(x=>x.honorId===id)?.winners.map(x=>x.playerId)||[];const aWinners=['H001','H002','H003'].map(winnersBy);const playerWithAll=rows.find(r=>aWinners.every(ids=>ids.includes(r.playerId)));if(playerWithAll){const bCount=awards.filter(a=>a.ownerPlayerId===playerWithAll.playerId&&a.grade==='B').length;if(bCount>=6){const c=byId.H022;awards.push({ownerPlayerId:playerWithAll.playerId,scope:season,honorId:'H022',name:c.name,grade:c.grade,category:c.category,value:bCount,points:c.points,status:'ACHIEVED',details:{rule:c.rule,unit:'项',winner:playerWithAll.player,winners:[playerWithAll.player],officialValue:bCount,calculationStatus:'LIVE_RECALCULATED_GRAND_SLAM',ranking:[{playerId:playerWithAll.playerId,player:playerWithAll.player,value:bCount,unit:'B级荣誉',rank:1}],formula:[{A级荣誉:'3/3'},{B级荣誉:`${bCount}/6`}],summary:`${playerWithAll.player}在${season}达成赛季大满贯。`}});}}
 return {season,rows,results,awards};
}
export function calculateHonorSystem(players,matches){const seasons=[...new Set((matches||[]).map(m=>m.season))].filter(Boolean).sort((a,b)=>seasonNumber(a)-seasonNumber(b));const honors=Object.fromEntries(players.map(p=>[p.playerId,[]]));const board=[];const seasonMetricsMap={};for(const s of seasons){const calc=seasonAwards(players,matches,s);seasonMetricsMap[s]=calc.rows;calc.awards.forEach(a=>honors[a.ownerPlayerId].push(a));calc.results.forEach(r=>board.push({scope:s,honorId:r.honorId,name:r.catalog.name,grade:r.catalog.grade,category:r.catalog.category,status:r.status,winners:r.winners.map(x=>x.player),winnerIds:r.winners.map(x=>x.playerId),value:r.ranking[0]?num(r.ranking[0][r.criteria?.[0]?.key]):null,unit:r.catalog.unit,summary:r.summary||r.reason||'',allowTie:r.catalog.allowTie}));const slam=calc.awards.find(a=>a.honorId==='H022');if(slam)board.push({scope:s,honorId:'H022',name:slam.name,grade:'D',category:'生涯成就',status:'ACHIEVED',winners:[slam.details.winner],winnerIds:[slam.ownerPlayerId],value:slam.value,unit:'项',summary:slam.details.summary,allowTie:false});}
 return {honors,board,seasons,seasonMetrics:seasonMetricsMap,catalog:HONOR_CATALOG};}

function recentEntries(matches,pid,n=5){const arr=[];for(const m of sortedMatches(matches)){const r=playerResult(m,pid);if(r&&!r.isAbsent&&r.score!=null)arr.push({matchId:m.matchId,season:m.season,round:m.round,date:m.date,matchType:m.matchType,venue:m.venue||'未填写场地',score:num(r.score),isMvp:!!r.isMvp});}return arr.slice(-n);}
function slope(values){if(values.length<2)return 0;const xs=values.map((_,i)=>i),xm=mean(xs),ym=mean(values);const den=sum(xs.map(x=>(x-xm)**2));return den?sum(xs.map((x,i)=>(x-xm)*(values[i]-ym)))/den:0;}
function minmax(rows,key){const vals=rows.map(x=>num(x[key])),lo=Math.min(...vals),hi=Math.max(...vals);return x=>eq(hi,lo)?.5:(num(x[key])-lo)/(hi-lo);}
function weightedRecent(entries){const base=[.10,.15,.20,.25,.30].slice(5-entries.length),ws=sum(base);return {score:entries.length?sum(entries.map((x,i)=>x.score*base[i]))/ws:0,positive:entries.length?sum(entries.map((x,i)=>(x.score>=0?1:0)*base[i]))/ws:0,mvp:entries.length?sum(entries.map((x,i)=>(x.isMvp?1:0)*base[i]))/ws:0,bgr:entries.length?sum(entries.map((x,i)=>bgrValue(x.score)*base[i]))/ws:0};}
function ordinalRanks(rows,key,dir='desc'){const sorted=[...rows].sort((a,b)=>dir==='asc'?num(a[key])-num(b[key]):num(b[key])-num(a[key])||String(a.playerId).localeCompare(String(b.playerId)));let rank=0,prev=null;const out={};sorted.forEach((row,index)=>{const value=num(row[key]);if(index===0||!eq(value,prev))rank=index+1;prev=value;out[row.playerId]=rank;});return out;}
function seasonRatingLabel(rating){if(rating>=92)return '统治级赛季';if(rating>=86)return '冠军级赛季';if(rating>=80)return '顶尖赛季';if(rating>=74)return '强势赛季';if(rating>=68)return '稳定赛季';if(rating>=62)return '合格赛季';return '调整赛季';}
function careerRatingLabel(rating){if(rating>=92)return '历史级门面';if(rating>=86)return '冠军级核心';if(rating>=80)return '全明星核心';if(rating>=74)return '高水平主力';if(rating>=68)return '稳定主力';if(rating>=62)return '可靠轮换';if(rating>=56)return '竞争型牌手';return '调整中的牌手';}
function careerMetrics(players,matches,honors={}){
  const seasons=[...new Set((matches||[]).map(m=>m.season).filter(Boolean))].sort((a,b)=>seasonNumber(a)-seasonNumber(b));
  const seasonRows={};
  seasons.forEach(season=>{
    const rows=players.map(p=>{
      const entries=recentEntries(matches.filter(m=>m.season===season),p.playerId,999),scores=entries.map(x=>x.score),games=entries.length,mvps=entries.filter(x=>x.isMvp).length;
      return {playerId:p.playerId,player:p.name,season,games,total:sum(scores),average:mean(scores),positiveRate:games?entries.filter(x=>x.score>=0).length/games:0,mvps,mvpRate:games?mvps/games:0,bgr:sum(scores.map(bgrValue)),bgrPerGame:games?sum(scores.map(bgrValue))/games:0,best:games?Math.max(...scores):null,worst:games?Math.min(...scores):null,volatility:std(scores)};
    });
    const active=rows.filter(x=>x.games>0);
    if(active.length){
      const nTotal=minmax(active,'total'),nAvg=minmax(active,'average'),nPos=minmax(active,'positiveRate'),nMvp=minmax(active,'mvpRate'),nBgr=minmax(active,'bgrPerGame'),nGames=minmax(active,'games');
      active.forEach(x=>{x.rating=Math.round(50+49*(nTotal(x)*.35+nAvg(x)*.20+nPos(x)*.15+nMvp(x)*.15+nBgr(x)*.10+nGames(x)*.05));x.ratingLabel=seasonRatingLabel(x.rating);});
      const ratingRanks=ordinalRanks(active,'rating'),totalRanks=ordinalRanks(active,'total');
      active.forEach(x=>{x.ratingRank=ratingRanks[x.playerId];x.totalRank=totalRanks[x.playerId];});
    }
    seasonRows[season]=rows;
  });
  let rows=players.map(p=>{
    const entries=recentEntries(matches,p.playerId,999),scores=entries.map(x=>x.score),games=entries.length,mvps=entries.filter(x=>x.isMvp).length;
    const hs=honors?.[p.playerId]||[],honorPoints=sum(hs.map(h=>h.points||0));
    const seasonHistory=seasons.map(s=>seasonRows[s].find(x=>x.playerId===p.playerId)).filter(x=>x&&x.games>0);
    return {playerId:p.playerId,player:p.name,games,total:sum(scores),average:mean(scores),positiveRate:games?entries.filter(x=>x.score>=0).length/games:0,mvps,mvpRate:games?mvps/games:0,bgr:sum(scores.map(bgrValue)),bgrPerGame:games?sum(scores.map(bgrValue))/games:0,best:games?Math.max(...scores):null,worst:games?Math.min(...scores):null,volatility:std(scores),honorPoints,honorCount:hs.length,gradeA:hs.filter(h=>h.grade==='A').length,gradeB:hs.filter(h=>h.grade==='B').length,titles:hs.filter(h=>h.honorId==='H001').length,seasonHistory};
  });
  const active=rows.filter(x=>x.games>0),nTotal=minmax(active,'total'),nAvg=minmax(active,'average'),nPos=minmax(active,'positiveRate'),nMvp=minmax(active,'mvpRate'),nBgr=minmax(active,'bgrPerGame'),nHonor=minmax(active,'honorPoints');
  rows=rows.map(r=>({...r,overallRating:r.games?Math.round(50+49*(nTotal(r)*.25+nAvg(r)*.20+nPos(r)*.15+nMvp(r)*.15+nBgr(r)*.10+nHonor(r)*.15)):50}));
  const ratingRanks=ordinalRanks(rows,'overallRating'),totalRanks=ordinalRanks(rows,'total'),avgRanks=ordinalRanks(rows,'average'),positiveRanks=ordinalRanks(rows,'positiveRate'),mvpRanks=ordinalRanks(rows,'mvpRate'),bgrRanks=ordinalRanks(rows,'bgrPerGame'),honorRanks=ordinalRanks(rows,'honorPoints');
  return Object.fromEntries(rows.map(r=>{
    const history=[...r.seasonHistory].sort((a,b)=>seasonNumber(a.season)-seasonNumber(b.season)),bestSeason=[...history].sort((a,b)=>b.rating-a.rating||b.total-a.total)[0]||null;
    let trend='跨赛季表现整体平稳';const ratings=history.map(x=>x.rating);
    if(ratings.length>=2&&ratings.every((x,i)=>i===0||x>ratings[i-1]))trend='跨赛季评分持续上升';
    else if(ratings.length>=2&&ratings.every((x,i)=>i===0||x<ratings[i-1]))trend='跨赛季评分呈下降趋势';
    else if(bestSeason&&bestSeason.season===history.at(-1)?.season)trend='当前赛季达到生涯阶段高点';
    else if(bestSeason)trend=`生涯峰值出现在${bestSeason.season}`;
    return [r.playerId,{...r,overallRank:ratingRanks[r.playerId],totalRank:totalRanks[r.playerId],averageRank:avgRanks[r.playerId],positiveRank:positiveRanks[r.playerId],mvpRank:mvpRanks[r.playerId],bgrRank:bgrRanks[r.playerId],honorRank:honorRanks[r.playerId],ratingLabel:careerRatingLabel(r.overallRating),bestSeason,trend,seasonRange:history.length?`${history[0].season}–${history.at(-1).season}`:'—'}];
  }));
}
function computePower(players,matches){
  const latestSeason=[...new Set(matches.map(m=>m.season))].sort((a,b)=>seasonNumber(a)-seasonNumber(b)).at(-1);
  let rows=players.map(p=>{
    const recent=recentEntries(matches,p.playerId,5),w=weightedRecent(recent);
    const seasonEntries=recentEntries(matches.filter(m=>m.season===latestSeason),p.playerId,999);
    const seasonScores=seasonEntries.map(x=>x.score),seasonTotal=sum(seasonScores),seasonGames=seasonScores.length;
    const season={id:latestSeason||'—',games:seasonGames,total:seasonTotal,average:mean(seasonScores),positiveRate:seasonGames?seasonEntries.filter(x=>x.score>=0).length/seasonGames:0,mvps:seasonEntries.filter(x=>x.isMvp).length,bgr:sum(seasonScores.map(bgrValue)),best:seasonGames?Math.max(...seasonScores):null,worst:seasonGames?Math.min(...seasonScores):null,volatility:std(seasonScores)};
    return {playerId:p.playerId,player:p.name,recent,weightedScore:w.score,recentPositive:w.positive,recentMvp:w.mvp,recentBgr:w.bgr,trend:slope(recent.map(x=>x.score)),vsSeason:w.score-season.average,recentTotal:sum(recent.map(x=>x.score)),recentAverage:mean(recent.map(x=>x.score)),recentStd:std(recent.map(x=>x.score)),seasonAverage:season.average,season,latest:recent.at(-1)||null};
  });
  const totalRanks=ordinalRanks(rows.map(r=>({...r,seasonTotal:r.season.total})),'seasonTotal');
  const avgRanks=ordinalRanks(rows.map(r=>({...r,seasonAvg:r.season.average})),'seasonAvg');
  const positiveRanks=ordinalRanks(rows.map(r=>({...r,seasonPositive:r.season.positiveRate})),'seasonPositive');
  const mvpRanks=ordinalRanks(rows.map(r=>({...r,seasonMvps:r.season.mvps})),'seasonMvps');
  const bgrRanks=ordinalRanks(rows.map(r=>({...r,seasonBgr:r.season.bgr})),'seasonBgr');
  rows=rows.map(r=>({...r,season:{...r.season,totalRank:totalRanks[r.playerId],averageRank:avgRanks[r.playerId],positiveRank:positiveRanks[r.playerId],mvpRank:mvpRanks[r.playerId],bgrRank:bgrRanks[r.playerId]}}));
  const nScore=minmax(rows,'weightedScore'),nPos=minmax(rows,'recentPositive'),nMvp=minmax(rows,'recentMvp'),nBgr=minmax(rows,'recentBgr'),nTrend=minmax(rows,'trend'),nVs=minmax(rows,'vsSeason');
  rows=rows.map(r=>({...r,powerIndex:Math.round(100*(nScore(r)*.35+nPos(r)*.20+nMvp(r)*.15+nBgr(r)*.10+nTrend(r)*.10+nVs(r)*.10))})).sort((a,b)=>b.powerIndex-a.powerIndex||b.weightedScore-a.weightedScore||a.playerId.localeCompare(b.playerId));
  return rows.map((r,i)=>({...r,rank:i+1}));
}
function statusLabel(r){if(r.recent.length<3)return '🕒 样本不足';const last3=r.recent.slice(-3).map(x=>x.score);if(r.latest?.isMvp&&r.powerIndex>=55)return '👑 MVP状态';if(last3.length===3&&last3.every(x=>x>=0))return '🎯 连续正分';if(last3.length===3&&last3[0]<last3[1]&&last3[1]<last3[2])return r.powerIndex>=45?'🚀 强势上升':'📈 回暖中';if(last3.length===3&&last3[0]>last3[1]&&last3[1]>last3[2])return r.powerIndex>=55?'🎢 高开低走':'📉 状态下滑';if(r.recent.filter(x=>x.score>=50).length>=2)return '⚡ 大场面模式';if(r.recentStd>=35)return '🌊 表现起伏';if(r.powerIndex>=85)return '🔥 炙手可热';if(r.powerIndex>=70)return '🔥 手感火热';if(r.powerIndex>=55)return '✅ 状态稳定';if(r.powerIndex>=45)return '➖ 状态平平';if(r.powerIndex>=30)return '🌧 状态低迷';return '🧊 深陷低谷';}
function archetypes(rows){const avgRank=[...rows].sort((a,b)=>b.seasonAverage-a.seasonAverage).map(x=>x.playerId),posRank=[...rows].sort((a,b)=>b.recentPositive-a.recentPositive).map(x=>x.playerId),bgrRank=[...rows].sort((a,b)=>b.recentBgr-a.recentBgr).map(x=>x.playerId),volRank=[...rows].sort((a,b)=>b.recentStd-a.recentStd).map(x=>x.playerId);return Object.fromEntries(rows.map(r=>{let t='稳定轮换';if(avgRank.indexOf(r.playerId)<2&&posRank.indexOf(r.playerId)<2&&r.recentMvp>0)t='全能型核心';else if(avgRank[0]===r.playerId)t='得分型牌手';else if(posRank[0]===r.playerId)t='稳定型牌手';else if(bgrRank[0]===r.playerId&&r.recentBgr>0)t='大场面牌手';else if(volRank[0]===r.playerId&&r.recentStd>25)t='高波动攻击手';return [r.playerId,t];}));}
function seasonAssessment(r){
  const s=r.season||{};
  if(!s.games)return {label:'赛季样本不足',summary:`${r.player}在当前赛季暂无有效参赛记录。`,outlook:'需要更多正式比赛后才能形成完整的赛季定位。'};
  let label='中游竞争者',outlook='当前赛季仍有提升空间，后续关键在于提高正分延续性。';
  if(s.totalRank===1){label='赛季领跑者';outlook='目前掌握积分榜主动权，需要继续保持稳定输出并控制低分场次。';}
  else if(s.totalRank===2){label='争冠集团';outlook='与榜首仍处于可追赶范围，连续正分或一场大胜都可能改变争冠格局。';}
  else if(s.totalRank===3){label='中游核心';outlook='整体处于中游位置，需要通过稳定正分和MVP表现向前两名施压。';}
  else if(s.total<0){label='赛季追赶者';outlook='赛季累计积分仍为负，首要任务是缩小负分并建立连续正分阶段。';}
  else {label='上升追赶者';outlook='目前尚未进入领先集团，但保持正分可以逐步缩小积分差距。';}
  const summary=`${s.id}已出战${s.games}场，累计${s.total>=0?'+':''}${s.total}分，积分排名第${s.totalRank}；场均${s.average.toFixed(2)}分，正分率${(s.positiveRate*100).toFixed(1)}%，取得${s.mvps}次MVP，BGR指数${s.bgr}。`;
  return {label,summary,outlook};
}
function careerAssessment(r){
  const c=r.career||{};
  if(!c.games)return {label:'生涯样本不足',summary:`${r.player}暂无足够的历季正式比赛数据。`,evaluation:'需要更多赛季数据后才能形成长期定位。',outlook:'当前以积累有效比赛样本为主。',strengths:[],risks:[]};
  const strengths=[],risks=[];
  if(c.totalRank<=2)strengths.push(`S1–S3累计积分排名第${c.totalRank}`);
  if(c.averageRank<=2)strengths.push(`生涯场均排名第${c.averageRank}`);
  if(c.positiveRank<=2)strengths.push(`生涯正分率排名第${c.positiveRank}`);
  if(c.mvpRank<=2)strengths.push(`MVP效率排名第${c.mvpRank}`);
  if(c.honorRank<=2&&c.honorPoints>0)strengths.push(`官方荣誉积分排名第${c.honorRank}`);
  if(c.total<0)risks.push('历季累计积分仍为负，长期稳定输出不足');
  if(c.positiveRate<.5)risks.push(`生涯正分率${(c.positiveRate*100).toFixed(1)}%，低于五成`);
  if(c.volatility>=35)risks.push(`生涯波动指数${c.volatility.toFixed(1)}，比赛上下限差距较大`);
  if(!risks.length)risks.push('长期数据结构较均衡，主要观察能否继续抬高个人峰值');
  const best=c.bestSeason;
  const summary=`${c.seasonRange}共出战${c.games}场，累计${c.total>=0?'+':''}${c.total}分，场均${c.average.toFixed(2)}分，正分率${(c.positiveRate*100).toFixed(1)}%，取得${c.mvps}次MVP、BGR ${c.bgr}，累计${c.honorPoints}荣誉分。`;
  const evaluation=`${r.player}的MSL生涯定位为“${c.ratingLabel}”，综合评分${c.overallRating}，联盟排名第${c.overallRank}。${c.trend}${best?`，其中${best.season}以${best.rating}分成为目前评分最高的单赛季。`:''}${strengths.length?`长期优势主要体现在${strengths.slice(0,3).join('、')}。`:''}`;
  const outlook=c.overallRank<=2?'已经进入联盟长期核心层，后续重点是把高水平赛季转化为更多A级荣誉和冠军。':c.total>=0?'具备进入长期核心层的基础，提升MVP效率与高分场次将明显拉高综合评分。':'目前仍处于生涯追赶阶段，优先目标是改善累计积分、正分率与赛季稳定性。';
  return {label:c.ratingLabel,summary,evaluation,outlook,strengths,risks};
}
function reportFor(r,all){
  const totalRank=[...all].sort((a,b)=>b.recentTotal-a.recentTotal).findIndex(x=>x.playerId===r.playerId)+1;
  const trendKey=r.movement>0||r.indexChange>=8?'up':r.movement<0||r.indexChange<=-8?'down':'hold';
  const headline=trendKey==='up'?'行情上涨':trendKey==='down'?'行情下跌':'持续观望';
  const latest=r.latest,strengths=[],risks=[];
  if(totalRank===1)strengths.push(`最近5场累计${r.recentTotal>=0?'+':''}${r.recentTotal}，同期排名第1`);
  if(r.recentPositive>=.6)strengths.push(`近期正分率${(r.recentPositive*100).toFixed(0)}%`);
  if(r.recent.filter(x=>x.isMvp).length)strengths.push(`最近5场拿到${r.recent.filter(x=>x.isMvp).length}次MVP`);
  if(r.recent.filter(x=>x.score>=50).length)strengths.push(`出现${r.recent.filter(x=>x.score>=50).length}场50+大场面`);
  if(r.recentStd>=35)risks.push(`近期波动指数${r.recentStd.toFixed(1)}，上下限差距较大`);
  if(r.recent.filter(x=>x.score<0).length>=3)risks.push('最近5场负分次数偏多');
  if(r.weightedScore<r.seasonAverage)risks.push(`近期加权表现低于赛季场均${r.seasonAverage.toFixed(1)}`);
  if(!risks.length)risks.push('当前没有明显数据预警，重点观察状态延续性');
  const direction=r.movement>0?`实力榜上升${r.movement}位`:r.movement<0?`实力榜下降${Math.abs(r.movement)}位`:'实力榜位置保持不变';
  const summary=`${r.player}目前位列MSL实力榜第${r.rank}，状态指数${r.powerIndex}。${direction}。最近5场累计${r.recentTotal>=0?'+':''}${r.recentTotal}，${latest?`最新一场${latest.score>=0?'+':''}${latest.score}${latest.isMvp?'并获得MVP':''}`:'近期暂无有效比赛'}。`;
  const next=latest?.isMvp?'下一场重点观察能否延续MVP级输出，并在精准对位中建立稳定吃分对象。':r.powerIndex<45?'下一场重点是止住负分趋势，提高整场稳定性。':'下一场重点观察正分延续性与关键局爆发。';
  const seasonView=seasonAssessment(r),careerView=careerAssessment(r);
  return {trendKey,headline,summary,strengths:strengths.length?strengths:['近期表现接近个人常态，暂无特别突出的单项'],risks,next,seasonLabel:seasonView.label,seasonSummary:seasonView.summary,seasonOutlook:seasonView.outlook,careerLabel:careerView.label,careerSummary:careerView.summary,careerEvaluation:careerView.evaluation,careerOutlook:careerView.outlook,careerStrengths:careerView.strengths,careerRisks:careerView.risks};
}
export function buildMslStatusCenter(players,matches,honors={}){
  const current=computePower(players,matches),previous=computePower(players,sortedMatches(matches).slice(0,-1));
  const prevBy=Object.fromEntries(previous.map(x=>[x.playerId,x])),careerBy=careerMetrics(players,matches,honors);
  let rows=current.map(r=>{const prev=prevBy[r.playerId];return {...r,career:careerBy[r.playerId],movement:prev?prev.rank-r.rank:0,indexChange:prev?r.powerIndex-prev.powerIndex:0};});
  const types=archetypes(rows);rows=rows.map(r=>({...r,label:statusLabel(r),archetype:types[r.playerId]}));rows=rows.map(r=>({...r,report:reportFor(r,rows)}));
  const hottest=rows[0],coldest=rows.at(-1),riser=[...rows].sort((a,b)=>b.movement-a.movement||b.indexChange-a.indexChange)[0],volatile=[...rows].sort((a,b)=>b.recentStd-a.recentStd)[0],overall=[...rows].sort((a,b)=>b.career.overallRating-a.career.overallRating||a.playerId.localeCompare(b.playerId))[0];
  const latest=sortedMatches(matches).at(-1);let gameRecap=null;
  if(latest){const pp=played(latest).sort((a,b)=>num(b.score)-num(a.score)),top=pp[0],second=pp[1],bottom=pp.at(-1);gameRecap={title:`${top?.player||'本场赢家'}领跑最新一轮，${bottom?.player||'末位牌手'}承压`,meta:`${latest.season} 第${latest.round}局 · ${latest.date} · ${latest.venue||'未填写场地'}`,body:`${top?.player||'—'}以${top?`${num(top.score)>=0?'+':''}${num(top.score)}`:'—'}取得全场最高分${top?.isMvp?'并拿下MVP':''}，领先第二名${top&&second?num(top.score)-num(second.score):0}分；全场最大分差${top&&bottom?num(top.score)-num(bottom.score):0}分。${/NO_PRECISE_MATCHUP|BACKFILL_2026-07-30_SCORE_ONLY/.test(String(latest.notes||''))?'本场为总分补录，不进入精准对位分析。':'本场精准对位数据将同步进入对位中心。'}`,scores:pp.map(x=>({player:x.player,score:num(x.score),isMvp:!!x.isMvp}))};}
  const storylines=[`🔥 当前最火热：${hottest.player}，状态指数${hottest.powerIndex}。`,`🧊 当前最低迷：${coldest.player}，状态指数${coldest.powerIndex}。`,`🏅 生涯综合评分最高：${overall.player}，OVR ${overall.career.overallRating}。`,`📈 行情上升最快：${riser.player}，${riser.movement>0?`实力榜上升${riser.movement}位`:`指数变化${riser.indexChange>=0?'+':''}${riser.indexChange}`}。`,`🌊 近期波动最大：${volatile.player}，波动指数${volatile.recentStd.toFixed(1)}。`];
  return {rankings:rows,storylines,gameRecap,methodology:'状态指数：最近5场加权净分35% + 正分率20% + MVP15% + BGR10% + 走势10% + 相对当前赛季表现10%。生涯综合评分（OVR）：S1至当前全部赛季累计积分25% + 生涯场均20% + 生涯正分率15% + MVP率15% + 场均BGR10% + 官方荣誉积分15%，按联盟相对表现换算为50–99分。两套评分均不影响官方积分、荣誉或GOAT计算。'};
}
