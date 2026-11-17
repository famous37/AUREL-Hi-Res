/* AUREL 1.1.29 — swipe the expanded player down to return to its
 * underlying playlist/album/artist at the same scroll position.
 *
 * Delegated touch listeners survive a MediaPlayer progress rerender. The
 * existing AurelHistoryBack handler owns dismissal and page persistence.
 * Do not intercept the seek bar, controls, detail sheets or a scrolling list.
 */
(function installAurelSwipeMinimize(){
  'use strict';
  const overlay=document.getElementById('overlay');
  if(!overlay || overlay.dataset.aurelSwipeInstalled==='1')return;
  overlay.dataset.aurelSwipeInstalled='1';

  const MIN_DRAG=14, DISTANCE=94, FLICK_DISTANCE=64, FLICK_SPEED=0.55;
  const blockedSelector=[
    'button','a','input','textarea','select',
    '[role="button"]','[role="slider"]','[role="dialog"]',
    '.murglar-quick-actions','.murglar-transport',
    '.murglar-progress-row','.aurel-detail-drawer',
    '.aurel-detail-dimmer'
  ].join(',');
  let gesture=null,restoreTimer=0,frame=0,offset=0;

  const time=()=>typeof performance!=='undefined'&&performance.now
    ?performance.now():Date.now();
  const isOpen=()=>!!(app.overlay&&!app.playerSheet&&
    overlay.querySelector('.murglar-view'));
  const closePage=()=>{
    if(typeof window.AurelHistoryBack==='function'){
      // Preserves the full originating route, album or playlist, and its scroll.
      window.AurelHistoryBack();
    }else{
      app.overlay=false;app.playerSheet='';
      drawOverlay();
    }
  };
  function clearVisual(animate){
    if(frame){cancelAnimationFrame(frame);frame=0;}
    if(restoreTimer){clearTimeout(restoreTimer);restoreTimer=0;}
    overlay.classList.remove('aurel-swipe-tracking','aurel-swipe-settling');
    if(animate && app.overlay){
      overlay.classList.add('aurel-swipe-settling');
      overlay.style.setProperty('--aurel-swipe-y','0px');
      overlay.style.setProperty('--aurel-swipe-alpha','1');
      restoreTimer=setTimeout(()=>{
        overlay.classList.remove('aurel-swipe-settling');
        overlay.style.removeProperty('--aurel-swipe-y');
        overlay.style.removeProperty('--aurel-swipe-alpha');
        restoreTimer=0;
      },180);
    }else{
      overlay.style.removeProperty('--aurel-swipe-y');
      overlay.style.removeProperty('--aurel-swipe-alpha');
    }
  }
  function paint(){
    frame=0;
    if(!gesture?.dragging||!isOpen())return;
    // Only compositor properties; no layout, album-art resizing or scroll jitter.
    const move=Math.min(84,Math.max(0,offset-12)*0.58);
    overlay.style.setProperty('--aurel-swipe-y',move.toFixed(1)+'px');
    overlay.style.setProperty('--aurel-swipe-alpha',
      (1-Math.min(0.10,move/850)).toFixed(3));
  }
  function start(event){
    gesture=null;
    clearVisual(false);
    if(!isOpen()||event.touches?.length!==1)return;
    const target=event.target?.nodeType===1?event.target:event.target?.parentElement;
    if(!target||!overlay.contains(target)||target.closest?.(blockedSelector))return;
    const view=overlay.querySelector('.murglar-view');
    const scrolling=view?.querySelector('.murglar-player-content');
    const fromHeader=!!target.closest?.('.murglar-header');
    if(!fromHeader&&scrolling&&scrolling.scrollTop>1)return;
    const point=event.touches[0];
    gesture={x:point.clientX,y:point.clientY,started:time(),dragging:false,
      scroller:scrolling,fromHeader,aborted:false};
  }
  function move(event){
    if(!gesture)return;
    if(event.touches?.length!==1||!isOpen()){cancel();return;}
    const point=event.touches[0];
    const dx=point.clientX-gesture.x,dy=point.clientY-gesture.y;
    if(gesture.aborted)return;
    if(!gesture.dragging){
      if(Math.abs(dx)>12&&Math.abs(dx)>=Math.abs(dy)){gesture.aborted=true;return;}
      if(dy<0&&Math.abs(dy)>MIN_DRAG){gesture.aborted=true;return;}
      if(dy<=MIN_DRAG||dy<=Math.abs(dx)*1.35)return;
      if(!gesture.fromHeader&&gesture.scroller?.scrollTop>1){
        gesture.aborted=true;return;
      }
      gesture.dragging=true;
      overlay.classList.remove('aurel-swipe-settling');
      overlay.classList.add('aurel-swipe-tracking');
    }
    if(dy<=0||Math.abs(dx)>dy*0.75){cancel();return;}
    if(event.cancelable)event.preventDefault();
    offset=dy;
    if(!frame)frame=requestAnimationFrame(paint);
  }
  function end(event){
    const g=gesture;
    gesture=null;
    if(!g){clearVisual(false);return;}
    if(!g.dragging||g.aborted){clearVisual(false);return;}
    const touch=event.changedTouches?.[0];
    const dy=touch?touch.clientY-g.y:offset;
    const dx=touch?touch.clientX-g.x:0;
    const elapsed=Math.max(1,time()-g.started);
    const accepted=isOpen() && dy>0 && dy>Math.abs(dx)*1.35 &&
      (dy>=DISTANCE || (dy>=FLICK_DISTANCE && dy/elapsed>=FLICK_SPEED));
    clearVisual(!accepted);
    if(accepted)closePage();
  }
  function cancel(){
    gesture=null;offset=0;clearVisual(true);
  }

  // Non-passive only on touchmove, to cancel the browser's pull-to-refresh when
  // a downward drag has already been positively recognized. Upward scrolls and
  // horizontal gestures are left to Android WebView.
  overlay.addEventListener('touchstart',start,{passive:true});
  document.addEventListener('touchmove',move,{capture:true,passive:false});
  document.addEventListener('touchend',end,{capture:true,passive:true});
  document.addEventListener('touchcancel',cancel,{capture:true,passive:true});
  window.AurelSwipeMinimize={isInstalled:true};
})();