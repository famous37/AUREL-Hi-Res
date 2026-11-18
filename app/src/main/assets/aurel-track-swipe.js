/* AUREL 1.1.74 — intentional, single-touch Now Playing navigation.
 * Swipe right -> NEXT, left -> PREVIOUS (owner's explicit preference).
 * Downward minimize remains owned by aurel-swipe-minimize.js.
 * No gesture starts from controls, seek bar, interactive links or open sheets.
 * Only transform and opacity are animated; audio playback is native. */
(function installAurelTrackSwipes(){
 'use strict';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 const BLOCK='button,a,input,select,textarea,[role="button"],' +
   '[data-seek],[contenteditable="true"],.murglar-progress-row,' +
   '.murglar-header,.aurel-detail-drawer,.aurel-detail-dimmer,' +
   '.aurel-detail-scroll,.murglar-detail-sheet,.murglar-transport,' +
   '.murglar-quick-actions';
 const motion=()=>document.documentElement?.dataset?.aurelMotion!=='off'&&
   !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 let start=null,locked=false,lastCommit=0,lastTrack=null;
 const identity=()=>String(app.player?.track?.id||
   app.player?.track?.title||app.player?.track?.name||'');
 function clear(){
   start=null;
   overlay.classList.remove('aurel-track-scrubbing','aurel-track-settling');
   overlay.style.removeProperty('--aurel-track-drag-x');
   overlay.style.removeProperty('--aurel-track-drag-alpha');
 }
 function blocked(target){
   return !target||!!target.closest?.(BLOCK)||
     !!app.playerSheet||!app.overlay||
     overlay.classList.contains('hidden');
 }
 overlay.addEventListener('touchstart',event=>{
   if(locked||event.touches?.length!==1||blocked(event.target))return;
   const t=event.touches[0];
   start={x:t.clientX,y:t.clientY,at:performance.now(),
     axis:'',lastX:t.clientX,lastY:t.clientY};
 },{passive:true});
 overlay.addEventListener('touchmove',event=>{
   if(!start||event.touches?.length!==1)return;
   const t=event.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
   start.lastX=t.clientX;start.lastY=t.clientY;
   if(!start.axis&&Math.hypot(dx,dy)>14)
     start.axis=Math.abs(dx)>Math.abs(dy)*1.45?'horizontal':'vertical';
   if(start.axis!=='horizontal')return;
   if(event.cancelable)event.preventDefault();
   const distance=Math.sign(dx)*Math.min(Math.abs(dx)*.48,58);
   overlay.classList.add('aurel-track-scrubbing');
   overlay.style.setProperty('--aurel-track-drag-x',distance.toFixed(1)+'px');
   overlay.style.setProperty('--aurel-track-drag-alpha',
     Math.max(.85,1-Math.abs(dx)/850).toFixed(3));
 },{passive:false});
 function finish(event,canceled){
   if(!start)return;
   const t=event.changedTouches?.[0];
   const dx=(t?.clientX??start.lastX)-start.x;
   const dy=(t?.clientY??start.lastY)-start.y;
   const horizontal=start.axis==='horizontal';
   const elapsed=Math.max(1,performance.now()-start.at);
   start=null;
   if(!horizontal)return; // vertical gesture belongs to existing handler
   const accept=!canceled&&Math.abs(dx)>=78&&
     Math.abs(dx)>=Math.abs(dy)*1.5&&elapsed<1150&&
     !locked&&app.overlay&&performance.now()-lastCommit>350;
   overlay.classList.remove('aurel-track-scrubbing');
   overlay.classList.add('aurel-track-settling');
   overlay.style.removeProperty('--aurel-track-drag-x');
   overlay.style.removeProperty('--aurel-track-drag-alpha');
   if(!accept){setTimeout(clear,250);return;}
   locked=true;lastCommit=performance.now();
   const action=dx>0?'next':'previous';
   // Let the subtle 120 ms artwork fade lead the native track request.
   const art=overlay.querySelector?.('.murglar-art-wrap');
   if(art&&motion()&&typeof art.animate==='function'){
     art.animate([{opacity:1,transform:'translate3d(0,0,0)'},
       {opacity:.82,transform:'translate3d('+Math.sign(dx)*22+'px,0,0)'}],
       {duration:120,easing:'cubic-bezier(.4,0,.8,.4)',fill:'none'});
   }
   setTimeout(()=>{
     Promise.resolve().then(()=>nativeCall(action)).catch(error=>{
       if(typeof showToast==='function')
         showToast(window.AurelLanguage?.get?.()==='uk'?
           'Не вдалося перемкнути трек':(error?.message||'Could not change track'),3500);
     }).finally(()=>{locked=false;setTimeout(clear,210);});
   },motion()?105:0);
 }
 overlay.addEventListener('touchend',event=>finish(event,false),{passive:true});
 overlay.addEventListener('touchcancel',event=>finish(event,true),{passive:true});
 const originalDraw=drawOverlay;
 drawOverlay=function(){
   const previous=lastTrack;
   const priorView=overlay.querySelector?.('.murglar-view');
   const priorSheetHTML=overlay.querySelector?.('.aurel-detail-sheet')?.innerHTML;
   const result=originalDraw.apply(this,arguments);
   const current=identity();
   const renderedView=overlay.querySelector?.('.murglar-view');
   const renderedSheetHTML=overlay.querySelector?.('.aurel-detail-sheet')?.innerHTML;
   if(current&&previous&&current!==previous&&app.overlay&&motion()){
     const art=overlay.querySelector?.('.murglar-art-wrap');
     if(art&&typeof art.animate==='function')
       art.animate([{opacity:.83,transform:'translate3d(-10px,0,0)'},
         {opacity:1,transform:'translate3d(0,0,0)'}],
         {duration:240,easing:'cubic-bezier(.22,1,.36,1)',fill:'none'});
   }
   lastTrack=current;
   // Translate freshly rendered controls before the first browser paint,
   // not asynchronously after the player opens.
   if(window.AurelLanguage?.get?.()==='uk'&&
      (priorView!==renderedView||priorSheetHTML!==renderedSheetHTML))
     window.AurelLanguage.refresh?.(overlay);
   return result;
 };
 window.AurelTrackSwipe={reset:clear};
})();
