/* AUREL 1.2.00 — reliable information drawers: drag header upward to
 * expand below the Android status bar, drag downward to compact.
 * Delegated listeners survive track changes, re-rendered lyrics and drawers.
 * Never intercept scrolling inside lyrics, track queue or audio information.
 */
(function installAurelDetailDrag(){
 'use strict';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 let expanded=false,activeKey='',gesture=null,frame=0,pendingHeight=null;
 let suppressClickUntil=0;
 const root=document.documentElement;
 const num=n=>Number.parseFloat(n)||0;
 const drawer=()=>overlay.querySelector('.murglar-view .aurel-detail-drawer');
 const player=()=>overlay.querySelector('.murglar-view');
 function bounds(){
  const view=player();
  if(!view)return null;
  const top=num(getComputedStyle(root).getPropertyValue('--aurel-native-status-inset'));
  const safety=Math.max(36,top+14);
  const limit=Math.max(120,Math.floor(view.clientHeight-safety));
  const rest=Math.min(limit,Math.min(window.innerHeight*.68,590));
  return {rest,limit};
 }
 function writeSize(value){
  const d=drawer(),b=bounds();
  if(!d||!b)return;
  const h=Math.max(Math.min(160,b.limit),Math.min(b.limit,Math.round(value)));
  d.style.setProperty('--aurel-drawer-size',h+'px');
  d.dataset.aurelExpanded=h>b.rest+24?'true':'false';
  const handle=d.querySelector('.aurel-drawer-handle');
  if(handle){
   const uk=window.AurelLanguage?.get?.()==='uk';
   handle.setAttribute('aria-label',d.dataset.aurelExpanded==='true'?
     (uk?'Згорнути інформаційне вікно':'Collapse information panel'):
     (uk?'Розгорнути інформаційне вікно':'Expand information panel'));
  }
 }
 function schedule(height){
  pendingHeight=height;
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;
   if(pendingHeight!==null)writeSize(pendingHeight);
   pendingHeight=null;
  });
 }
 function synchronize(){
  const d=drawer(),key=(app.overlay&&app.playerSheet)?String(app.playerSheet):'';
  if(!key){expanded=false;activeKey='';gesture=null;return;}
  if(key!==activeKey){activeKey=key;expanded=false;}
  if(!d)return;
  const b=bounds();if(!b)return;
  writeSize(expanded?b.limit:b.rest);
  const handle=d.querySelector('.aurel-drawer-handle');
  if(handle){
   handle.tabIndex=0;
   handle.setAttribute('role','button');
   handle.setAttribute('title',expanded?'Collapse information':'Expand information');
  }
 }
 function start(e){
  const h=e.target?.closest?.('.aurel-drawer-header');
  if(!h||!drawer()||e.target.closest('button')||!e.isPrimary)return;
  const b=bounds();if(!b)return;
  gesture={id:e.pointerId,originY:e.clientY,base:expanded?b.limit:b.rest,
           last:e.clientY,moved:false};
  e.preventDefault();
 }
 function move(e){
  if(!gesture||e.pointerId!==gesture.id)return;
  const dy=e.clientY-gesture.originY;
  if(Math.abs(dy)>6)gesture.moved=true;
  if(!gesture.moved)return;
  gesture.last=e.clientY;
  const d=drawer();if(d)d.classList.add('aurel-detail-dragging');
  schedule(gesture.base-dy);
  e.preventDefault();
 }
 function finish(e){
  if(!gesture||e.pointerId!==gesture.id)return;
  const dy=gesture.last-gesture.originY,moved=gesture.moved;
  gesture=null;
  drawer()?.classList.remove('aurel-detail-dragging');
  if(!moved)return;
  suppressClickUntil=Date.now()+250; // don't toggle again after a completed drag
  if(Math.abs(dy)>42)expanded=dy<0;
  const b=bounds();if(b)writeSize(expanded?b.limit:b.rest);
 }
 overlay.addEventListener('pointerdown',start,{passive:false});
 document.addEventListener('pointermove',move,{passive:false});
 document.addEventListener('pointerup',finish,{passive:true});
 document.addEventListener('pointercancel',finish,{passive:true});
 overlay.addEventListener('click',e=>{
  if(!e.target?.closest?.('.aurel-drawer-handle'))return;
  e.preventDefault();e.stopPropagation();
  if(Date.now()<suppressClickUntil)return;
  const b=bounds();if(!b)return;
  expanded=!expanded;writeSize(expanded?b.limit:b.rest);
 });
 overlay.addEventListener('keydown',e=>{
  if(!e.target?.classList?.contains('aurel-drawer-handle'))return;
  if(!['Enter',' ','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();
  const b=bounds();if(!b)return;
  if(e.key==='ArrowUp'||e.key==='End')expanded=true;
  else if(e.key==='ArrowDown'||e.key==='Home')expanded=false;
  else expanded=!expanded;
  writeSize(expanded?b.limit:b.rest);
 });
 const originalDraw=drawOverlay;
 drawOverlay=function(){
  const result=originalDraw.apply(this,arguments);
  synchronize();
  return result;
 };
 window.addEventListener('resize',synchronize,{passive:true});
 window.addEventListener('orientationchange',synchronize,{passive:true});
 window.visualViewport?.addEventListener('resize',synchronize,{passive:true});
 window.AurelDetailDrag={sync:synchronize,isExpanded:()=>expanded};
})();
