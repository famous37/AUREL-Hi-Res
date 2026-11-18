/* AUREL: opt-in beat-reactive artwork.
 * Own-session FFT values are supplied by Android; CSS never changes audio.
 * When capture is unavailable (or USB bit-perfect is selected), a restrained
 * ambient pulse replaces beat detection rather than inventing a BPM. */
(function installAurelCoverRhythm(){
 'use strict';
 const KEY='aurel_cover_rhythm_v1';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 let enabled=false;
 try{enabled=localStorage.getItem(KEY)==='on';}catch(_){}
 let permissionGranted=false;
 let lastFrame=0;
 let nativeWanted=null;
 let writeQueue=Promise.resolve();
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const safeMotion=()=>!document.hidden && !reduced?.matches &&
   document.documentElement.dataset.aurelMotion!=='off';
 const playing=()=>!!(enabled&&app.overlay&&app.player?.playing&&
   !app.player?.buffering&&!app.player?.error&&safeMotion());
 const bitPerfect=()=>!!app.player?.bitPerfect?.enabled;
 const requestCapture=()=>playing()&&!bitPerfect();
 const setScale=level=>{
   const amount=Math.max(0,Math.min(1,Number(level)||0));
   overlay.style.setProperty('--aurel-cover-scale',(0.963+amount*0.127).toFixed(4));
   overlay.style.setProperty('--aurel-beat-glow',(0.17+amount*0.36).toFixed(3));
 };
 function queueNative(wanted,ask=false){
   writeQueue=writeQueue.catch(()=>{}).then(()=>
     nativeCall('setBeatVisualization',{enabled:!!wanted,requestPermission:!!ask}));
   // A permission refusal, unsupported Visualizer or a missing bridge must
   // never prevent normal music playback or navigation.
   writeQueue.catch(()=>{nativeWanted=null;});
   return writeQueue;
 }
 function sync(){
   const active=playing();
   overlay.classList.toggle('aurel-cover-rhythm',active);
   const live=active&&requestCapture()&&lastFrame>0&&Date.now()-lastFrame<900;
   overlay.classList.toggle('aurel-beat-live',live);
   overlay.classList.toggle('aurel-beat-ambient',active&&!live);
   if(!active)setScale(0);
   const wanted=requestCapture();
   if(wanted!==nativeWanted){
     nativeWanted=wanted;
     if(!wanted)lastFrame=0;
     queueNative(wanted,false).then(result=>{
       if(result?.permissionGranted===true)permissionGranted=true;
     }).catch(()=>{});
   }
 }
 window.AurelBeatFrame=function(level){
   if(!requestCapture())return;
   lastFrame=Date.now();
   const value=Number(level);
   if(!Number.isFinite(value))return;
   setScale(value);
   if(!overlay.classList.contains('aurel-beat-live'))sync();
 };
 function installSetting(){
   const root=document.getElementById('screen');
   if(!root?.querySelector('.aurel-settings-heading')||
      root.querySelector('[data-aurel-cover-rhythm]'))return;
   const host=root.querySelector('.aurel-appearance-panel')||
     root.querySelector('[data-aurel-pro-settings="performance"]')||
     root.querySelector('[data-aurel-settings-group="app"] .aurel-settings-group-content');
   if(!host)return;
   const ukrainian=window.AurelLanguage?.get?.()==='uk';
   const label=document.createElement('label');
   label.className='aurel-appearance-toggle aurel-rhythm-setting';
   label.setAttribute('data-aurel-cover-rhythm','');
   label.innerHTML='<span><strong>'+
     (ukrainian?'Пульсація обкладинки':'Rhythmic album artwork')+'</strong><small>'+
     (ukrainian
       ?'Реакція на бас і ритм. Потрібен дозвіл Android на аудіо; нічого не записується. У bit-perfect — м’яка анімація.'
       :'React to bass and rhythm. Android audio permission is required; nothing is recorded. Soft animation in bit-perfect.')+
     '</small></span><input type="checkbox" data-aurel-rhythm-toggle aria-label="'+
     (ukrainian?'Пульсація обкладинки':'Rhythmic album artwork')+'" '+(enabled?'checked':'')+'>';
   host.appendChild(label);
 }
 const originalSettings=renderSettings;
 renderSettings=function(){
   const result=originalSettings.apply(this,arguments);
   installSetting();
   return result;
 };
 const originalDraw=drawOverlay;
 drawOverlay=function(){
   const result=originalDraw.apply(this,arguments);
   sync();
   return result;
 };
 const originalEvent=window.AurelEvent;
 window.AurelEvent=function(kind,data){
   const result=originalEvent.apply(this,arguments);
   if(kind==='player')sync();
   if(kind==='beatPermission'){
     permissionGranted=!!data?.granted;
     if(!permissionGranted){
       const msg=window.AurelLanguage?.get?.()==='uk'
         ?'Без дозволу Android працюватиме лише м’яка анімація.'
         :'Without Android audio permission, only soft animation is available.';
       showToast(msg,4800);
     }
   }
   return result;
 };
 document.addEventListener('change',event=>{
   if(!event.target.matches?.('[data-aurel-rhythm-toggle]'))return;
   enabled=!!event.target.checked;
   try{localStorage.setItem(KEY,enabled?'on':'off');}catch(_){}
   if(enabled&&!permissionGranted){
     // Only an explicit user toggle may ask for the Android permission.
     queueNative(false,true).then(result=>{
       permissionGranted=!!result?.permissionGranted;
     }).catch(()=>{});
   }
   sync();
 });
 document.addEventListener('visibilitychange',sync);
 if(reduced?.addEventListener)reduced.addEventListener('change',sync);
 // Player state events and FFT callbacks drive the effect; no idle timer.
 installSetting();
 sync();
 window.AurelCoverRhythm={
   enabled:()=>enabled,
   isNativeCaptureRequested:()=>!!nativeWanted,
   refresh:sync
 };
})();
