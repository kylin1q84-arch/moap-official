import { gsap } from "./motion-runtime.js";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SCENE_ENTRY_ALPHA = .94;
const BUTTON_SELECTOR = "button:not(:disabled), .btn:not(:disabled), [role='button']:not([aria-disabled='true'])";
const NUMBER_SELECTOR = [
  "[data-animate-number]",
  ".kpi-value",
  ".mini-stat strong",
  ".season-core-stats b",
  ".season-rating-hero strong",
  ".season-compare b",
  ".season-dimension b",
  ".command-goat-index strong",
  ".profile-career-ovr b",
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
  ".goat-score-v2 > b"
].join(",");

export const MOAP_MOTION = Object.freeze({
  duration:Object.freeze({instant:.11,fast:.16,normal:.31,slow:.47,hero:.64,data:.78}),
  distance:Object.freeze({micro:3,small:6,enter:10,hero:14,card:3}),
  stagger:Object.freeze({micro:.03,fast:.045,normal:.06}),
  ease:Object.freeze({enter:"power2.out",exit:"power1.in",data:"power2.out",emphasis:"power3.out"})
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
let goatRankingTimeline = null;
let shellTimeline = null;
let overviewTimeline = null;
let statusTimeline = null;
let matchTimeline = null;
let matchContentTimeline = null;
let rivalTimeline = null;
let rivalDetailTimeline = null;
let systemTimeline = null;
let entryTimeline = null;
let validationTimeline = null;
let monthlyTimeline = null;
let revealObserver = null;
let rivalMatrixInteractionCleanup = null;
const revealedSections = new WeakSet();
const enteredStatusViews = new WeakSet();
const enteredMatchesViews = new WeakSet();
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

function killTimeline(ref){
  ref?.kill?.();
}

function timelineTargets(timeline){
  if(!timeline?.getChildren)return [];
  const targets=timeline.getChildren(true,true,true).flatMap(child=>child?.targets?.()||[]);
  return [...new Set(targets)].filter(target=>target instanceof Element);
}

function killEntryMotion(){
  const timelines=[recordTimeline,overviewTimeline,statusTimeline,matchTimeline,rivalTimeline,systemTimeline,entryTimeline,playerEntryTimeline];
  const interrupted=timelines.flatMap(timelineTargets);
  timelines.forEach(killTimeline);
  recordTimeline=overviewTimeline=statusTimeline=matchTimeline=rivalTimeline=systemTimeline=entryTimeline=playerEntryTimeline=null;
  clearMotionProps(interrupted);
}

function finishNumberTweens(root){
  if(!root)return;
  numberTweens.forEach((entry,key)=>{
    if(!entry?.element||!root.contains(entry.element))return;
    entry.tween?.kill?.();
    if(entry.element.isConnected)entry.element.textContent=entry.finalText;
    numberTweens.delete(key);
  });
}

function animateShellEntry(){
  const gsap=motionEngine();
  const topbar=document.querySelector(".topbar");
  const sidebar=document.querySelector(".sidebar");
  const mobileNav=document.querySelector(".mobile-nav");
  const main=document.querySelector("main");
  const targets=[topbar,sidebar,mobileNav,main].filter(Boolean);
  if(!targets.length||motionDisabled())return;
  shellTimeline?.kill();
  clearMotionProps(targets);
  shellTimeline=gsap.timeline({
    defaults:{ease:MOAP_MOTION.ease.enter},
    onComplete:()=>{clearMotionProps(targets);shellTimeline=null;}
  });
  if(topbar)shellTimeline.fromTo(topbar,{autoAlpha:0,y:-4},{autoAlpha:1,y:0,duration:.34},0);
  if(sidebar)shellTimeline.fromTo(sidebar,{autoAlpha:0,x:-6},{autoAlpha:1,x:0,duration:.38},.08);
  if(mobileNav)shellTimeline.fromTo(mobileNav,{autoAlpha:0,y:-3},{autoAlpha:1,y:0,duration:.3},.08);
  if(main)shellTimeline.fromTo(main,{autoAlpha:0,y:6},{autoAlpha:1,y:0,duration:.4},.16);
}

export function initAnimationSystem(){
  if(initialized)return;
  initialized=true;
  const gsap=motionEngine();
  if(gsap){
    gsap.config({nullTargetWarn:false});
    gsap.defaults({ease:"power2.out"});
  }
  document.documentElement.classList.toggle("motion-paused",document.hidden);
  document.addEventListener("pointerdown",event=>{
    if(motionDisabled())return;
    const target=event.target.closest?.(BUTTON_SELECTOR);
    if(!target||!target.isConnected||target.matches(".nav-btn"))return;
    const engine=motionEngine();
    engine.killTweensOf(target);
    engine.timeline()
      .to(target,{scale:.97,duration:.07,ease:"power1.out",overwrite:true})
      .to(target,{scale:1,duration:.12,ease:"power2.out",clearProps:"transform"});
  },{passive:true});
  document.addEventListener("visibilitychange",()=>{
    document.documentElement.classList.toggle("motion-paused",document.hidden);
  });
  requestAnimationFrame(()=>requestAnimationFrame(animateShellEntry));
}

export function animateNavIndicator(navRoot,activeButton,{immediate=false}={}){
  const indicator=navRoot?.querySelector?.(".nav-active-indicator");
  if(!indicator||!activeButton)return;
  const y=activeButton.offsetTop;
  const height=activeButton.offsetHeight;
  const gsap=motionEngine();
  if(immediate||motionDisabled()||!gsap){
    indicator.style.setProperty("transform",`translate3d(0,${y}px,0)`,motionDisabled()?"important":"");
    indicator.style.height=`${height}px`;
    indicator.style.opacity="1";
    return;
  }
  gsap.killTweensOf(indicator);
  if(indicator.style.getPropertyPriority("transform")==="important"){
    indicator.style.setProperty("transform",indicator.style.getPropertyValue("transform"));
  }
  gsap.set(indicator,{height,autoAlpha:1});
  gsap.to(indicator,{y,duration:.22,ease:"power3.out",overwrite:true});
}

export function transitionView({outgoing,incoming,swap,immediate=false,onEntered}){
  viewTimeline?.kill();
  viewTimeline=null;
  finishNumberTweens(outgoing);
  killEntryMotion();
  swap();
  onEntered?.();
}

function sceneHeaderParts(root){
  return [
    root?.querySelector?.(".hero h2, .status-live-masthead h2, .match-ledger-masthead h2"),
    root?.querySelector?.(".hero p, .status-live-masthead p, .match-ledger-masthead p"),
    root?.querySelector?.(".hero > .chip, .hero > label, .hero > div + *, .status-current-leader, .match-ledger-total")
  ].filter(Boolean);
}

function addHeaderSequence(timeline,root,position=0){
  const parts=sceneHeaderParts(root);
  if(parts.length)timeline.fromTo(parts,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobileMotion()?5:8},{autoAlpha:1,y:0,duration:mobileMotion()?.27:.32,stagger:mobileMotion()?.035:MOAP_MOTION.stagger.fast},position);
}

function prepareSectionReveals(root,view){
  revealObserver?.disconnect();
  revealObserver=null;
  if(!root?.querySelectorAll)return;
  const selectorByView={
    overview:".overview-editorial-recap,.monthly-report-card",
    status:".status-observation-stage,.status-method-stage",
    player:".player-season-data-card",
    rival:".rival-context-card",
    entry:".entry-matrix-stage"
  };
  const selector=selectorByView[view];
  if(!selector)return;
  const candidates=[...root.querySelectorAll(selector)].filter(element=>!revealedSections.has(element));
  if(motionDisabled()){
    clearMotionProps(candidates);
    candidates.forEach(element=>revealedSections.add(element));
    return;
  }
  const belowFold=candidates.filter(element=>element.getBoundingClientRect().top>window.innerHeight*.82);
  if(!belowFold.length)return;
  const gsap=motionEngine();
  gsap.set(belowFold,{autoAlpha:0,y:mobileMotion()?5:9});
  revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      const element=entry.target;
      revealObserver?.unobserve(element);
      revealedSections.add(element);
      gsap.to(element,{autoAlpha:1,y:0,duration:mobileMotion()?.28:.4,ease:MOAP_MOTION.ease.enter,clearProps:"opacity,visibility,transform",overwrite:true});
    });
  },{rootMargin:"0px 0px -8% 0px",threshold:.12});
  belowFold.forEach(element=>revealObserver.observe(element));
}

