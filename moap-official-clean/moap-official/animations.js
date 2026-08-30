import { gsap } from "./motion-runtime.js";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const BUTTON_SELECTOR = "button:not(:disabled), .btn:not(:disabled), [role='button']:not([aria-disabled='true'])";
const NUMBER_SELECTOR = [
  "[data-animate-number]",
  ".kpi-value",
  ".mini-stat strong",
  ".season-core-stats b",
  ".season-rating-hero strong",
  ".season-compare b",
  ".season-dimension b",
  ".career-metric-grid b",
  ".career-ovr strong",
  ".goat-rating strong",
  ".profile-rating-pills b",
  ".record-table tbody td",
  ".record-table tbody td > b",
  ".record-ranking-row > b",
  ".record-info-grid b",
  ".record-modal-header strong",
  ".score-row > b",
  ".monthly-kpis b",
  ".monthly-grid b",
  ".monthly-hero > b",
  ".split-stats strong",
  ".rival-summary-inline td",
  ".goat-score-v2 > b",
  ".scouting-index > b",
  ".honor-ranking-card > header > b"
].join(",");

const MOAP_MOTION = Object.freeze({
  duration:Object.freeze({fast:.14,normal:.32,slow:.46}),
  distance:Object.freeze({enter:12,small:6,card:3}),
  stagger:Object.freeze({fast:.045,normal:.06}),
  ease:Object.freeze({enter:"power2.out",exit:"power1.in"})
});

let initialized = false;
let viewTimeline = null;
let recordTimeline = null;
let filterTimeline = null;
let detailTimeline = null;
let playerEntryTimeline = null;
let playerSwitchTimeline = null;
let playerDataTimeline = null;
let playerTrendTimeline = null;
let playerRecentTimeline = null;
let playerTrendInteractionCleanup = null;
let honorEntryTimeline = null;
let honorCardTimeline = null;
let honorFilterTimeline = null;
let honorDetailTimeline = null;
let goatRankingTimeline = null;
let honorShineObserver = null;
const honorShineHistory = new Set();
const numberHistory = new Map();
const numberTweens = new Map();

function motionEngine(){
  return gsap;
}

export function prefersReducedMotion(){
  return Boolean(window.matchMedia?.(MOTION_QUERY)?.matches);
}

function motionDisabled(){
  return prefersReducedMotion() || !motionEngine();
}

function toElements(input){
  if(!input)return [];
  if(input instanceof Element)return [input];
  return [...input].filter(item=>item instanceof Element);
}

function clearMotionProps(elements){
  const gsap=motionEngine();
  if(!gsap||!elements.length)return;
  gsap.set(elements,{clearProps:"opacity,visibility,transform"});
}

export function initAnimationSystem(){
  if(initialized)return;
  initialized=true;
  const gsap=motionEngine();
  if(gsap){
    gsap.config({nullTargetWarn:false});
    gsap.defaults({ease:"power2.out"});
  }
  document.addEventListener("pointerdown",event=>{
    if(motionDisabled())return;
    const target=event.target.closest?.(BUTTON_SELECTOR);
    if(!target||!target.isConnected)return;
    const engine=motionEngine();
    engine.killTweensOf(target);
    engine.timeline()
      .to(target,{scale:.97,duration:.07,ease:"power1.out",overwrite:true})
      .to(target,{scale:1,duration:.12,ease:"power2.out",clearProps:"transform"});
  },{passive:true});
}

export function transitionView({outgoing,incoming,swap,immediate=false,onEntered}){
  const gsap=motionEngine();
  viewTimeline?.kill();
  recordTimeline?.kill();
  clearMotionProps([...document.querySelectorAll(".view")]);

  if(immediate||motionDisabled()||!incoming){
    swap();
    onEntered?.();
    return;
  }

  const enter=()=>{
    viewTimeline=gsap.timeline({
      onComplete:()=>{
        clearMotionProps([incoming]);
        viewTimeline=null;
        onEntered?.();
      }
    }).fromTo(
      incoming,
      {autoAlpha:0,y:10},
      {autoAlpha:1,y:0,duration:.3,ease:"power2.out"}
    );
  };

  if(outgoing&&outgoing!==incoming){
    viewTimeline=gsap.timeline({
      onComplete:()=>{
        clearMotionProps([incoming]);
        viewTimeline=null;
        onEntered?.();
      }
    })
      .to(outgoing,{autoAlpha:0,y:-4,duration:.14,ease:"power1.in"})
      .call(()=>{
        swap();
        clearMotionProps([outgoing]);
      })
      .fromTo(
        incoming,
        {autoAlpha:0,y:10},
        {autoAlpha:1,y:0,duration:.3,ease:"power2.out"}
      );
    return;
  }

  swap();
  enter();
}

