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

export function animateNumbers(root=document,{duration}={}){
  if(!root?.querySelectorAll)return;
  const gsap=motionEngine();
  const mobile=window.matchMedia?.("(max-width: 760px)")?.matches;
  const tweenDuration=duration??(mobile?.65:.78);
  const candidates=[...root.querySelectorAll(NUMBER_SELECTOR)].filter(element=>element.children.length===0);

  candidates.forEach((element,index)=>{
    const original=element.textContent;
    const format=parseNumericText(original);
    if(!format)return;
    const key=numberKey(element,index,root);
    const previous=numberHistory.has(key)?numberHistory.get(key):0;
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

export function animatePlayerTrend(root){
  const chart=root?.querySelector?.("#trendChart")||root;
  const line=chart?.querySelector?.(".trend-line");
  const area=chart?.querySelector?.(".trend-area");
  const dots=chart?.querySelectorAll ? [...chart.querySelectorAll(".trend-dot")] : [];
  const animated=[line,area,...dots].filter(Boolean);
  playerTrendTimeline?.kill();
  if(!line||motionDisabled()){
    clearExtendedMotionProps(animated,"strokeDasharray,strokeDashoffset,transformOrigin");
    return;
  }

  let length=0;
  try{length=line.getTotalLength();}catch{return;}
  const gsap=motionEngine();
  const mobile=mobileMotion();
  clearExtendedMotionProps(animated,"strokeDasharray,strokeDashoffset,transformOrigin");
  gsap.set(line,{strokeDasharray:length,strokeDashoffset:length});
  if(area)gsap.set(area,{autoAlpha:0});
  if(dots.length)gsap.set(dots,{autoAlpha:0,scale:.9,transformOrigin:"center"});

  playerTrendTimeline=gsap.timeline({
    onComplete:()=>{
      clearExtendedMotionProps(animated,"strokeDasharray,strokeDashoffset,transformOrigin");
      playerTrendTimeline=null;
    }
  })
    .to(line,{strokeDashoffset:0,duration:mobile?.5:.72,ease:MOAP_MOTION.ease.enter});
  if(area)playerTrendTimeline.to(area,{autoAlpha:1,duration:.28},"-=.4");
  if(dots.length)playerTrendTimeline.to(dots,{autoAlpha:1,scale:1,duration:.24,stagger:mobile?.025:.04},"-=.3");
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
  const layers=playerLayers(root);
  if(!root||motionDisabled()||!layers.length){
    animatePlayerTrend(root);
    return;
  }
  const mobile=mobileMotion();
  clearMotionProps(layers);
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
  animatePlayerTrend(root);
}

export function transitionPlayerProfile({root,update,onUpdated}){
  const gsap=motionEngine();
  playerEntryTimeline?.kill();
  playerSwitchTimeline?.kill();
  playerTrendTimeline?.kill();
  const before=playerLayers(root);
  clearMotionProps(before);

  if(motionDisabled()||!before.length){
    update();
    onUpdated?.();
    animatePlayerTrend(root);
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
      animatePlayerTrend(root);
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
  const eligible=cards.filter(card=>card.dataset.honorGrade==="A").filter(card=>{
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
  });
  cards.forEach((card,index)=>{
    const grade=card.dataset.honorGrade||card.querySelector(".grade")?.textContent?.trim()||"C";
    const from=grade==="A"
      ?{autoAlpha:0,y:mobile?5:8,scale:mobile?1:.97}
      :grade==="B"
        ?{autoAlpha:0,y:mobile?5:10}
        :{autoAlpha:0,y:mobile?2:4};
    const duration=grade==="A"?(mobile?.32:MOAP_MOTION.duration.slow):grade==="B"?(mobile?.28:.38):(mobile?.24:.3);
    honorCardTimeline.fromTo(card,from,{autoAlpha:1,y:0,scale:1,duration,ease:MOAP_MOTION.ease.enter},index*(mobile?.03:MOAP_MOTION.stagger.fast));
  });
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

export function animateHonorDetails(backdrop,{open,grade="",onComplete}={}){
  const gsap=motionEngine();
  const panel=backdrop?.querySelector?.(".honor-modal");
  honorDetailTimeline?.kill();
  if(!backdrop||!panel||motionDisabled()){
    if(!open)onComplete?.();
    return;
  }

  const gradeMark=panel.querySelector(".honor-modal-grade");
  const headerParts=directChildren(panel,".honor-modal-header > div > *");
  const sections=directChildren(panel,".honor-modal-section, .honor-season-detail, .honor-modal-footer");
  const animated=[gradeMark,...headerParts,...sections].filter(Boolean);

  if(open){
    clearExtendedMotionProps(animated);
    gsap.set(backdrop,{autoAlpha:0});
    gsap.set(panel,{height:0,autoAlpha:0,y:mobileMotion()?5:9,overflow:"hidden"});
    if(gradeMark)gsap.set(gradeMark,{autoAlpha:0,scale:grade==="A"&&!mobileMotion()?.97:1,y:4});
    gsap.set([...headerParts,...sections],{autoAlpha:0,y:mobileMotion()?3:7});
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
    if(gradeMark)honorDetailTimeline.to(gradeMark,{autoAlpha:1,scale:1,y:0,duration:.24,ease:MOAP_MOTION.ease.enter},"-=.27");
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