function animateOverviewEntry(root){
  const gsap=motionEngine();
  overviewTimeline?.kill();
  const goatCard=root.querySelector(".command-goat-spotlight");
  const latestCard=root.querySelector(".command-latest-match");
  const goatParts=[...root.querySelectorAll("#overviewGoatHero > *")];
  const latestParts=[...root.querySelectorAll("#latestMatchCommand > *")];
  const metrics=[...root.querySelectorAll("#overviewKpis > .overview-metric")];
  const rankingCard=root.querySelector(".overview-goat-ranking");
  const rankingRows=[...root.querySelectorAll("#goatRanking > .goat-row")];
  const animated=[...sceneHeaderParts(root),goatCard,latestCard,...goatParts,...latestParts,...metrics,rankingCard,...rankingRows].filter(Boolean);
  goatCard?.classList.toggle("motion-atmosphere",!motionDisabled());
  rankingRows[0]?.classList.toggle("motion-leader",!motionDisabled());
  if(motionDisabled()){
    clearMotionProps(animated);
    return;
  }
  clearMotionProps(animated);
  const mobile=mobileMotion();
  overviewTimeline=gsap.timeline({onComplete:()=>{clearMotionProps(animated);overviewTimeline=null;}});
  addHeaderSequence(overviewTimeline,root,0);
  overviewTimeline.fromTo(goatCard,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?7:12},{autoAlpha:1,y:0,duration:mobile?.36:.5,ease:MOAP_MOTION.ease.emphasis},.11);
  if(goatParts.length)overviewTimeline.fromTo(goatParts,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?4:7},{autoAlpha:1,y:0,duration:mobile?.3:.38,stagger:mobile?.03:.045,ease:MOAP_MOTION.ease.enter},.22);
  overviewTimeline.fromTo(latestCard,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?6:9},{autoAlpha:1,y:0,duration:mobile?.32:.42,ease:MOAP_MOTION.ease.enter},.25);
  if(latestParts.length)overviewTimeline.fromTo(latestParts,{autoAlpha:SCENE_ENTRY_ALPHA,y:4},{autoAlpha:1,y:0,duration:.28,stagger:.035,ease:MOAP_MOTION.ease.enter},.33);
  if(metrics.length)overviewTimeline.fromTo(metrics,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?4:6},{autoAlpha:1,y:0,duration:mobile?.27:.34,stagger:mobile?.03:.045,ease:MOAP_MOTION.ease.enter},.39);
  if(rankingCard)overviewTimeline.fromTo(rankingCard,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?5:8},{autoAlpha:1,y:0,duration:mobile?.3:.38,ease:MOAP_MOTION.ease.enter},.48);
  if(rankingRows.length)overviewTimeline.fromTo(rankingRows,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?3:6},{autoAlpha:1,y:0,duration:mobile?.26:.34,stagger:mobile?.03:.04,ease:MOAP_MOTION.ease.enter},.53);
}