export function animateRecordCenterEntry(root){
  const gsap=motionEngine();
  recordTimeline?.kill();
  if(!root||motionDisabled())return;

  const title=root.querySelector(".hero");
  const filters=[
    root.querySelector(".record-data-head"),
    root.querySelector(".record-toolbar")
  ].filter(Boolean);
  const regions=[
    root.querySelector(".record-data-leaderboard .table-scroll"),
    root.querySelector("#recordSummary"),
    root.querySelector(".record-center-card .record-table-scroll")
  ].filter(Boolean);
  const rows=[...root.querySelectorAll("#dataLeaderboardBody tr, #recordTableBody tr")].slice(0,18);
  const animated=[title,...filters,...regions,...rows].filter(Boolean);
  clearMotionProps(animated);

  recordTimeline=gsap.timeline({
    defaults:{ease:"power2.out"},
    onComplete:()=>{
      clearMotionProps(animated);
      recordTimeline=null;
    }
  });
  if(title)recordTimeline.fromTo(title,{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.3});
  if(filters.length)recordTimeline.fromTo(filters,{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:.32,stagger:.05},"-=.12");
  if(regions.length)recordTimeline.fromTo(regions,{autoAlpha:0,y:12},{autoAlpha:1,y:0,duration:.34,stagger:.06},"-=.14");
  if(rows.length)recordTimeline.fromTo(rows,{autoAlpha:0,y:14},{autoAlpha:1,y:0,duration:.42,stagger:.05},"-=.18");
}

export function transitionRecordContent({targets,update,onUpdated}){
  const gsap=motionEngine();
  const elements=toElements(targets);
  filterTimeline?.kill();
  clearMotionProps(elements);

  if(motionDisabled()||!elements.length){
    update();
    onUpdated?.();
    return;
  }

  filterTimeline=gsap.timeline({
    onComplete:()=>{
      clearMotionProps(elements);
      filterTimeline=null;
    }
  })
    .to(elements,{autoAlpha:0,y:4,duration:.12,ease:"power1.in",stagger:.015})
    .call(()=>{
      update();
      onUpdated?.();
    })
    .fromTo(
      elements,
      {autoAlpha:0,y:6},
      {autoAlpha:1,y:0,duration:.2,ease:"power2.out",stagger:.02}
    );
}

function parseNumericText(text){
  const value=String(text??"").trim();
  const matches=[...value.matchAll(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g)];
  if(matches.length!==1)return null;
  const match=matches[0];
  const token=match[0];
  const prefix=value.slice(0,match.index);
  const suffix=value.slice((match.index||0)+token.length);
  if(/[A-Za-z]$/.test(prefix.trim()))return null;
  const numeric=Number(token.replace(/,/g,""));
  if(!Number.isFinite(numeric))return null;
  const decimals=(token.split(".")[1]||"").length;
  return {
    target:numeric,
    prefix,
    suffix,
    decimals,
    thousands:token.includes(","),
    forcePlus:token.startsWith("+")
  };
}

function formatAnimatedNumber(value,format){
  const threshold=.5/(10**format.decimals);
  const normalized=Math.abs(value)<threshold?0:value;
  let number;
  if(format.thousands){
    number=normalized.toLocaleString("en-US",{
      minimumFractionDigits:format.decimals,
      maximumFractionDigits:format.decimals
    });
  }else{
    number=normalized.toFixed(format.decimals);
  }
  if(format.forcePlus&&normalized>0)number="+"+number;
  return format.prefix+number+format.suffix;
}

function numberKey(element,index,root){
  const explicit=element.dataset.animationKey;
  if(explicit)return explicit;
  const view=element.closest(".view")?.dataset.view||"global";
  const row=element.closest("tr");
  const cell=element.closest("td,th");
  const cellIndex=row&&cell?[...row.children].indexOf(cell):-1;
  const rowLabel=row?.dataset.recordId||row?.dataset.matchId||row?.children?.[0]?.textContent?.trim()||"";
  const parent=element.parentElement;
  const label=parent?.querySelector?.(":scope > .kpi-label, :scope > span, :scope > small")?.textContent?.trim()||"";
  const scope=root?.id||root?.className||"view";
  return [view,scope,rowLabel,label,cellIndex,index].join("|");
}

