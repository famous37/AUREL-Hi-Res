/* AUREL: fit the complete listening interface to the actual WebView height.
   The fit uses rendered metadata/control heights, not a fixed screen preset.
   Playback, theme, account, shared navigation and sheet behaviour are untouched. */
(function installAurelPlayerFit(){
  'use strict';
  if(typeof drawOverlay!=='function')return;
  let frame=0;
  let observer=null;
  let observed=null;
  const number=(value)=>Number.parseFloat(value)||0;
  function fit(){
    frame=0;
    const view=document.querySelector('#overlay:not(.hidden) .murglar-view');
    const content=view?.querySelector('.murglar-player-content');
    if(!content)return;
    // Do not observe the content whose cover dimensions this function changes.
    // That feedback created a resize -> recalculate -> resize jitter loop.
    if(observed!==view&&typeof ResizeObserver==='function'){
      if(observer)observer.disconnect();
      observed=view;
      observer=new ResizeObserver(schedule);
      observer.observe(view);
    }
    const landscape=window.matchMedia('(orientation:landscape) and (min-width:420px)').matches;
    if(landscape){
      view.style.removeProperty('--aurel-fit-art');
      view.classList.remove('aurel-fit-scroll');
      return;
    }
    const wrap=content.querySelector('.murglar-art-wrap');
    if(!wrap)return;
    const cs=getComputedStyle(content);
    const usable=Math.max(0,content.clientHeight-number(cs.paddingTop)-number(cs.paddingBottom));
    if(!usable)return;
    const children=[...content.children];
    let reserved=0,visible=0;
    for(const element of children){
      if(element===wrap)continue;
      const s=getComputedStyle(element);
      if(s.display==='none'||s.position==='absolute'||s.position==='fixed')continue;
      reserved+=element.getBoundingClientRect().height+number(s.marginTop)+number(s.marginBottom);
      visible++;
    }
    const gap=number(cs.rowGap||cs.gap);
    reserved+=gap*visible;
    const maxWidth=Math.max(0,content.clientWidth-number(cs.paddingLeft)-number(cs.paddingRight));
    const ideal=Math.min(maxWidth,window.innerWidth*0.88,window.innerHeight*0.47,410);
    const remainder=Math.floor(usable-reserved-3);
    const minCover=104;
    const cover=Math.max(minCover,Math.min(ideal,remainder));
    const pixel=Math.floor(Math.max(0,cover));
    // Avoid flickering due to +/-1px viewport rounding while playing.
    const previous=number(view.style.getPropertyValue('--aurel-fit-art'));
    if(!previous||Math.abs(previous-pixel)>2)
      view.style.setProperty('--aurel-fit-art',pixel+'px');
    view.classList.toggle('aurel-fit-scroll',remainder<minCover);
  }
  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(fit);
  }
  const previousDraw=drawOverlay;
  drawOverlay=function(){
    const before=document.querySelector('#overlay:not(.hidden) .murglar-view');
    const result=previousDraw.apply(this,arguments);
    const after=document.querySelector('#overlay:not(.hidden) .murglar-view');
    // Position/FFT ticks keep the same DOM. Re-measuring every child on
    // every audio event created unnecessary synchronous layout work.
    // Text/artwork changes replace the view, and ResizeObserver still
    // handles genuine viewport changes and font scaling.
    if(after&&(after!==before||after!==observed))schedule();
    return result;
  };
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});
  schedule();
})();
