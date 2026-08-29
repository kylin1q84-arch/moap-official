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
  ".rival-summary-inline td"
].join(",");

let initialized = false;
let viewTimeline = null;
let recordTimeline = null;
let filterTimeline = null;
let detailTimeline = null;
const numberHistory = new Map();
const numberTweens = new Map();

function motionEngine(){
  return window.gsap || null;
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