function animateNumberCandidates(candidates,root,{duration,delayFor}={}){
  const gsap=motionEngine();
  const mobile=window.matchMedia?.("(max-width: 760px)")?.matches;
  const tweenDuration=duration??(mobile?.65:.78);

  candidates.forEach((element,index)=>{
    const original=element.textContent;
    const format=parseNumericText(original);
    if(!format)return;
    const key=numberKey(element,index,root);
    const previous=numberHistory.has(key)?numberHistory.get(key):0;
    const delay=Math.max(0,Number(delayFor?.(element,index)||0));
    numberHistory.set(key,format.target);

    numberTweens.get(key)?.kill();
    if(motionDisabled()||previous===format.target){
      element.textContent=original;
      return;
    }

    const proxy={value:previous};
    element.textContent=formatAnimatedNumber(previous,format);
    let tween=null;
    tween=gsap.to(proxy,{
      value:format.target,
      duration:tweenDuration,
      delay,
      ease:"power2.out",
      overwrite:true,
      onUpdate:()=>{
        if(!element.isConnected){
          tween?.kill();
          return;
        }
        element.textContent=formatAnimatedNumber(proxy.value,format);
      },
      onComplete:()=>{
        element.textContent=original;
        if(numberTweens.get(key)===tween)numberTweens.delete(key);
      }
    });
    numberTweens.set(key,tween);
  });
}

export function animateNumbers(root=document,{duration}={}){
  if(!root?.querySelectorAll)return;
  const candidates=[...root.querySelectorAll(NUMBER_SELECTOR)]
    .filter(element=>element.children.length===0&&!element.hasAttribute("data-player-number"));
  animateNumberCandidates(candidates,root,{duration});
}

export function animatePlayerSeasonNumbers(root=document,{baseDelay=0}={}){
  const table=root?.matches?.("#playerSeasonTable")?root:root?.querySelector?.("#playerSeasonTable");
  if(!table)return;
  const rows=[...table.querySelectorAll("tr")];
  const candidates=[...table.querySelectorAll("[data-player-number]")];
  animateNumberCandidates(candidates,table,{
    duration:mobileMotion()?.62:.78,
    delayFor:element=>{
      const row=element.closest("tr");
      const rowIndex=Math.max(0,rows.indexOf(row));
      return baseDelay+(row?.classList.contains("season-total-row")?.16:rowIndex*.04);
    }
  });
}

function animatePlayerRecentNumbers(root=document,{baseDelay=0}={}){
  const holder=root?.matches?.("#recentMatchesPlayer")?root:root?.querySelector?.("#recentMatchesPlayer");
  if(!holder)return;
  const rows=[...holder.querySelectorAll("[data-recent-match]")];
  const candidates=[...holder.querySelectorAll("[data-player-number]")];
  animateNumberCandidates(candidates,holder,{
    duration:mobileMotion()?.42:.52,
    delayFor:element=>{
      const rowIndex=Math.max(0,rows.indexOf(element.closest("[data-recent-match]")));
      return baseDelay+.1+rowIndex*.06;
    }
  });
}

function mobileMotion(){
  return Boolean(window.matchMedia?.("(max-width: 760px)")?.matches);
}

function directChildren(root,selector){
  return root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
}

function clearExtendedMotionProps(elements,extra=""){
  const gsap=motionEngine();
  const list=toElements(elements);
  if(!gsap||!list.length)return;
  const props=["opacity","visibility","transform",extra].filter(Boolean).join(",");
  gsap.set(list,{clearProps:props});
}

function clearPlayerTrendInteraction(){
  playerTrendInteractionCleanup?.();
  playerTrendInteractionCleanup=null;
}