function animateStatusEntry(root){
  const gsap=motionEngine();
  statusTimeline?.kill();
  const signalHead=root.querySelector(".status-signal-stage .status-stage-head");
  const signals=[...root.querySelectorAll("#statusKpis > .status-signal-cell")];
  const rankingHead=root.querySelector(".status-ranking-stage .status-stage-head");
  const rows=[...root.querySelectorAll("#powerRanking > .status-ranking-row")].slice(0,6);
  const animated=[...sceneHeaderParts(root),signalHead,...signals,rankingHead,...rows].filter(Boolean);
  const firstEntry=!enteredStatusViews.has(root);
  enteredStatusViews.add(root);
  if(motionDisabled()||!firstEntry){
    clearMotionProps(animated);
    return;
  }
  clearMotionProps(animated);
  const mobile=mobileMotion();
  statusTimeline=gsap.timeline({onComplete:()=>{clearMotionProps(animated);statusTimeline=null;}});
  addHeaderSequence(statusTimeline,root,0);
  if(signalHead)statusTimeline.fromTo(signalHead,{autoAlpha:SCENE_ENTRY_ALPHA,y:4},{autoAlpha:1,y:0,duration:.26,ease:MOAP_MOTION.ease.enter},.12);
  if(signals.length)statusTimeline.fromTo(signals,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?4:6},{autoAlpha:1,y:0,duration:mobile?.27:.32,stagger:mobile?.03:.045,ease:MOAP_MOTION.ease.enter},.18);
  if(rankingHead)statusTimeline.fromTo(rankingHead,{autoAlpha:SCENE_ENTRY_ALPHA,y:4},{autoAlpha:1,y:0,duration:.27,ease:MOAP_MOTION.ease.enter},.3);
  if(rows.length)statusTimeline.fromTo(rows,{autoAlpha:.6,y:mobile?4:6},{autoAlpha:1,y:0,duration:mobile?.3:.36,stagger:mobile?.035:.05,ease:MOAP_MOTION.ease.enter},.36);
}

export function animateMatchRows(root,{startIndex=0,includeRail=true,delay=0}={}){
  if(!root?.querySelectorAll)return;
  const gsap=motionEngine();
  const rows=[...root.querySelectorAll(".season-log-entry")].slice(startIndex,startIndex+8);
  const nodes=rows.map(row=>row.querySelector(".match-timeline-node")).filter(Boolean);
  if(includeRail)root.classList.remove("motion-rail-reveal");
  if(motionDisabled()){
    clearExtendedMotionProps([...rows,...nodes]);
    return;
  }
  const mobile=mobileMotion();
  if(includeRail){void root.offsetWidth;root.classList.add("motion-rail-reveal");}
  gsap.fromTo(rows,{autoAlpha:.7,y:mobile?3:5},{autoAlpha:1,y:0,duration:mobile?.27:.33,stagger:mobile?.03:.045,delay,ease:MOAP_MOTION.ease.enter,clearProps:"opacity,visibility,transform"});
  if(nodes.length)gsap.fromTo(nodes,{autoAlpha:.68},{autoAlpha:1,duration:.22,stagger:.04,delay:delay+.06,ease:MOAP_MOTION.ease.enter,clearProps:"opacity,visibility"});
}

