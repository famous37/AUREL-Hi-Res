/* AUREL 1.1.63 — compositor-only window entrance and graceful back.
 * Do not animate player measurements, artwork transforms, controls, progress,
 * persistent navigation bars or background data refreshes. */
(function installAurelFluidWindows(){
 'use strict';
 const overlay=document.getElementById('overlay');
 if(!overlay||typeof drawOverlay!=='function')return;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const allowed=()=>!document.hidden&&!reduced?.matches&&
   document.documentElement?.dataset?.aurelMotion!=='off';
 let entering=null;
 const cancel=animation=>{try{animation?.cancel?.();}catch(_){}};
 function enter(element,frames,options){
   if(!element||typeof element.animate!=='function'||!allowed())return null;
   try{return element.animate(frames,{...options,fill:'none'});}
   catch(_){return null;}
 }
 const oldDraw=drawOverlay;
 drawOverlay=function(){
   const wasOpen=!!overlay.querySelector('.murglar-view')&&
     !overlay.classList.contains('hidden');
   const result=oldDraw.apply(this,arguments);
   if(!app.overlay||overlay.classList.contains('hidden')||!allowed())return result;
   const view=overlay.querySelector('.murglar-view');
   if(!view)return result;
   if(!wasOpen){
     cancel(entering);
     // A nearly opaque compositor fade prevents the bright WebView flash.
     // Do not translate the full player: its cover and native insets remain stable.
     entering=enter(view,[
       {opacity:.96},
       {opacity:1}
     ],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
   }
   return result;
 };
 // The down-chevron and touch swipe already use the same gesture-owned close.
 // Unify Android Back with that path only when the player has no active sheet.
 function wrapBack(name){
   const prior=window[name];
   if(typeof prior!=='function')return;
   window[name]=function(){
     if(app.overlay&&!app.playerSheet&&allowed()&&
       overlay.querySelector('.murglar-view')&&
       typeof window.AurelSwipeMinimize?.minimize==='function'){
       window.AurelSwipeMinimize.minimize();return;
     }
     return prior.apply(this,arguments);
   };
 }
 wrapBack('AurelBack');
 wrapBack('AurelHistoryBack');
 window.AurelFluidWindows={enabled:allowed};
})();