function bindPlayerTrendInteraction(root){
  clearPlayerTrendInteraction();
  const chart=root?.querySelector?.("#trendChart")||root;
  const wrap=chart?.closest?.(".trend-wrap");
  const tooltip=wrap?.querySelector?.(".trend-tooltip");
  const guide=chart?.querySelector?.(".trend-guide");
  const dots=chart?.querySelectorAll ? [...chart.querySelectorAll(".trend-dot")] : [];
  const finePointer=window.matchMedia?.("(hover:hover) and (pointer:fine)")?.matches;
  if(!chart||!wrap||!tooltip||!guide||!dots.length||!finePointer)return;

  const gsap=motionEngine();
  const reduced=motionDisabled();
  const baseRadius=Number(dots[0]?.getAttribute("r")||3.2);
  const activeRadius=4.35;
  let activeDot=null;
  const title=tooltip.querySelector("[data-trend-title]");
  const date=tooltip.querySelector("[data-trend-date]");
  const mvp=tooltip.querySelector("[data-trend-mvp]");
  const score=tooltip.querySelector("[data-trend-score]");
  const total=tooltip.querySelector("[data-trend-total]");
  gsap.set(dots,{attr:{r:baseRadius},clearProps:"transform,transformOrigin"});

  const hide=()=>{
    if(activeDot){
      activeDot.classList.remove("is-active");
      gsap.killTweensOf(activeDot);
      if(reduced)gsap.set(activeDot,{autoAlpha:0,attr:{r:baseRadius}});
      else gsap.to(activeDot,{autoAlpha:0,attr:{r:baseRadius},duration:.12,ease:"power1.out",overwrite:true});
      activeDot=null;
    }
    tooltip.setAttribute("aria-hidden","true");
    gsap.killTweensOf([tooltip,guide]);
    if(reduced){
      gsap.set([tooltip,guide],{autoAlpha:0});
    }else{
      gsap.to(tooltip,{autoAlpha:0,duration:.12,ease:"power1.out",overwrite:true});
      gsap.to(guide,{autoAlpha:0,duration:.1,ease:"power1.out",overwrite:true});
    }
  };

  const show=dot=>{
    if(activeDot!==dot){
      if(activeDot){
        activeDot.classList.remove("is-active");
        gsap.killTweensOf(activeDot);
        gsap.to(activeDot,{autoAlpha:0,attr:{r:baseRadius},duration:reduced?0:.1,ease:"power1.out",overwrite:true});
      }
      activeDot=dot;
      activeDot.classList.add("is-active");
      gsap.killTweensOf(activeDot);
      gsap.to(activeDot,{autoAlpha:1,attr:{r:reduced?baseRadius:activeRadius},duration:reduced?0:.16,ease:"power2.out",overwrite:true});
    }

    const season=dot.dataset.season||"";
    const round=dot.dataset.round||"";
    const dateValue=dot.dataset.date||"";
    const isMvp=dot.dataset.mvp==="true";
    if(title)title.textContent=[season,round?("第"+round+"场"):""].filter(Boolean).join(" · ");
    if(date){date.textContent=dateValue;date.hidden=!dateValue;}
    if(mvp){mvp.textContent="MVP";mvp.hidden=!isMvp;}
    if(score){
      score.textContent="本场积分 "+(dot.dataset.score||"");
      const raw=Number(dot.dataset.scoreValue);
      score.classList.toggle("score-pos",raw>=0);
      score.classList.toggle("score-neg",raw<0);
    }
    if(total)total.textContent="累计积分 "+(dot.dataset.cumulative||"");

    const cx=Number(dot.getAttribute("cx")||0);
    const dotRect=dot.getBoundingClientRect();
    const wrapRect=wrap.getBoundingClientRect();
    const px=dotRect.left+dotRect.width/2-wrapRect.left;
    const py=dotRect.top+dotRect.height/2-wrapRect.top;
    const tooltipWidth=tooltip.offsetWidth||160;
    const tooltipHeight=tooltip.offsetHeight||82;
    const x=Math.max(8,Math.min(wrapRect.width-tooltipWidth-8,px-tooltipWidth/2));
    const above=py-tooltipHeight-12;
    const y=above>=8?above:Math.min(wrapRect.height-tooltipHeight-8,py+14);

    tooltip.setAttribute("aria-hidden","false");
    gsap.killTweensOf([tooltip,guide]);
    if(reduced){
      gsap.set(tooltip,{x,y,autoAlpha:1});
      gsap.set(guide,{attr:{x1:cx,x2:cx},autoAlpha:1});
    }else{
      gsap.to(tooltip,{x,y,autoAlpha:1,duration:.16,ease:"power2.out",overwrite:true});
      gsap.to(guide,{attr:{x1:cx,x2:cx},autoAlpha:1,duration:.16,ease:"power2.out",overwrite:true});
    }
  };

  const handleMove=event=>{
    if(event.pointerType==="touch")return;
    let nearest=null;
    let nearestDistance=Infinity;
    dots.forEach(dot=>{
      const rect=dot.getBoundingClientRect();
      const nodeX=rect.left+rect.width/2;
      const nodeY=rect.top+rect.height/2;
      const distance=Math.hypot(nodeX-event.clientX,nodeY-event.clientY);
      if(distance<nearestDistance){
        nearest=dot;
        nearestDistance=distance;
      }
    });
    if(!nearest||nearestDistance>44){
      hide();
      return;
    }
    show(nearest);
  };
  const handleLeave=()=>hide();
  const handleResize=()=>{if(activeDot)show(activeDot);};
  const resizeObserver=typeof ResizeObserver==="function"?new ResizeObserver(handleResize):null;

  chart.addEventListener("pointermove",handleMove,{passive:true});
  chart.addEventListener("pointerleave",handleLeave,{passive:true});
  window.addEventListener("resize",handleResize,{passive:true});
  resizeObserver?.observe(chart);
  playerTrendInteractionCleanup=()=>{
    chart.removeEventListener("pointermove",handleMove);
    chart.removeEventListener("pointerleave",handleLeave);
    window.removeEventListener("resize",handleResize);
    resizeObserver?.disconnect();
    hide();
    gsap.killTweensOf(dots);
    gsap.set(dots,{attr:{r:baseRadius},clearProps:"opacity,visibility,transform,transformOrigin"});
    gsap.set([tooltip,guide],{clearProps:"opacity,visibility,transform"});
  };
}