function animateMatchesEntry(root){
  const gsap=motionEngine();
  matchTimeline?.kill();
  const query=root.querySelector(".match-query-stage");
  const head=root.querySelector(".match-ledger-head");
  const list=root.querySelector("#matchList");
  const animated=[...sceneHeaderParts(root),query,head].filter(Boolean);
  const firstEntry=!enteredMatchesViews.has(root);
  enteredMatchesViews.add(root);
  if(motionDisabled()||!firstEntry){
    clearMotionProps(animated);
    return;
  }
  clearMotionProps(animated);
  matchTimeline=gsap.timeline({onComplete:()=>{clearMotionProps(animated);matchTimeline=null;}});
  addHeaderSequence(matchTimeline,root,0);
  if(query)matchTimeline.fromTo(query,{autoAlpha:SCENE_ENTRY_ALPHA,y:4},{autoAlpha:1,y:0,duration:mobileMotion()?.29:.34,ease:MOAP_MOTION.ease.enter},.14);
  if(head)matchTimeline.fromTo(head,{autoAlpha:SCENE_ENTRY_ALPHA,y:4},{autoAlpha:1,y:0,duration:.27,ease:MOAP_MOTION.ease.enter},.25);
  matchTimeline.call(()=>animateMatchRows(list,{delay:0}),null,.31);
}

export function transitionMatchContent({target,update,onUpdated,append=false,startIndex=0}){
  const gsap=motionEngine();
  matchContentTimeline?.kill();
  if(!target||motionDisabled()){
    update();onUpdated?.();
    return;
  }
  if(append){
    update();
    animateMatchRows(target,{startIndex,includeRail:false});
    onUpdated?.();
    return;
  }
  gsap.killTweensOf(target);
  matchContentTimeline=gsap.timeline({onComplete:()=>{clearMotionProps([target]);matchContentTimeline=null;}})
    .to(target,{autoAlpha:.66,y:2,duration:.1,ease:MOAP_MOTION.ease.exit})
    .call(()=>{update();onUpdated?.();})
    .set(target,{autoAlpha:.66,y:mobileMotion()?2:3})
    .to(target,{autoAlpha:1,y:0,duration:.18,ease:MOAP_MOTION.ease.enter});
}

function bindRivalMatrixFocus(root){
  rivalMatrixInteractionCleanup?.();
  rivalMatrixInteractionCleanup=null;
  const table=root?.querySelector?.("#netMatrix");
  const finePointer=window.matchMedia?.("(hover:hover) and (pointer:fine)")?.matches;
  if(!table||!finePointer||motionDisabled())return;
  const clear=()=>{
    table.classList.remove("is-focus-mode");
    table.querySelectorAll(".is-focus-cell,.is-focus-row,.is-focus-col").forEach(element=>element.classList.remove("is-focus-cell","is-focus-row","is-focus-col"));
  };
  const focus=cell=>{
    if(!cell?.matches?.("button.matrix-cell[data-rival-a][data-rival-b]")){clear();return;}
    clear();
    const td=cell.closest("td"),row=cell.closest("tr"),columnIndex=td?[...row.children].indexOf(td):-1;
    table.classList.add("is-focus-mode");
    cell.classList.add("is-focus-cell");
    row?.classList.add("is-focus-row");
    if(columnIndex>=0)table.querySelectorAll(`tr > *:nth-child(${columnIndex+1})`).forEach(element=>element.classList.add("is-focus-col"));
  };
  const move=event=>focus(event.target.closest?.("button.matrix-cell"));
  const leave=()=>clear();
  const focusIn=event=>focus(event.target.closest?.("button.matrix-cell"));
  const focusOut=event=>{if(!table.contains(event.relatedTarget))clear();};
  table.addEventListener("pointermove",move,{passive:true});
  table.addEventListener("pointerleave",leave,{passive:true});
  table.addEventListener("focusin",focusIn);
  table.addEventListener("focusout",focusOut);
  rivalMatrixInteractionCleanup=()=>{
    table.removeEventListener("pointermove",move);
    table.removeEventListener("pointerleave",leave);
    table.removeEventListener("focusin",focusIn);
    table.removeEventListener("focusout",focusOut);
    clear();
  };
}

