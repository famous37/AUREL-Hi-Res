/* Resize only from the drawer header. Its contents keep their native scroll. */
(function installAurelDetailDrag(){
 'use strict';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 const root=document.documentElement;
 const num=value=>Number.parseFloat(value)||0;
 let panel=null,activeKey='',expanded=false,gesture=null,frame=0;
 let suppressClickUntil=0;

 function bounds(){
  const view=panel?.closest('.murglar-view');
  if(!view)return null;
  const top=num(getComputedStyle(root).getPropertyValue('--aurel-native-status-inset'));
  const limit=Math.max(0,Math.floor(view.clientHeight-Math.max(36,top+14)));
  return {rest:Math.min(limit,window.innerHeight*.68,590),limit};
 }
 function writeHeight(height){
  const size=Math.round(height)+'px';
  if(panel.style.getPropertyValue('--aurel-drawer-size')!==size)
   panel.style.setProperty('--aurel-drawer-size',size);
 }
 function settle(){
  const size=bounds();
  if(!size)return;
  writeHeight(expanded?size.limit:size.rest);
  panel.dataset.aurelExpanded=String(expanded);
  const handle=panel.querySelector('.aurel-drawer-handle');
  if(handle){
   const label=expanded?'Collapse information panel':'Expand information panel';
   const language=window.AurelLanguage;
   const localized=language?.get()==='uk'?language.translate(label):label;
   handle.setAttribute('aria-expanded',String(expanded));
   handle.setAttribute('aria-label',localized);
   handle.title=localized;
  }
 }
 function clearGesture(){
  if(frame)cancelAnimationFrame(frame);
  frame=0;
  if(gesture)panel?.classList.remove('aurel-detail-dragging');
  gesture=null;
 }
 function synchronize(resize=false){
  const key=app.overlay&&app.playerSheet?String(app.playerSheet):'';
  const next=key?overlay.querySelector('.murglar-view .aurel-detail-drawer'):null;
  if(next===panel&&key===activeKey&&!resize)return;
  clearGesture();
  if(key!==activeKey||!key)expanded=false;
  if(next!==panel)suppressClickUntil=0;
  activeKey=key;
  panel=next;
  if(panel)settle();
 }
 function start(e){
  const header=e.target.closest?.('.aurel-drawer-header');
  if(!header||!panel?.contains(header)||!e.isPrimary||e.button!==0||
     e.target.closest('button:not(.aurel-drawer-handle)'))return;
  const size=bounds();
  if(!size)return;
  clearGesture();
  suppressClickUntil=0;
  gesture={id:e.pointerId,startY:e.clientY,delta:0,moved:false,size,base:expanded?size.limit:size.rest};
  // Capture on the original target so a tap still clicks the native button.
  if(e.isTrusted)e.target.setPointerCapture?.(e.pointerId);
 }
 function paint(){
  frame=0;
  if(!gesture)return;
  const {base,delta,size}=gesture;
  writeHeight(Math.max(Math.min(160,size.limit),Math.min(size.limit,base-delta)));
 }
 function move(e){
  if(!gesture||e.pointerId!==gesture.id)return;
  gesture.delta=e.clientY-gesture.startY;
  if(!gesture.moved){
   if(Math.abs(gesture.delta)<=6)return;
   gesture.moved=true;
   panel.classList.add('aurel-detail-dragging');
  }
  if(!frame)frame=requestAnimationFrame(paint);
  if(e.cancelable)e.preventDefault();
 }
 function finish(e){
  if(!gesture||e.pointerId!==gesture.id)return;
  const {startY,moved}=gesture;
  clearGesture();
  if(!moved)return;
  suppressClickUntil=Date.now()+250;
  const delta=e.clientY-startY;
  if(e.type==='pointerup'&&Math.abs(delta)>42)expanded=delta<0;
  settle();
 }
 overlay.addEventListener('pointerdown',start);
 document.addEventListener('pointermove',move,{passive:false});
 document.addEventListener('pointerup',finish,{passive:true});
 document.addEventListener('pointercancel',finish,{passive:true});
 overlay.addEventListener('lostpointercapture',finish);
 overlay.addEventListener('click',e=>{
  if(!e.target.closest?.('.aurel-drawer-handle')||!panel)return;
  e.stopPropagation();
  if(e.detail&&Date.now()<suppressClickUntil)return;
  expanded=!expanded;
  settle();
 });
 overlay.addEventListener('keydown',e=>{
  if(!e.target.matches?.('.aurel-drawer-handle')||!panel)return;
  if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();
  expanded=e.key==='ArrowUp'||e.key==='End';
  settle();
 });
 const originalDraw=drawOverlay;
 drawOverlay=function(){
  const result=originalDraw.apply(this,arguments);
  synchronize();
  return result;
 };
 const resize=()=>synchronize(true);
 window.addEventListener('resize',resize,{passive:true});
 window.addEventListener('orientationchange',resize,{passive:true});
 window.visualViewport?.addEventListener('resize',resize,{passive:true});
 window.AurelDetailDrag={sync:resize,isExpanded:()=>expanded};
})();