export function animatePlayerTrend(root,{delay=0}={}){
  const chart=root?.querySelector?.("#trendChart")||root;
  const line=chart?.querySelector?.(".trend-line");
  const reveal=chart?.querySelector?.(".trend-area-reveal");
  const animated=[line,reveal].filter(Boolean);
  playerTrendTimeline?.kill();
  clearPlayerTrendInteraction();

  if(!line){
    clearExtendedMotionProps(animated,"strokeDasharray,strokeDashoffset,transformOrigin");
    return;
  }

  let length=0;
  try{length=line.getTotalLength();}catch{return;}
  const gsap=motionEngine();
  clearExtendedMotionProps(animated,"strokeDasharray,strokeDashoffset,transformOrigin");

  if(motionDisabled()){
    bindPlayerTrendInteraction(root);
    return;
  }

  const mobile=mobileMotion();
  const duration=mobile?1.2:1.55;
  gsap.set(line,{strokeDasharray:length,strokeDashoffset:length});
  if(reveal)gsap.set(reveal,{scaleX:0,transformOrigin:"left center"});

  playerTrendTimeline=gsap.timeline({
    delay,
    onComplete:()=>{
      clearExtendedMotionProps(animated,"strokeDasharray,strokeDashoffset,transformOrigin");
      playerTrendTimeline=null;
      bindPlayerTrendInteraction(root);
    }
  })
    .to(line,{strokeDashoffset:0,duration,ease:"power1.inOut"},0);
  if(reveal)playerTrendTimeline.to(reveal,{scaleX:1,duration:duration*.94,ease:"none"},.04);
}

function animateRecentMatches(root,{delay=0}={}){
  const holder=root?.querySelector?.("#recentMatchesPlayer")||root;
  const rows=holder?.querySelectorAll ? [...holder.querySelectorAll("[data-recent-match]")] : [];
  const badges=holder?.querySelectorAll ? [...holder.querySelectorAll(".recent-mvp-badge")] : [];
  const latest=rows[0];
  playerRecentTimeline?.kill();
  clearMotionProps(rows);
  clearExtendedMotionProps(badges);
  latest?.classList.remove("recent-glow-once");
  animatePlayerRecentNumbers(root,{baseDelay:delay});

  if(!rows.length||motionDisabled())return;

  const gsap=motionEngine();
  const mobile=mobileMotion();
  const rowDuration=mobile?.28:.34;
  const stagger=mobile?.05:.06;
  gsap.set(rows,{autoAlpha:0,y:mobile?5:8});
  if(badges.length)gsap.set(badges,{autoAlpha:0,scale:.9,transformOrigin:"center"});

  playerRecentTimeline=gsap.timeline({
    delay,
    onComplete:()=>{
      clearMotionProps(rows);
      clearExtendedMotionProps(badges);
      if(latest?.isConnected){
        latest.classList.remove("recent-glow-once");
        void latest.offsetWidth;
        latest.classList.add("recent-glow-once");
      }
      playerRecentTimeline=null;
    }
  }).to(rows,{autoAlpha:1,y:0,duration:rowDuration,stagger,ease:MOAP_MOTION.ease.enter},0);

  badges.forEach(badge=>{
    const rowIndex=Math.max(0,rows.indexOf(badge.closest("[data-recent-match]")));
    playerRecentTimeline.fromTo(
      badge,
      {autoAlpha:0,scale:.9},
      {autoAlpha:1,scale:1,duration:mobile?.2:.24,ease:MOAP_MOTION.ease.enter},
      rowDuration+rowIndex*stagger+.07
    );
  });
}

function animatePlayerDataExperience(root,{delay=0}={}){
  animatePlayerSeasonNumbers(root,{baseDelay:delay+.08});
  animatePlayerTrend(root,{delay:delay+.16});
  animateRecentMatches(root,{delay:delay+.22});
}