function animateRivalEntry(root){
  const gsap=motionEngine();
  rivalTimeline?.kill();
  const kpis=[...root.querySelectorAll("#rivalKpis > .kpi")];
  const matrixCard=root.querySelector(".rival-matrix-card");
  const matrixRows=[...root.querySelectorAll("#netMatrix tbody tr")];
  const animated=[...sceneHeaderParts(root),...kpis,matrixCard,...matrixRows].filter(Boolean);
  bindRivalMatrixFocus(root);
  if(motionDisabled()){
    clearMotionProps(animated);
    return;
  }
  clearMotionProps(animated);
  rivalTimeline=gsap.timeline({onComplete:()=>{clearMotionProps(animated);rivalTimeline=null;}});
  addHeaderSequence(rivalTimeline,root,0);
  if(kpis.length)rivalTimeline.fromTo(kpis,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobileMotion()?4:6},{autoAlpha:1,y:0,duration:.32,stagger:mobileMotion()?.025:.04,ease:MOAP_MOTION.ease.enter},.13);
  if(matrixCard)rivalTimeline.fromTo(matrixCard,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobileMotion()?5:8},{autoAlpha:1,y:0,duration:mobileMotion()?.32:.42,ease:MOAP_MOTION.ease.enter},.28);
  if(matrixRows.length)rivalTimeline.fromTo(matrixRows,{autoAlpha:SCENE_ENTRY_ALPHA,x:mobileMotion()?-2:-4},{autoAlpha:1,x:0,duration:mobileMotion()?.24:.3,stagger:mobileMotion()?.025:.035,ease:MOAP_MOTION.ease.enter},.38);
}

export function transitionRivalContent({root,update,onUpdated}){
  const target=root?.querySelector?.(".rival-matrix-layout")||root;
  const gsap=motionEngine();
  rivalTimeline?.kill();
  if(!target||motionDisabled()){
    update();bindRivalMatrixFocus(root);onUpdated?.();return;
  }
  rivalTimeline=gsap.timeline({onComplete:()=>{clearMotionProps([target]);rivalTimeline=null;}})
    .to(target,{autoAlpha:0,y:3,duration:.12,ease:MOAP_MOTION.ease.exit})
    .call(()=>{update();bindRivalMatrixFocus(root);onUpdated?.();})
    .fromTo(target,{autoAlpha:0,y:5},{autoAlpha:1,y:0,duration:.22,ease:MOAP_MOTION.ease.enter});
}

export function transitionRivalDetail({target,update,onUpdated}){
  const gsap=motionEngine();
  rivalDetailTimeline?.kill();
  if(!target||motionDisabled()){
    update();onUpdated?.();return;
  }
  rivalDetailTimeline=gsap.timeline({onComplete:()=>{clearMotionProps([target]);rivalDetailTimeline=null;}})
    .to(target,{autoAlpha:0,y:2,duration:.1,ease:MOAP_MOTION.ease.exit})
    .call(()=>{update();onUpdated?.();})
    .fromTo(target,{autoAlpha:0,y:4},{autoAlpha:1,y:0,duration:.2,ease:MOAP_MOTION.ease.enter});
}

function animateSystemEntry(root){
  const gsap=motionEngine();
  systemTimeline?.kill();
  const kpis=[...root.querySelectorAll("#systemKpis > .kpi")];
  const audit=root.querySelector(".system-audit-grid");
  const health=[...root.querySelectorAll("#healthList > .health-item")];
  const animated=[...sceneHeaderParts(root),...kpis,audit,...health].filter(Boolean);
  if(motionDisabled()){
    clearMotionProps(animated);return;
  }
  clearMotionProps(animated);
  systemTimeline=gsap.timeline({onComplete:()=>{clearMotionProps(animated);systemTimeline=null;}});
  addHeaderSequence(systemTimeline,root,0);
  if(kpis.length)systemTimeline.fromTo(kpis,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobileMotion()?4:6},{autoAlpha:1,y:0,duration:.3,stagger:mobileMotion()?.025:.04,ease:MOAP_MOTION.ease.enter},.14);
  if(audit)systemTimeline.fromTo(audit,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobileMotion()?5:8},{autoAlpha:1,y:0,duration:mobileMotion()?.32:.4,ease:MOAP_MOTION.ease.enter},.3);
  if(health.length)systemTimeline.fromTo(health,{autoAlpha:SCENE_ENTRY_ALPHA},{autoAlpha:1,duration:.26,stagger:.03,ease:MOAP_MOTION.ease.enter},.38);
}

function animateEntryCenter(root){
  const gsap=motionEngine();
  entryTimeline?.kill();
  const workflow=root.querySelector(".entry-workflow-card");
  const steps=[...root.querySelectorAll(".entry-workflow-step")];
  const validation=root.querySelector("#entryValidation");
  const actions=root.querySelector(".entry-actions");
  const guide=root.querySelector(".grid-2 > .card:not(.entry-workflow-card)");
  const animated=[...sceneHeaderParts(root),workflow,...steps,validation,actions,guide].filter(Boolean);
  if(motionDisabled()){
    clearMotionProps(animated);return;
  }
  clearMotionProps(animated);
  entryTimeline=gsap.timeline({onComplete:()=>{clearMotionProps(animated);entryTimeline=null;}});
  addHeaderSequence(entryTimeline,root,0);
  if(workflow)entryTimeline.fromTo(workflow,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobileMotion()?5:8},{autoAlpha:1,y:0,duration:.38,ease:MOAP_MOTION.ease.enter},.13);
  if(steps.length)entryTimeline.fromTo(steps,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobileMotion()?3:5},{autoAlpha:1,y:0,duration:.3,stagger:mobileMotion()?.04:.06,ease:MOAP_MOTION.ease.enter},.23);
  if(validation)entryTimeline.fromTo(validation,{autoAlpha:SCENE_ENTRY_ALPHA,y:3},{autoAlpha:1,y:0,duration:.24,ease:MOAP_MOTION.ease.enter},.38);
  if(actions)entryTimeline.fromTo(actions,{autoAlpha:SCENE_ENTRY_ALPHA,y:3},{autoAlpha:1,y:0,duration:.24,ease:MOAP_MOTION.ease.enter},.42);
  if(guide)entryTimeline.fromTo(guide,{autoAlpha:SCENE_ENTRY_ALPHA,y:5},{autoAlpha:1,y:0,duration:.34,ease:MOAP_MOTION.ease.enter},.26);
}

