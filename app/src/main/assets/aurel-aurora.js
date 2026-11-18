/* AUREL 1.1.65 — iridescent artwork shadows.
 * Decorative ambient motion uses independent CSS compositing. It does NOT
 * claim to be an FFT visualizer and never touches audio playback or routing.
 * When genuine FFT beat frames exist, they only modulate glow intensity.
 */
(function installAurelAurora(){
 'use strict';
 const KEY='aurel_aurora_shadows_v1';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 let enabled=true;
 try{enabled=localStorage.getItem(KEY)!=='off';}catch(_){}
 let lastPaint=0;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const uk=()=>window.AurelLanguage?.get?.()==='uk';
 const motionAllowed=()=>!document.hidden&&!reduced?.matches&&
   document.documentElement?.dataset?.aurelMotion!=='off';
 const isPlaying=()=>!!(app.overlay&&app.player?.playing&&
   !app.player?.buffering&&!app.player?.error);
 function addHalo(){
   const art=overlay.querySelector('.murglar-view .murglar-art-wrap');
   const cover=art?.querySelector('.murglar-cover');
   if(!art||!cover||art.querySelector('.aurel-aurora-halo'))return;
   const halo=document.createElement('span');
   halo.className='aurel-aurora-halo';
   halo.setAttribute('aria-hidden','true');
   art.insertBefore(halo,cover);
 }
 function sync(){
   const visible=enabled&&!!app.overlay;
   const animated=visible&&isPlaying()&&motionAllowed();
   overlay.classList.toggle('aurel-aurora-enabled',visible);
   overlay.classList.toggle('aurel-aurora-playing',animated);
   if(visible)addHalo();
   if(!animated){
     overlay.style.setProperty('--aurel-aurora-opacity',visible?'0.43':'0');
   }else if(Date.now()-lastPaint>1000){
     // Prevent an old FFT sample from keeping the glow permanently bright.
     overlay.style.setProperty('--aurel-aurora-opacity','0.82');
   }
 }
 function installSetting(){
   const root=document.getElementById('screen');
   if(!root?.querySelector('.aurel-settings-heading')||
      root.querySelector('[data-aurel-aurora-setting]'))return;
   const host=root.querySelector('.aurel-appearance-panel')||
      root.querySelector('[data-aurel-pro-settings="performance"]')||
      root.querySelector('[data-aurel-settings-group="app"] .aurel-settings-group-content');
   if(!host)return;
   const label=document.createElement('label');
   label.className='aurel-appearance-toggle aurel-aurora-setting';
   label.setAttribute('data-aurel-aurora-setting','');
   label.innerHTML='<span><strong>'+
      (uk()?'Переливчасте кольорове світіння':'Iridescent album glow')+
      '</strong><small>'+
      (uk()?'М’які різноколірні тіні навколо обкладинки й кнопки відтворення. Переливаються, доки грає музика; справжні FFT-імпульси додатково підсилюють світіння. Працює також із bit-perfect.':
        'Soft multicolor shadows around the cover and play button. Ambient colors flow during playback; genuine FFT beats can amplify the glow. Also works with bit-perfect.')+
      '</small></span><input type="checkbox" data-aurel-aurora-toggle '+
      'aria-label="'+(uk()?'Кольорове світіння':'Iridescent album glow')+'" '+
      (enabled?'checked':'')+'>';
   host.appendChild(label);
 }
 const oldSettings=renderSettings;
 renderSettings=function(){
   const result=oldSettings.apply(this,arguments);
   installSetting();
   return result;
 };
 const oldDraw=drawOverlay;
 drawOverlay=function(){
   const result=oldDraw.apply(this,arguments);
   sync();
   return result;
 };
 const oldEvent=window.AurelEvent;
 window.AurelEvent=function(kind,data){
   const result=oldEvent.apply(this,arguments);
   if(kind==='player')sync();
   return result;
 };
 if(typeof window.AurelBeatFrame==='function'){
   const oldBeat=window.AurelBeatFrame;
   window.AurelBeatFrame=function(level){
     const result=oldBeat.apply(this,arguments);
     if(enabled&&isPlaying()&&motionAllowed()&&!app.player?.bitPerfect?.enabled){
       const value=Number(level);
       if(Number.isFinite(value)){
         const amount=Math.max(0,Math.min(1,value));
         // Paint-only opacity updates, no cover measurement or layout reflow.
         overlay.style.setProperty('--aurel-aurora-opacity',
           (0.70+Math.pow(amount,.65)*.27).toFixed(3));
         lastPaint=Date.now();
       }
     }
     return result;
   };
 }
 document.addEventListener('change',event=>{
   if(!event.target.matches?.('[data-aurel-aurora-toggle]'))return;
   enabled=!!event.target.checked;
   try{localStorage.setItem(KEY,enabled?'on':'off');}catch(_){}
   sync();
 });
 document.addEventListener('visibilitychange',sync);
 if(reduced?.addEventListener)reduced.addEventListener('change',sync);
 installSetting();
 sync();
 window.AurelAurora={enabled:()=>enabled,refresh:sync,isPlaying};
})();