function stopPlayerDataExperience(root){
  playerTrendTimeline?.kill();
  playerTrendTimeline=null;
  playerRecentTimeline?.kill();
  playerRecentTimeline=null;
  clearPlayerTrendInteraction();
  const chart=root?.querySelector?.("#trendChart");
  const trendParts=chart?[chart.querySelector(".trend-line"),chart.querySelector(".trend-area-reveal"),...chart.querySelectorAll(".trend-dot")].filter(Boolean):[];
  clearExtendedMotionProps(trendParts,"strokeDasharray,strokeDashoffset,transformOrigin");
  const recentRows=root?.querySelectorAll ? [...root.querySelectorAll("#recentMatchesPlayer [data-recent-match]")] : [];
  const recentBadges=root?.querySelectorAll ? [...root.querySelectorAll("#recentMatchesPlayer .recent-mvp-badge")] : [];
  clearMotionProps(recentRows);
  clearExtendedMotionProps(recentBadges);
  recentRows[0]?.classList.remove("recent-glow-once");
}

function playerLayers(root){
  const gridCards=directChildren(root,":scope > .grid-2 > .card");
  const current=root?.querySelector?.(".current-season-performance-card");
  const scouting=root?.querySelector?.("#playerScouting")?.closest?.(".card");
  return [
    root?.querySelector?.("#playerHeader"),
    current,
    root?.querySelector?.(".player-season-data-card"),
    ...gridCards,
    root?.querySelector?.(".profile-honors-home"),
    scouting
  ].filter(Boolean);
}

export function animatePlayerCenterEntry(root){
  const gsap=motionEngine();
  playerEntryTimeline?.kill();
  playerSwitchTimeline?.kill();
  stopPlayerDataExperience(root);
  const layers=playerLayers(root);
  if(!root||motionDisabled()||!layers.length){
    animatePlayerDataExperience(root);
    return;
  }
  const mobile=mobileMotion();
  clearMotionProps(layers);
  animatePlayerDataExperience(root);
  playerEntryTimeline=gsap.timeline({
    defaults:{ease:MOAP_MOTION.ease.enter},
    onComplete:()=>{
      clearMotionProps(layers);
      playerEntryTimeline=null;
    }
  }).fromTo(
    layers,
    {autoAlpha:0,y:mobile?8:MOAP_MOTION.distance.enter},
    {autoAlpha:1,y:0,duration:mobile?.34:.42,stagger:mobile?.035:MOAP_MOTION.stagger.normal}
  );
}

export function transitionPlayerProfile({root,update,onUpdated}){
  const gsap=motionEngine();
  playerEntryTimeline?.kill();
  playerSwitchTimeline?.kill();
  stopPlayerDataExperience(root);
  const before=playerLayers(root);
  clearMotionProps(before);

  if(motionDisabled()||!before.length){
    update();
    onUpdated?.();
    animatePlayerDataExperience(root);
    return;
  }

  const mobile=mobileMotion();
  playerSwitchTimeline=gsap.timeline({
    onComplete:()=>{
      clearMotionProps(playerLayers(root));
      playerSwitchTimeline=null;
    }
  })
    .to(before,{autoAlpha:0,y:mobile?2:4,duration:MOAP_MOTION.duration.fast,ease:MOAP_MOTION.ease.exit,stagger:.008})
    .call(()=>{
      update();
      onUpdated?.();
      animatePlayerDataExperience(root);
    })
    .fromTo(
      playerLayers(root),
      {autoAlpha:0,y:mobile?6:10},
      {autoAlpha:1,y:0,duration:mobile?.27:MOAP_MOTION.duration.normal,ease:MOAP_MOTION.ease.enter,stagger:mobile?.025:MOAP_MOTION.stagger.fast}
    );
}

export function transitionPlayerData({target,update,onUpdated}){
  const gsap=motionEngine();
  const elements=toElements(target);
  playerDataTimeline?.kill();
  clearMotionProps(elements);
  if(motionDisabled()||!elements.length){
    update();
    onUpdated?.();
    return;
  }

  playerDataTimeline=gsap.timeline({
    onComplete:()=>{
      clearMotionProps(elements);
      playerDataTimeline=null;
    }
  })
    .to(elements,{autoAlpha:0,y:3,duration:.12,ease:MOAP_MOTION.ease.exit})
    .call(()=>{
      update();
      onUpdated?.();
    })
    .fromTo(elements,{autoAlpha:0,y:mobileMotion()?3:6},{autoAlpha:1,y:0,duration:.2,ease:MOAP_MOTION.ease.enter});
}

function playHonorShine(card,key){
  if(!card?.isConnected||honorShineHistory.has(key)||prefersReducedMotion()||mobileMotion())return;
  honorShineHistory.add(key);
  card.classList.remove("honor-shine-once");
  void card.offsetWidth;
  card.classList.add("honor-shine-once");
}