export function animateEntryValidation({summary,detail,readyButton,signature,ready=false}){
  if(!summary||summary.closest(".view")?.classList.contains("active")===false)return;
  const stateKey=String(signature??"");
  if(summary.dataset.motionValidationState===stateKey)return;
  const wasReady=summary.dataset.motionReady==="true";
  summary.dataset.motionValidationState=stateKey;
  summary.dataset.motionReady=String(ready);
  if(motionDisabled())return;
  validationTimeline?.kill();
  const targets=[summary,detail].filter(Boolean);
  const gsap=motionEngine();
  validationTimeline=gsap.fromTo(targets,{autoAlpha:.78,y:2},{autoAlpha:1,y:0,duration:.21,stagger:.025,ease:MOAP_MOTION.ease.enter,clearProps:"opacity,visibility,transform",onComplete:()=>{validationTimeline=null;}});
  if(ready&&!wasReady&&readyButton){
    readyButton.classList.remove("motion-ready-once");
    void readyButton.offsetWidth;
    readyButton.classList.add("motion-ready-once");
  }
}

export function transitionReportContent({target,update,onUpdated}){
  const gsap=motionEngine();
  monthlyTimeline?.kill();
  if(!target||motionDisabled()){
    update();onUpdated?.();return;
  }
  monthlyTimeline=gsap.timeline({onComplete:()=>{clearMotionProps([target]);monthlyTimeline=null;}})
    .to(target,{autoAlpha:0,y:3,duration:.12,ease:MOAP_MOTION.ease.exit})
    .call(()=>{update();onUpdated?.();})
    .fromTo(target,{autoAlpha:0,y:5},{autoAlpha:1,y:0,duration:.24,ease:MOAP_MOTION.ease.enter});
}

export function animateViewExperience(root,view){
  if(!root)return;
  animateNumbers(root);
  prepareSectionReveals(root,view);
  if(view==="overview")animateOverviewEntry(root);
  else if(view==="records")animateRecordCenterEntry(root);
  else if(view==="status")animateStatusEntry(root);
  else if(view==="player")animatePlayerCenterEntry(root);
  else if(view==="matches")animateMatchesEntry(root);
  else if(view==="rival")animateRivalEntry(root);
  else if(view==="system")animateSystemEntry(root);
  else if(view==="entry")animateEntryCenter(root);
}

function applyAmbientViewState(root,view){
  const enabled=!motionDisabled();
  if(view==="overview"){
    root.querySelector(".command-goat-spotlight")?.classList.toggle("motion-atmosphere",enabled);
    root.querySelector("#goatRanking > .goat-row")?.classList.toggle("motion-leader",enabled);
  }else if(view==="player"){
    const chart=root.querySelector("#trendChart");
    chart?.classList.toggle("trend-ambient-ready",Boolean(chart.querySelector(".trend-line")));
    bindPlayerTrendInteraction(root);
  }else if(view==="rival"){
    bindRivalMatrixFocus(root);
  }
}

export function prepareViewExperience(root,view){
  if(!root)return;
  prepareSectionReveals(root,view);
  applyAmbientViewState(root,view);
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
  if(title)recordTimeline.fromTo(title,{autoAlpha:SCENE_ENTRY_ALPHA,y:8},{autoAlpha:1,y:0,duration:.3});
  if(filters.length)recordTimeline.fromTo(filters,{autoAlpha:SCENE_ENTRY_ALPHA,y:10},{autoAlpha:1,y:0,duration:.32,stagger:.05},"-=.12");
  if(regions.length)recordTimeline.fromTo(regions,{autoAlpha:SCENE_ENTRY_ALPHA,y:12},{autoAlpha:1,y:0,duration:.34,stagger:.06},"-=.14");
  if(rows.length)recordTimeline.fromTo(rows,{autoAlpha:SCENE_ENTRY_ALPHA,y:14},{autoAlpha:1,y:0,duration:.42,stagger:.05},"-=.18");
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

    numberTweens.get(key)?.tween?.kill?.();
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
        if(numberTweens.get(key)?.tween===tween)numberTweens.delete(key);
      }
    });
    numberTweens.set(key,{tween,element,finalText:original});
  });
}

