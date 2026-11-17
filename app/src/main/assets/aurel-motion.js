/* AUREL 1.1.25 — navigation-only compositor fade.
 * A route change may fade once. A Qobuz response, player progress tick,
 * favourites change, artwork update, or page rerender must NEVER replay it. */
(function installAurelSmoothNavigation(){
 'use strict';
 let previous=null,active=null;
 const key=()=>{
   const entity=app.selected?.id&&app.selectedKind
     ?app.selectedKind+':'+String(app.selected.id):'';
   return [String(app.nav||'home'),entity,
     (!hasAuth()?'login:'+String(app.loginMode||''):'')].join('|');
 };
 function onRender(){
   const next=key();
   if(previous===null){previous=next;return;}
   if(previous===next)return; // same view, even if its HTML was replaced
   previous=next;
   const screen=document.getElementById('screen');
   if(!screen||typeof screen.animate!=='function'||document.hidden||app.overlay)return;
   if(document.documentElement?.dataset?.aurelMotion==='off'||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
   try {
     if(active&&typeof active.cancel==='function')active.cancel();
     active=screen.animate([
       {opacity:.955,transform:'translate3d(0,5px,0)'},
       {opacity:1,transform:'translate3d(0,0,0)'}],{
       duration:320,easing:'cubic-bezier(.22,1,.36,1)',fill:'none'
     });
   }catch(_){active=null;} // older WebViews simply render immediately
 }
 function wrap(name){
   const original=({render,renderArtist,renderSearch,renderLibrary,renderSettings})[name];
   if(typeof original!=='function')return;
   const decorated=function(){
     const result=original.apply(this,arguments);
     onRender();
     return result;
   };
   switch(name){
     case 'render':render=decorated;break;
     case 'renderArtist':renderArtist=decorated;break;
     case 'renderSearch':renderSearch=decorated;break;
     case 'renderLibrary':renderLibrary=decorated;break;
     case 'renderSettings':renderSettings=decorated;break;
   }
 }
 ['render','renderArtist','renderSearch','renderLibrary','renderSettings'].forEach(wrap);
 window.AurelSmoothMotion={routeKey:key};
})();
