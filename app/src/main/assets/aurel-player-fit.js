/* AUREL: fit the complete listening interface to the actual WebView height.
   The fit uses rendered metadata/control heights, not a fixed screen preset.
   Playback, theme, account, shared navigation and sheet behaviour are untouched. */
(function installAurelPlayerFit(){
  'use strict';
  if(typeof drawOverlay!=='function')return;
  let frame=0;
  let observer=null;
  let observed=null;
  let navObserver=null,navObserved=null,lastNavHeight=0;
  // Native edge-to-edge inset values are written asynchronously after
  // setPlayerImmersive(). A view may keep its width/height while the status
  // inset changes, so observing only the view misses the final geometry.
  let insetStamp='';
  let lastFit=null; // Covers remain identical across opening/closing a detail sheet.
  function synchronizeNavHeight(){
    const nav=document.querySelector('.app .bottom-nav');
    const overlay=document.getElementById('overlay');
    if(!nav||!overlay)return;
    if(nav!==navObserved&&typeof ResizeObserver==='function'){
      navObserver?.disconnect();
      navObserved=nav;
      navObserver=new ResizeObserver(schedule);
      navObserver.observe(nav);
    }
    const pixels=Math.round(nav.getBoundingClientRect().height);
    if(pixels>0&&Math.abs(lastNavHeight-pixels)>1){
      lastNavHeight=pixels;
      overlay.style.setProperty('--aurel-nav-height',pixels+'px');
    }
  }
  const number=(value)=>Number.parseFloat(value)||0;
  function fit(){
    frame=0;
    const view=document.querySelector('#overlay:not(.hidden) .murglar-view');
    if(view)synchronizeNavHeight();
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
    // Opening a drawer changes CSS and overlays, but must never recompute the
    // album's size. Reuse this viewport/track geometry until the screen, font,
    // track metadata, or physical viewport genuinely changes.
    const track=typeof app==='undefined'?null:app.player?.track;
    const identity=[window.innerWidth,window.innerHeight,
      document.documentElement.style.getPropertyValue('--aurel-native-status-inset'),
      track?.id,track?.title,track?.album?.title].join('|');
    const key=[identity,content.clientWidth,content.clientHeight].join('|');
    if(lastFit?.key===key){
      if(view.style.getPropertyValue('--aurel-fit-art')!==lastFit.pixel+'px')
        view.style.setProperty('--aurel-fit-art',lastFit.pixel+'px');
      view.classList.toggle('aurel-fit-scroll',lastFit.scroll);
      return;
    }
    // Do not infer available height from a temporarily open sheet. On
    // initial mount it is safe to calculate from the player's usual controls.
    if(typeof app!=='undefined'&&app.playerSheet&&lastFit?.identity===identity){
      view.style.setProperty('--aurel-fit-art',lastFit.pixel+'px');
      view.classList.toggle('aurel-fit-scroll',lastFit.scroll);
      return;
    }
    const cs=getComputedStyle(content);
    const usable=Math.max(0,content.clientHeight-number(cs.paddingTop)-number(cs.paddingBottom));
    if(!usable)return;
    const children=[...content.children];
    let reserved=0,visible=0;
    for(const element of children){
      if(element===wrap)continue;
      const s=getComputedStyle(element);
      if(s.display==='none'||s.position==='absolute'||s.position==='fixed')continue;
      // The quality badge uses margin-bottom:auto to distribute unused
      // portrait height. getComputedStyle() can expose the RESOLVED pixel
      // size of that flexible margin, which depends on the current cover.
      // Counting it as fixed content causes a positive-feedback shrink:
      // close/reopen -> measure a larger spacer -> make the cover smaller.
      // Its space is optional, never a minimum required by the layout.
      const elasticEnd=element.classList?.contains('murglar-source-line');
      reserved+=element.getBoundingClientRect().height+number(s.marginTop)+
        (elasticEnd?0:number(s.marginBottom));
      visible++;
    }
    const gap=number(cs.rowGap||cs.gap);
    reserved+=gap*visible;
    const maxWidth=Math.max(0,content.clientWidth-number(cs.paddingLeft)-number(cs.paddingRight));
    const ideal=Math.min(maxWidth,window.innerWidth*0.94,window.innerHeight*0.53,460);
    const remainder=Math.floor(usable-reserved-3);
    const minCover=104;
    // Spend up to 20 extra CSS pixels on the cover; the surrounding content
    // scrolls naturally if the display has little vertical room.
    const cover=Math.max(minCover,Math.min(ideal,remainder+20));
    const pixel=Math.floor(Math.max(0,cover));
    // Avoid flickering due to +/-1px viewport rounding while playing.
    const previous=number(view.style.getPropertyValue('--aurel-fit-art'));
    if(!previous||Math.abs(previous-pixel)>2)
      view.style.setProperty('--aurel-fit-art',pixel+'px');
    const needsScroll=remainder<cover;
    view.classList.toggle('aurel-fit-scroll',needsScroll);
    lastFit={identity,key,pixel,scroll:needsScroll};
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
    else if(!after&&observed){
      observer.disconnect();
      observer=null;
      observed=null;
    }
    return result;
  };
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  window.addEventListener('pageshow',schedule,{passive:true});
  if(typeof MutationObserver==='function'&&document.documentElement){
    const root=document.documentElement;
    const stamp=()=>root.style.getPropertyValue('--aurel-native-status-inset')+'|'+
      root.style.getPropertyValue('--aurel-native-navigation-inset');
    insetStamp=stamp();
    new MutationObserver(()=>{
      const next=stamp();
      if(next===insetStamp)return;
      insetStamp=next;
      schedule();
    }).observe(root,{attributes:true,attributeFilter:['style']});
  }
  if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});
  schedule();
})();