export function animateNumbers(root=document,{duration}={}){
  if(!root?.querySelectorAll)return;
  const candidates=[...root.querySelectorAll(NUMBER_SELECTOR)]
    .filter(element=>element.children.length===0&&!element.hasAttribute("data-player-number"));
  animateNumberCandidates(candidates,root,{duration});
}

export function animatePlayerSeasonNumbers(root=document,{baseDelay=0}={}){
  const scope=root?.closest?.(".player-season-data-card")||root;
  const table=scope?.matches?.("#playerSeasonTable")?scope:scope?.querySelector?.("#playerSeasonTable");
  const cards=scope?.matches?.("#playerSeasonCards")?scope:scope?.querySelector?.("#playerSeasonCards");
  if(!table&&!cards)return;
  const rows=table?[...table.querySelectorAll("tr")]:[];
  const summaryCards=cards?[...cards.querySelectorAll(".player-season-summary-card")]:[];
  const candidates=[...(table?.querySelectorAll("[data-player-number]")||[]),...(cards?.querySelectorAll("[data-player-number]")||[])];
  animateNumberCandidates(candidates,scope,{
    duration:mobileMotion()?.62:.78,
    delayFor:element=>{
      const row=element.closest("tr");
      const card=element.closest(".player-season-summary-card");
      const itemIndex=row?Math.max(0,rows.indexOf(row)):Math.max(0,summaryCards.indexOf(card));
      const isTotal=row?.classList.contains("season-total-row")||card?.classList.contains("is-total");
      return baseDelay+(isTotal ? .16 : itemIndex*.04);
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
    chart.classList.remove("is-inspecting");
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
    chart.classList.add("is-inspecting");
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
  chart?.classList?.remove("trend-ambient-ready");
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
    chart?.classList?.add("trend-ambient-ready");
    bindPlayerTrendInteraction(root);
    return;
  }

  const mobile=mobileMotion();
  const duration=mobile?.72:.86;
  gsap.set(line,{strokeDasharray:length,strokeDashoffset:length});
  if(reveal)gsap.set(reveal,{scaleX:0,transformOrigin:"left center"});

  playerTrendTimeline=gsap.timeline({
    delay,
    onComplete:()=>{
      clearExtendedMotionProps(animated,"strokeDasharray,strokeDashoffset,transformOrigin");
      chart?.classList?.add("trend-ambient-ready");
      playerTrendTimeline=null;
      bindPlayerTrendInteraction(root);
    }
  })
    .to(line,{strokeDashoffset:0,duration,ease:"power1.inOut"},0);
  if(reveal)playerTrendTimeline.to(reveal,{scaleX:1,duration:duration*.94,ease:"none"},.04);
}

function animateRecentMatches(root,{delay=0,glow=false}={}){
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
  gsap.set(rows,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?5:8});
  if(badges.length)gsap.set(badges,{autoAlpha:0,scale:.9,transformOrigin:"center"});

  playerRecentTimeline=gsap.timeline({
    delay,
    onComplete:()=>{
      clearMotionProps(rows);
      clearExtendedMotionProps(badges);
      if(glow&&latest?.isConnected){
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

function animatePlayerDataExperience(root,{delay=0,recentGlow=false}={}){
  animatePlayerSeasonNumbers(root,{baseDelay:delay+.08});
  animatePlayerTrend(root,{delay:delay+.16});
  animateRecentMatches(root,{delay:delay+.22,glow:recentGlow});
  const bars=[...root.querySelectorAll(".season-dimension .bar i")];
  const gsap=motionEngine();
  if(bars.length&&!motionDisabled()){
    gsap.killTweensOf(bars);
    gsap.fromTo(bars,{scaleX:0,transformOrigin:"left center"},{scaleX:1,duration:mobileMotion()?.44:.56,delay:delay+.12,stagger:mobileMotion()?.055:.075,ease:MOAP_MOTION.ease.data,clearProps:"transform,transformOrigin"});
  }
}

function stopPlayerDataExperience(root){
  playerTrendTimeline?.kill();
  playerTrendTimeline=null;
  playerRecentTimeline?.kill();
  playerRecentTimeline=null;
  clearPlayerTrendInteraction();
  const chart=root?.querySelector?.("#trendChart");
  chart?.classList?.remove("trend-ambient-ready");
  const trendParts=chart?[chart.querySelector(".trend-line"),chart.querySelector(".trend-area-reveal"),...chart.querySelectorAll(".trend-dot")].filter(Boolean):[];
  clearExtendedMotionProps(trendParts,"strokeDasharray,strokeDashoffset,transformOrigin");
  const recentRows=root?.querySelectorAll ? [...root.querySelectorAll("#recentMatchesPlayer [data-recent-match]")] : [];
  const recentBadges=root?.querySelectorAll ? [...root.querySelectorAll("#recentMatchesPlayer .recent-mvp-badge")] : [];
  clearMotionProps(recentRows);
  clearExtendedMotionProps(recentBadges);
  recentRows[0]?.classList.remove("recent-glow-once");
  const dimensionBars=root?.querySelectorAll ? [...root.querySelectorAll(".season-dimension .bar i")] : [];
  motionEngine()?.killTweensOf?.(dimensionBars);
  clearExtendedMotionProps(dimensionBars,"transformOrigin");
}

function playerLayers(root){
  return [
    root?.querySelector?.(".player-observatory-identity-column"),
    root?.querySelector?.(".current-season-performance-card"),
    root?.querySelector?.(".player-trend-stage"),
    root?.querySelector?.(".player-season-data-card")
  ].filter(Boolean);
}

export function animatePlayerCenterEntry(root){
  const gsap=motionEngine();
  playerEntryTimeline?.kill();
  playerSwitchTimeline?.kill();
  stopPlayerDataExperience(root);
  const layers=playerLayers(root);
  const headerParts=sceneHeaderParts(root);
  const identity=[...root?.querySelectorAll?.(".profile-name-block > *")||[]];
  const identityColumn=root?.querySelector?.(".player-observatory-identity-column");
  const progressive=layers.filter(layer=>layer!==identityColumn);
  const animated=[...headerParts,...identity,...progressive].filter(Boolean);
  if(!root||motionDisabled()||!animated.length){
    animatePlayerDataExperience(root);
    return;
  }
  const mobile=mobileMotion();
  clearMotionProps(animated);
  animatePlayerDataExperience(root,{delay:.14});
  playerEntryTimeline=gsap.timeline({
    defaults:{ease:MOAP_MOTION.ease.enter},
    onComplete:()=>{
      clearMotionProps(animated);
      playerEntryTimeline=null;
    }
  });
  addHeaderSequence(playerEntryTimeline,root,0);
  if(identity.length)playerEntryTimeline.fromTo(identity,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?4:6},{autoAlpha:1,y:0,duration:mobile?.3:.36,stagger:mobile?.025:.04},.19);
  if(progressive.length)playerEntryTimeline.fromTo(progressive,{autoAlpha:SCENE_ENTRY_ALPHA,y:mobile?5:8},{autoAlpha:1,y:0,duration:mobile?.33:.4,stagger:mobile?.035:.055},.3);
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
    .to(before,{autoAlpha:0,y:mobile?2:3,duration:MOAP_MOTION.duration.fast,ease:MOAP_MOTION.ease.exit,stagger:.008})
    .call(()=>{
      update();
      onUpdated?.();
      animatePlayerDataExperience(root,{delay:.08,recentGlow:true});
    })
    .fromTo(
      playerLayers(root),
      {autoAlpha:0,y:mobile?4:5},
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

export function animateRecordDetails(backdrop,{open,onComplete}={}){
  const gsap=motionEngine();
  const panel=backdrop?.querySelector(".record-modal");
  const header=panel?.querySelector(".record-modal-header");
  const sections=panel?.querySelectorAll ? [...panel.querySelectorAll(".record-modal-section")]:[];
  const footer=panel?.querySelector(".record-modal-footer");
  const internals=[header,...sections,footer].filter(Boolean);
  detailTimeline?.kill();

  if(!backdrop||!panel||motionDisabled()){
    if(!open)onComplete?.();
    return;
  }

  if(open){
    gsap.set(backdrop,{autoAlpha:0});
    gsap.set(panel,{autoAlpha:0,y:10,scale:.99,transformOrigin:"center top"});
    gsap.set(internals,{autoAlpha:0,y:6});
    detailTimeline=gsap.timeline({
      onComplete:()=>{
        gsap.set(backdrop,{clearProps:"opacity,visibility"});
        gsap.set(panel,{clearProps:"opacity,visibility,transform,transformOrigin"});
        clearMotionProps(internals);
        detailTimeline=null;
        onComplete?.();
      }
    })
      .to(backdrop,{autoAlpha:1,duration:.14,ease:"power1.out"})
      .to(panel,{autoAlpha:1,y:0,scale:1,duration:.34,ease:MOAP_MOTION.ease.enter},"-=.06")
      .to(internals,{autoAlpha:1,y:0,duration:.26,stagger:.05,ease:MOAP_MOTION.ease.enter},"-=.22");
    return;
  }

  detailTimeline=gsap.timeline({
    onComplete:()=>{
      gsap.set(backdrop,{clearProps:"opacity,visibility"});
      gsap.set(panel,{clearProps:"opacity,visibility,transform,transformOrigin"});
      detailTimeline=null;
      onComplete?.();
    }
  })
    .to(panel,{autoAlpha:0,y:6,scale:.99,duration:.2,ease:MOAP_MOTION.ease.exit})
    .to(backdrop,{autoAlpha:0,duration:.14,ease:MOAP_MOTION.ease.exit},"-=.1");
}