function queueHonorShine(cards){
  if(prefersReducedMotion()||mobileMotion())return;
  const eligible=cards.filter(card=>{
    const key=card.dataset.honorBoard||card.dataset.honorKey||card.textContent?.trim()||"";
    return key&&!honorShineHistory.has(key);
  });
  if(!eligible.length)return;

  if(!("IntersectionObserver" in window)){
    eligible.forEach(card=>playHonorShine(card,card.dataset.honorBoard||card.dataset.honorKey||card.textContent.trim()));
    return;
  }

  honorShineObserver ||= new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      honorShineObserver?.unobserve(entry.target);
      const key=entry.target.dataset.honorBoard||entry.target.dataset.honorKey||entry.target.textContent.trim();
      playHonorShine(entry.target,key);
    });
  },{threshold:.24});
  eligible.forEach(card=>honorShineObserver.observe(card));
}

export function animateGoatRanking(root){
  const gsap=motionEngine();
  const rows=directChildren(root,".goat-row");
  goatRankingTimeline?.kill();
  clearMotionProps(rows);
  if(!rows.length||motionDisabled())return;

  const mobile=mobileMotion();
  rows.forEach(row=>{
    const movement=Number(row.dataset.rankMovement||0);
    const y=movement>0?(mobile?3:6):movement<0?(mobile?-3:-6):(mobile?5:8);
    gsap.set(row,{autoAlpha:0,y});
  });
  goatRankingTimeline=gsap.timeline({
    onComplete:()=>{
      clearMotionProps(rows);
      goatRankingTimeline=null;
    }
  }).to(rows,{autoAlpha:1,y:0,duration:mobile?.3:.38,ease:MOAP_MOTION.ease.enter,stagger:mobile?.035:MOAP_MOTION.stagger.fast});
}

export function animateHonorCards(root){
  const gsap=motionEngine();
  const cards=directChildren(root,".honor-board-card");
  honorCardTimeline?.kill();
  clearMotionProps(cards);
  if(!cards.length||motionDisabled())return;

  const mobile=mobileMotion();
  honorCardTimeline=gsap.timeline({
    onComplete:()=>{
      clearMotionProps(cards);
      queueHonorShine(cards);
      honorCardTimeline=null;
    }
  }).fromTo(
    cards,
    {autoAlpha:0,y:mobile?5:8,scale:mobile?1:.98},
    {autoAlpha:1,y:0,scale:1,duration:mobile?.32:MOAP_MOTION.duration.slow,ease:MOAP_MOTION.ease.enter,stagger:mobile?.04:MOAP_MOTION.stagger.fast}
  );
}
export function animateHonorCenterEntry(root){
  const gsap=motionEngine();
  honorEntryTimeline?.kill();
  honorFilterTimeline?.kill();
  const hero=root?.querySelector?.(".hero");
  const topCards=directChildren(root,":scope > .grid-2 > .card");
  const boardSection=root?.querySelector?.("#honorSeasonBoard")?.closest?.(".card");
  const regions=[hero,...topCards,boardSection].filter(Boolean);
  clearMotionProps(regions);

  if(!root||motionDisabled()){
    animateGoatRanking(root?.querySelector?.("#goatRanking"));
    animateHonorCards(root?.querySelector?.("#honorSeasonBoard"));
    return;
  }

  const mobile=mobileMotion();
  honorEntryTimeline=gsap.timeline({
    defaults:{ease:MOAP_MOTION.ease.enter},
    onComplete:()=>{
      clearMotionProps(regions);
      honorEntryTimeline=null;
      animateGoatRanking(root.querySelector("#goatRanking"));
      animateHonorCards(root.querySelector("#honorSeasonBoard"));
    }
  }).fromTo(
    regions,
    {autoAlpha:0,y:mobile?7:MOAP_MOTION.distance.enter},
    {autoAlpha:1,y:0,duration:mobile?.32:.4,stagger:mobile?.04:MOAP_MOTION.stagger.normal}
  );
}

export function transitionHonorContent({targets,update,onUpdated,onComplete}){
  const gsap=motionEngine();
  const elements=toElements(targets);
  honorFilterTimeline?.kill();
  clearMotionProps(elements);
  if(motionDisabled()||!elements.length){
    update();
    onUpdated?.();
    onComplete?.();
    return;
  }

  honorFilterTimeline=gsap.timeline({
    onComplete:()=>{
      clearMotionProps(elements);
      honorFilterTimeline=null;
      onComplete?.();
    }
  })
    .to(elements,{autoAlpha:0,y:3,duration:.12,ease:MOAP_MOTION.ease.exit,stagger:.01})
    .call(()=>{
      update();
      onUpdated?.();
    })
    .fromTo(
      elements,
      {autoAlpha:0,y:mobileMotion()?3:6},
      {autoAlpha:1,y:0,duration:.22,ease:MOAP_MOTION.ease.enter,stagger:.02}
    );
}

