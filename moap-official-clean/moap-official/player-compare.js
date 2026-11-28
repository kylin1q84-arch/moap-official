// MOAP player-versus-player comparison. All data comes from the loaded official archive.
// No client-side writes and no inferred pairwise transfer records.
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const signed = (value, digits=0) => { const v=n(value); return (v>0?"+":"")+v.toFixed(digits); };
const pct = value => (100*n(value)).toFixed(1)+"%";
const dateSort = (a,b) => String(a.date||"").localeCompare(String(b.date||"")) || String(a.matchId||"").localeCompare(String(b.matchId||""));
const validResult = (match,id) => (match.results||[]).find(r => r.playerId===id && !r.isAbsent && r.score!=null && Number.isFinite(Number(r.score)));
const metrics = (matches,id) => {
  const played = matches.map(m=>({match:m,result:validResult(m,id)})).filter(x=>x.result);
  let streak=0, longest=0;
  for(const entry of played){streak=n(entry.result.score)>=0?streak+1:0;longest=Math.max(longest,streak);}
  const scores=played.map(x=>n(x.result.score));
  const total=scores.reduce((s,v)=>s+v,0),games=scores.length;
  const mvps=played.filter(x=>x.result.isMvp).length;
  return {games,total,average:games?total/games:null,mvps,mvpRate:games?mvps/games:null,
    positiveRate:games?scores.filter(x=>x>=0).length/games:null,
    longest,best:games?Math.max(...scores):null,explosions:scores.filter(x=>x>=50).length};
};
export function buildPlayerComparison(state,leftId,rightId,season="all"){
  const matches=(state.matches||[]).filter(match=>season==="all"||match.season===season).slice().sort(dateSort);
  const left=metrics(matches,leftId),right=metrics(matches,rightId);
  const honors=(id,type)=>((state.honors||{})[id]||[]).filter(h=>h.honorId===type&&(season==="all"||h.scope===season)).length;
  for(const [id,stats] of [[leftId,left],[rightId,right]]){
    stats.titles=honors(id,"H001");stats.peak=honors(id,"H002");stats.annualMvp=honors(id,"H003");
    const goat=(state.goat||[]).find(row=>row.playerId===id);
    stats.goatIndex=season==="all"&&goat?Number(goat.goatIndex):null;
    stats.goatRank=season==="all"&&goat?goat.rank:null;
  }
  const common=matches.filter(match=>validResult(match,leftId)&&validResult(match,rightId));
  const together={matches:common.length,leftPoints:0,rightPoints:0,leftMvp:0,rightMvp:0,leftLeads:0,rightLeads:0,ties:0};
  for(const match of common){
    const l=validResult(match,leftId),r=validResult(match,rightId),a=n(l.score),b=n(r.score);
    together.leftPoints+=a;together.rightPoints+=b;
    if(l.isMvp)together.leftMvp++;
    if(r.isMvp)together.rightMvp++;
    if(a>b)together.leftLeads++; else if(b>a)together.rightLeads++; else together.ties++;
  }
  const matchIds=new Set(common.map(x=>x.matchId));
  const transfers=(state.matchups||[]).filter(row=>matchIds.has(row.matchId)
    && ((row.fromPlayerId===leftId&&row.toPlayerId===rightId)||(row.fromPlayerId===rightId&&row.toPlayerId===leftId))
    && Number.isFinite(Number(row.points)));
  const a=transfers.filter(x=>x.fromPlayerId===leftId),b=transfers.filter(x=>x.fromPlayerId===rightId);
  const aIds=new Set(a.map(x=>x.matchId)),bIds=new Set(b.map(x=>x.matchId));
  const coveredIds=new Set(common.filter(m=>aIds.has(m.matchId)&&bIds.has(m.matchId)).map(m=>m.matchId));
  const pairwise={
    leftPoints:a.filter(row=>coveredIds.has(row.matchId)).reduce((sum,row)=>sum+n(row.points),0),
    rightPoints:b.filter(row=>coveredIds.has(row.matchId)).reduce((sum,row)=>sum+n(row.points),0),
    covered:coveredIds.size,
    leftRecorded:aIds.size,rightRecorded:bIds.size
  };
  return {matches,left,right,common,together,pairwise};
}
export function buildComparisonSeries(matches,leftId,rightId,metric="total"){
  const sums=[0,0],games=[0,0],mvps=[0,0];
  const points=[{matchId:"START",date:"",left:0,right:0,leftScore:null,rightScore:null}];
  for(const match of matches){
    const values=[validResult(match,leftId),validResult(match,rightId)];
    for(let side=0;side<2;side++)if(values[side]){
      games[side]++;sums[side]+=n(values[side].score);if(values[side].isMvp)mvps[side]++;
    }
    const read=side=>metric==="average"?(games[side]?sums[side]/games[side]:0):metric==="mvps"?mvps[side]:sums[side];
    points.push({matchId:match.matchId,date:match.date,season:match.season,
      left:read(0),right:read(1),
      leftScore:values[0]?n(values[0].score):null,rightScore:values[1]?n(values[1].score):null});
  }
  return points;
}
const METRICS=[
  ["total","累计积分",v=>signed(v),true],["average","场均积分",v=>v==null?"—":signed(v,2),true],
  ["games","参赛场次",v=>v+"场",false],["mvps","MVP次数",v=>v+"次",true],
  ["mvpRate","MVP率",v=>v==null?"—":pct(v),true],
  ["positiveRate","非负分率",v=>v==null?"—":pct(v),true],
  ["longest","最长连续非负分",v=>v+"场",true],
  ["best","最高单场积分",v=>v==null?"—":signed(v),true],
  ["explosions","爆发场次（≥50分）",v=>v+"场",true],
  ["titles","赛季总冠军",v=>v+"次",true],
  ["peak","巅峰赛冠军",v=>v+"次",true],
  ["annualMvp","年度最有价值牌手",v=>v+"次",true]
];
const TRENDS=[["total","累计积分"],["average","场均积分"],["mvps","MVP累计次数"]];
const rootMemory=new WeakMap();
function svgForSeries(points,selected){
  const W=860,H=288,pad={l:56,r:18,t:16,b:37},count=Math.max(1,points.length-1);
  const values=points.flatMap(x=>[x.left,x.right]),low=Math.min(0,...values),high=Math.max(0,...values);
  const span=(high-low)||1;
  const x=i=>pad.l+(W-pad.l-pad.r)*(i/count);
  const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-low)/span);
  const mark=(v,d)=>Number(v).toFixed(d);
  const grid=Array.from({length:5},(_,i)=>{
    const val=low+(high-low)*(i/4),pos=y(val);
    return `<line x1="${pad.l}" y1="${pos}" x2="${W-pad.r}" y2="${pos}" class="comparison-grid-line"/><text x="${pad.l-10}" y="${pos+4}" text-anchor="end" class="comparison-axis-label">${mark(val,Math.abs(span)<6?1:0)}</text>`;
  }).join("");
  const line=(side,cls)=>`<polyline class="${cls}" points="${points.map((p,i)=>`${x(i).toFixed(2)},${y(p[side]).toFixed(2)}`).join(" ")}" />`;
  const dots=points.slice(1).map((p,i)=>{
    const index=i+1;
    return `<g class="comparison-plot-dot ${index===selected?"is-selected":""}"><circle class="comparison-hit" data-comparison-point="${index}" cx="${x(index)}" cy="${y(p.left)}" r="9" tabindex="0" role="button" aria-label="${esc(p.matchId)}：查看对比"/><circle class="comparison-dot-left" cx="${x(index)}" cy="${y(p.left)}" r="${index===selected?4.5:2.1}" pointer-events="none"/><circle class="comparison-hit" data-comparison-point="${index}" cx="${x(index)}" cy="${y(p.right)}" r="9" tabindex="0" role="button" aria-label="${esc(p.matchId)}：查看对比"/><circle class="comparison-dot-right" cx="${x(index)}" cy="${y(p.right)}" r="${index===selected?4.5:2.1}" pointer-events="none"/></g>`;
  }).join("");
  const start=points[1],middle=points[Math.ceil(count/2)],end=points[points.length-1];
  const label=(p,at,anchor)=>p?`<text x="${x(at)}" y="${H-8}" class="comparison-axis-label" text-anchor="${anchor}">${esc(String(p.date||"").slice(0,7))}</text>`:"";
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="两位牌手按官方牌局顺序排列的累计表现曲线">
    ${grid}<line class="comparison-zero" x1="${pad.l}" y1="${y(0)}" x2="${W-pad.r}" y2="${y(0)}"/>
    ${line("left","comparison-line-left")}${line("right","comparison-line-right")}
    <line data-comparison-focus class="comparison-focus-guide" x1="${x(selected)}" x2="${x(selected)}" y1="${pad.t}" y2="${H-pad.b}"/>
    ${dots}${label(start,1,"start")}${count>3?label(middle,Math.ceil(count/2),"middle"):""}${label(end,count,"end")}
  </svg>`;
}
function paint(host){
  const info=rootMemory.get(host),{state,options}=info;
  const players=state.players||[];
  if(players.length<2){
    host.innerHTML='<div class="comparison-empty">至少需要两名牌手才能进行比较。</div>';return;
  }
  const valid=new Set(players.map(p=>p.playerId));
  if(!valid.has(info.leftId))info.leftId=players[0].playerId;
  if(!valid.has(info.rightId)||info.rightId===info.leftId)info.rightId=players.find(p=>p.playerId!==info.leftId).playerId;
  const seasons=[...new Set((state.matches||[]).map(m=>m.season).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if(info.season!=="all"&&!seasons.includes(info.season))info.season="all";
  const data=buildPlayerComparison(state,info.leftId,info.rightId,info.season);
  const leftPlayer=players.find(p=>p.playerId===info.leftId),rightPlayer=players.find(p=>p.playerId===info.rightId);
  const playerOpts=selected=>players.map(p=>`<option value="${esc(p.playerId)}" ${p.playerId===selected?"selected":""}>${esc(p.name)}</option>`).join("");
  const seasonOpts='<option value="all">全部赛季</option>'+seasons.map(s=>`<option value="${esc(s)}" ${s===info.season?"selected":""}>${esc(s)} 赛季</option>`).join("");
  const pic=p=>options.portraitHtml?options.portraitHtml(p):`<span class="comparison-avatar-fallback">${esc(p.name.slice(-2))}</span>`;
  const sides=[leftPlayer,rightPlayer];
  const hero=(p,stats,side)=>{
    const global=info.season==="all"&&stats.goatRank!=null;
    return `<div class="comparison-player-card comparison-player-${side}">
      <span class="comparison-player-kicker">${side==="left"?"PLAYER A":"PLAYER B"}</span>
      <div class="comparison-player-portrait">${pic(p)}</div>
      <h3>${esc(p.name)}</h3><p>${esc(p.playerId)}</p>
      <div class="comparison-player-hero-stats">
        <span><small>${info.season==="all"?"生涯总积分":"赛季总积分"}</small><strong>${signed(stats.total)}</strong></span>
        <span><small>${global?"GOAT 排名":"赛季参赛"}</small><strong>${global?"#"+stats.goatRank:stats.games+"场"}</strong></span>
      </div>
    </div>`;
  };
  const rows=METRICS.map(([key,label,format,competitive])=>{
    const a=data.left[key],b=data.right[key],aValid=a!=null&&Number.isFinite(Number(a)),bValid=b!=null&&Number.isFinite(Number(b));
    const tied=aValid&&bValid&&Math.abs(n(a)-n(b))<1e-8,winning=competitive&&aValid&&bValid&&!tied;
    const aWinner=winning&&n(a)>n(b),bWinner=winning&&n(b)>n(a);
    const floor=Math.min(n(a),n(b)),ceil=Math.max(n(a),n(b));
    const width=value=>!aValid||!bValid?0:Math.abs(ceil-floor)<1e-8?50:18+82*((n(value)-floor)/(ceil-floor));
    return `<div class="comparison-stat-row">
      <div class="comparison-stat-value ${aWinner?"is-leader":""}">${esc(format(a))}</div>
      <div class="comparison-stat-track">
        <div class="comparison-stat-heading">${esc(label)}</div>
        <div class="comparison-stat-bars"><span class="comparison-stat-rail"><i class="comparison-fill-left" style="width:${width(a).toFixed(1)}%"></i></span><span class="comparison-stat-rail"><i class="comparison-fill-right" style="width:${width(b).toFixed(1)}%"></i></span></div>
      </div>
      <div class="comparison-stat-value ${bWinner?"is-leader":""}">${esc(format(b))}</div>
    </div>`;
  }).join("");
  const series=buildComparisonSeries(data.matches,info.leftId,info.rightId,info.metric);
  info.selectedPoint=Number.isInteger(info.selectedPoint)?Math.max(0,Math.min(series.length-1,info.selectedPoint)):series.length-1;
  const chosen=series[info.selectedPoint];
  const activeSeason=info.season==="all"?"全部赛季":info.season+" 赛季";
  const chartButtons=TRENDS.map(([key,label])=>`<button type="button" data-comparison-metric="${key}" class="${key===info.metric?"is-active":""}" aria-pressed="${key===info.metric}">${label}</button>`).join("");
  const same=data.together,duel=data.pairwise;
  const avg=pts=>same.matches?(pts/same.matches).toFixed(2):"—";
  const pairStat=(label,a,b,unit="")=>`<div class="comparison-duel-row"><b>${esc(String(a))}${unit}</b><span>${label}</span><b>${esc(String(b))}${unit}</b></div>`;
  const recent=data.common.slice(-6).reverse().map(m=>{
    const left=validResult(m,info.leftId),right=validResult(m,info.rightId);
    return `<button class="comparison-common-match" type="button" data-comparison-match="${esc(m.matchId)}">
        <span><strong>${esc(m.matchId)}</strong><small>${esc(m.date)} · ${esc(m.season)}</small></span>
        <b class="comparison-common-left">${signed(left.score)}</b><i>:</i><b class="comparison-common-right">${signed(right.score)}</b><span class="comparison-match-arrow">↗</span>
      </button>`;
  }).join("");
  host.innerHTML=`<div class="comparison-page">
    <header class="comparison-heading page-identity">
      <div><span class="page-identity-eyebrow">PLAYER COMPARISON / MOAP</span>
      <h2 class="page-identity-title">牌手双人比较</h2><p class="page-identity-description">生涯实力 · 赛季表现 · 历史同场交锋</p></div>
      <button type="button" data-comparison-action="back" class="comparison-back">← 返回个人中心</button>
    </header>
    <div class="comparison-toolbar">
      <label>牌手 A<select data-comparison-select="left" aria-label="选择左侧牌手">${playerOpts(info.leftId)}</select></label>
      <button type="button" class="comparison-swap" data-comparison-action="swap" aria-label="交换两名牌手">⇄</button>
      <label>牌手 B<select data-comparison-select="right" aria-label="选择右侧牌手">${playerOpts(info.rightId)}</select></label>
      <label class="comparison-season-choice">统计范围<select data-comparison-select="season" aria-label="筛选赛季">${seasonOpts}</select></label>
    </div>
    <div class="comparison-versus">
      ${hero(leftPlayer,data.left,"left")}
      <div class="comparison-vs-mark"><span>VS</span><small>${activeSeason}</small></div>
      ${hero(rightPlayer,data.right,"right")}
    </div>
    <section class="comparison-panel comparison-scoreboard">
      <header class="comparison-panel-head"><div><small>01 / CORE METRICS</small><h3>核心实力对比</h3></div><p>领先数据高亮 · 以同一统计范围计算</p></header>
      <div class="comparison-stat-head"><span>${esc(leftPlayer.name)}</span><span>指标</span><span>${esc(rightPlayer.name)}</span></div>
      <div class="comparison-stat-list">${rows}</div>
      ${info.season==="all"&&data.left.goatIndex!=null&&data.right.goatIndex!=null?`<div class="comparison-goat-row"><span>GOAT 综合指数</span><b>${data.left.goatIndex.toFixed(1)}</b><span class="comparison-goat-divider">:</span><b>${data.right.goatIndex.toFixed(1)}</b><small>仅展示完整生涯 GOAT，赛季筛选不混入全生涯指数</small></div>`:""}
      <p class="comparison-fineprint">参赛场次只表示样本量；其余指标标示数值较高者，不进行指标数量加权。条形长度为双方相对位置，不代表全联盟排名。非负分率包括零分，爆发定义为单场 ≥50分。</p>
    </section>
    <section class="comparison-panel comparison-chart-panel">
      <header class="comparison-panel-head"><div><small>02 / CAREER TRAJECTORY</small><h3>生涯轨迹对决</h3></div><div class="comparison-chart-options" role="group" aria-label="趋势指标">${chartButtons}</div></header>
      <div class="comparison-chart-legend"><span class="comparison-legend-left">${esc(leftPlayer.name)}</span><span class="comparison-legend-right">${esc(rightPlayer.name)}</span><small>横轴：${activeSeason}官方牌局顺序</small></div>
      ${data.matches.length?`<div class="comparison-chart-scroll"><div class="comparison-svg-wrap">${svgForSeries(series,info.selectedPoint)}</div></div>
      <div class="comparison-scrubber"><label for="comparisonPointSlider">查看牌局轨迹节点</label><input id="comparisonPointSlider" data-comparison-slider type="range" min="0" max="${series.length-1}" step="1" value="${info.selectedPoint}"/></div>
      <div class="comparison-focus" data-comparison-focus-panel aria-live="polite"></div>`:'<div class="comparison-empty">当前赛季暂无可用于绘制曲线的牌局。</div>'}
    </section>
    <section class="comparison-panel comparison-match-panel">
      <header class="comparison-panel-head"><div><small>03 / SHARED TABLE HISTORY</small><h3>同场表现与精准对位</h3></div><span class="comparison-count">共同参赛 ${same.matches} 场</span></header>
      ${same.matches?`<div class="comparison-duel-list">
        ${pairStat("共同参赛总积分",signed(same.leftPoints),signed(same.rightPoints))}
        ${pairStat("共同参赛场均积分",avg(same.leftPoints),avg(same.rightPoints))}
        ${pairStat("共同参赛 MVP",same.leftMvp,same.rightMvp,"次")}
        ${pairStat("同场积分高于对方",same.leftLeads,same.rightLeads,"场")}
        <p class="comparison-shared-note">同场积分领先并非一对一输赢；双方分数来自完整牌局，分数相同 ${same.ties} 场。</p>
      </div>`:'<div class="comparison-empty">这两位牌手在所选范围内暂无共同参赛记录。</div>'}
      <div class="comparison-transfer-block">
        <h4>精准方向对位 <small>双方独立记录 · 不推算</small></h4>
        ${duel.covered?`<div class="comparison-transfer-values"><strong>${signed(duel.leftPoints)}</strong><span>→ 实际方向积分 ←<small>双方方向均有记录 ${duel.covered} / ${same.matches} 场</small></span><strong>${signed(duel.rightPoints)}</strong></div>
        <p class="comparison-shared-note">左侧为「${esc(leftPlayer.name)} → ${esc(rightPlayer.name)}」各场记录之和，右侧反之。只使用已记载方向格，两个方向不要求互为相反数。</p>`:'<p class="comparison-shared-note">当前双方共同参赛的牌局中，暂无双方方向均有记录的精准对位数据；不根据整场积分反推对位结果。</p>'}
      </div>
      <div class="comparison-recent-head"><h4>最近共同参赛</h4><small>点击查看原始牌局</small></div>
      <div class="comparison-common-list">${recent||'<div class="comparison-empty">暂无共同参赛牌局。</div>'}</div>
    </section>
    <p class="comparison-source-note">所有指标均基于 MOAP 当前载入的正式牌局数据即时计算。云端是否同步成功，请以上方系统状态为准。</p>
  </div>`;
  if(data.matches.length)updateFocus(host);
}
function updateFocus(host){
  const info=rootMemory.get(host);if(!info)return;
  const data=buildPlayerComparison(info.state,info.leftId,info.rightId,info.season);
  const points=buildComparisonSeries(data.matches,info.leftId,info.rightId,info.metric);
  if(points.length<=1)return;
  info.selectedPoint=Math.max(0,Math.min(points.length-1,info.selectedPoint ?? points.length-1));
  const point=points[info.selectedPoint],players=info.state.players||[];
  const names=[info.leftId,info.rightId].map(id=>players.find(p=>p.playerId===id)?.name||id);
  const meta=info.selectedPoint===0?"起点 · 0场":`${esc(point.matchId)} · ${esc(point.date)} · ${esc(point.season)}`;
  const format=v=>info.metric==="average"?signed(v,2):signed(v);
  const score=v=>v==null?"本场未参赛":`本场 ${signed(v)}`;
  const holder=host.querySelector("[data-comparison-focus-panel]");
  if(holder)holder.innerHTML=`<div><small>选中节点</small><b>${meta}</b></div>
    <div><small>${esc(names[0])}</small><b class="comparison-left-text">${format(point.left)}</b><em>${score(point.leftScore)}</em></div>
    <div><small>${esc(names[1])}</small><b class="comparison-right-text">${format(point.right)}</b><em>${score(point.rightScore)}</em></div>`;
  const line=host.querySelector("[data-comparison-focus]");
  if(line){
    const x=56+(860-56-18)*(info.selectedPoint/(points.length-1));
    line.setAttribute("x1",x);line.setAttribute("x2",x);
  }
  host.querySelectorAll(".comparison-plot-dot").forEach((node,i)=>node.classList.toggle("is-selected",i===info.selectedPoint-1));
  const slider=host.querySelector("[data-comparison-slider]");if(slider)slider.value=String(info.selectedPoint);
}
export function renderPlayerComparison(host,state,options={}){
  if(!host)return;
  let info=rootMemory.get(host);
  if(!info){
    info={leftId:options.preferredPlayerId||null,rightId:null,season:"all",metric:"total",selectedPoint:null,state,options};
    rootMemory.set(host,info);
    host.addEventListener("change",event=>{
      const sel=event.target.closest("[data-comparison-select]");if(!sel)return;
      const action=sel.dataset.comparisonSelect,oldLeft=info.leftId,oldRight=info.rightId;
      if(action==="left"){info.leftId=sel.value;if(info.leftId===oldRight)info.rightId=oldLeft;}
      else if(action==="right"){info.rightId=sel.value;if(info.rightId===oldLeft)info.leftId=oldRight;}
      else if(action==="season")info.season=sel.value;
      info.selectedPoint=null;paint(host);
    });
    host.addEventListener("click",event=>{
      const action=event.target.closest("[data-comparison-action]")?.dataset.comparisonAction;
      if(action==="back"){info.options.onBack?.();return;}
      if(action==="swap"){[info.leftId,info.rightId]=[info.rightId,info.leftId];paint(host);return;}
      const metric=event.target.closest("[data-comparison-metric]")?.dataset.comparisonMetric;
      if(metric&&TRENDS.some(x=>x[0]===metric)){info.metric=metric;info.selectedPoint=null;paint(host);return;}
      const match=event.target.closest("[data-comparison-match]")?.dataset.comparisonMatch;
      if(match){info.options.onMatch?.(match);return;}
      const point=event.target.closest("[data-comparison-point]")?.dataset.comparisonPoint;
      if(point!=null){info.selectedPoint=Number(point);updateFocus(host);}
    });
    host.addEventListener("input",event=>{
      if(event.target.matches("[data-comparison-slider]")){info.selectedPoint=Number(event.target.value);updateFocus(host);}
    });
    host.addEventListener("keydown",event=>{
      if((event.key==="Enter"||event.key===" ")&&event.target.matches("[data-comparison-point]")){
        event.preventDefault();info.selectedPoint=Number(event.target.dataset.comparisonPoint);updateFocus(host);
      }
    });
  }else {
    info.state=state;info.options=options;
    if(options.preferredPlayerId && (state.players||[]).some(p=>p.playerId===options.preferredPlayerId)){
      if(info.leftId!==options.preferredPlayerId && info.rightId===options.preferredPlayerId)info.rightId=info.leftId;
      info.leftId=options.preferredPlayerId;
      info.selectedPoint=null;
    }
  }
  paint(host);
}