export function animateHonorDetails(backdrop,{open,onComplete}={}){
  const gsap=motionEngine();
  const panel=backdrop?.querySelector?.(".honor-modal");
  honorDetailTimeline?.kill();
  if(!backdrop||!panel||motionDisabled()){
    if(!open)onComplete?.();
    return;
  }

  const headerParts=directChildren(panel,".honor-modal-header > div > *");
  const sections=directChildren(panel,".honor-modal-section, .honor-modal-footer");
  const animated=[...headerParts,...sections];

  if(open){
    clearExtendedMotionProps(animated);
    gsap.set(backdrop,{autoAlpha:0});
    gsap.set(panel,{height:0,autoAlpha:0,y:mobileMotion()?5:9,overflow:"hidden"});
    gsap.set(animated,{autoAlpha:0,y:mobileMotion()?3:7});
    honorDetailTimeline=gsap.timeline({
      onComplete:()=>{
        gsap.set(backdrop,{clearProps:"opacity,visibility"});
        gsap.set(panel,{clearProps:"height,opacity,visibility,transform,overflow"});
        clearExtendedMotionProps(animated);
        honorDetailTimeline=null;
        onComplete?.();
      }
    })
      .to(backdrop,{autoAlpha:1,duration:.13,ease:"power1.out"})
      .to(panel,{height:"auto",autoAlpha:1,y:0,duration:mobileMotion()?.28:.36,ease:MOAP_MOTION.ease.enter},"-=.05");
    if(headerParts.length)honorDetailTimeline.to(headerParts,{autoAlpha:1,y:0,duration:.24,stagger:.035,ease:MOAP_MOTION.ease.enter},"-=.23");
    if(sections.length)honorDetailTimeline.to(sections,{autoAlpha:1,y:0,duration:.28,stagger:mobileMotion()?.025:.04,ease:MOAP_MOTION.ease.enter},"-=.2");
    return;
  }

  gsap.set(panel,{overflow:"hidden"});
  honorDetailTimeline=gsap.timeline({
    onComplete:()=>{
      gsap.set(backdrop,{clearProps:"opacity,visibility"});
      gsap.set(panel,{clearProps:"height,opacity,visibility,transform,overflow"});
      clearExtendedMotionProps(animated);
      honorDetailTimeline=null;
      onComplete?.();
    }
  });
  if(sections.length)honorDetailTimeline.to(sections,{autoAlpha:0,y:4,duration:.1,stagger:.008,ease:MOAP_MOTION.ease.exit});
  honorDetailTimeline
    .to(panel,{height:0,autoAlpha:0,y:mobileMotion()?4:7,duration:.22,ease:MOAP_MOTION.ease.exit},"-=.04")
    .to(backdrop,{autoAlpha:0,duration:.12,ease:MOAP_MOTION.ease.exit},"-=.08");
}
export function animateRecordDetails(backdrop,{open,onComplete}={}){
  const gsap=motionEngine();
  const panel=backdrop?.querySelector(".record-modal");
  detailTimeline?.kill();

  if(!backdrop||!panel||motionDisabled()){
    if(!open)onComplete?.();
    return;
  }

  if(open){
    gsap.set(backdrop,{autoAlpha:0});
    gsap.set(panel,{height:0,autoAlpha:0,y:10,overflow:"hidden"});
    detailTimeline=gsap.timeline({
      onComplete:()=>{
        gsap.set(backdrop,{clearProps:"opacity,visibility"});
        gsap.set(panel,{clearProps:"height,opacity,visibility,transform,overflow"});
        detailTimeline=null;
        onComplete?.();
      }
    })
      .to(backdrop,{autoAlpha:1,duration:.14,ease:"power1.out"})
      .to(panel,{height:"auto",autoAlpha:1,y:0,duration:.34,ease:"power2.out"},"-=.06");
    return;
  }

  gsap.set(panel,{overflow:"hidden"});
  detailTimeline=gsap.timeline({
    onComplete:()=>{
      gsap.set(backdrop,{clearProps:"opacity,visibility"});
      gsap.set(panel,{clearProps:"height,opacity,visibility,transform,overflow"});
      detailTimeline=null;
      onComplete?.();
    }
  })
    .to(panel,{height:0,autoAlpha:0,y:8,duration:.24,ease:"power1.in"})
    .to(backdrop,{autoAlpha:0,duration:.14,ease:"power1.in"},"-=.1");
}
