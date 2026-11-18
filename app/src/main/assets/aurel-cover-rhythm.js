/* AUREL 1.1.61: ONLY genuine FFT-triggered album cover movement.
 * The previous fixed 3.1-second breathing animation was NOT musical rhythm.
 * It is removed: no audio frames => no animation (and clear diagnostics).
 * Capture remains opt-in, read-only, and disabled for bit-perfect output. */
(function installAurelCoverRhythm(){
 'use strict';
 const KEY='aurel_cover_rhythm_v1';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 let enabled=false;
 try{enabled=localStorage.getItem(KEY)==='on';}catch(_){}
 let permissionGranted=false;
 let nativeStatus='off';
 let lastFrame=0;
 let nativeWanted=null;
 let auraRequested=false;
 let writeQueue=Promise.resolve();
 let bitPerfectWarned=false;
 let unavailableWarned=false;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const safeMotion=()=>!document.hidden&&!reduced?.matches&&
   document.documentElement.dataset.aurelMotion!=='off';
 const audioPlaying=()=>!!(enabled&&app.player?.playing&&
   !app.player?.buffering&&!app.player?.error&&safeMotion());
 const playing=()=>!!(app.overlay&&audioPlaying());
 const bitPerfect=()=>!!app.player?.bitPerfect?.enabled;
 // Capture is allowed while viewing Settings, otherwise diagnostics would
 // always report "off" as soon as the user leaves Now Playing.
 const requestCapture=()=>!bitPerfect()&&
   ((audioPlaying())||(auraRequested&&app.player?.playing&&
     !app.player?.buffering&&!app.player?.error&&safeMotion()));
 const uk=()=>window.AurelLanguage?.get?.()==='uk';
 const setScale=level=>{
   const amount=Math.max(0,Math.min(1,Number(level)||0));
   const visible=Math.pow(amount,.72);
   overlay.style.setProperty('--aurel-cover-scale',(0.965+visible*0.135).toFixed(4));
   overlay.style.setProperty('--aurel-beat-glow',(0.10+visible*.45).toFixed(3));
 };
 function diagnostic(){
   if(!enabled)return uk()?'Вимкнено.':'Off.';
   if(reduced?.matches||document.documentElement.dataset.aurelMotion==='off')
     return uk()?'Анімації вимкнено в системі або AUREL.':'Motion is disabled in Android or AUREL.';
   if(bitPerfect())
     return uk()?'Bit-perfect: Android FFT недоступний. Для реакції на бас вимкни bit-perfect у налаштуваннях аудіо.':
       'Bit-perfect: Android FFT is unavailable. Disable bit-perfect in Audio settings to react to bass.';
   if(nativeStatus==='permission')
     return uk()?'Надай Android дозвіл на аналіз аудіо: вимкни й знову ввімкни перемикач.':
       'Grant Android audio analysis permission: switch off and on again.';
   if(nativeStatus==='unavailable')
     return uk()?'Android не надсилає аудіокадрів FFT. Спробуй звичайне відтворення без bit-perfect.':
       'Android is not delivering FFT frames. Try standard playback without bit-perfect.';
   if(nativeStatus==='silent')
     return uk()?'FFT надходить, але аудіосигнал нульовий — можливий обхід мікшера або обмеження Android.':
       'FFT frames arrive but contain no usable signal. Android may bypass the mixer.';
   if(nativeStatus==='live')
     return uk()?'Справжня реакція на бас активна.':'Real bass-reactive animation is active.';
   if(playing())return uk()?'Очікування справжніх аудіоданих…':'Waiting for real audio data…';
   return uk()?'Відкрий повний плеєр під час відтворення, щоб обкладинка реагувала на музику.':
     'Open Now Playing during playback for a music-reactive cover.';
 }
 function updateSettingStatus(){
   const box=document.querySelector('[data-aurel-rhythm-status]');
   if(box)box.textContent=diagnostic();
 }
 function queueNative(wanted,ask){
   writeQueue=writeQueue.catch(()=>{}).then(()=>
     nativeCall('setBeatVisualization',{enabled:!!wanted,requestPermission:!!ask}));
   writeQueue.catch(()=>{nativeWanted=null;});
   return writeQueue;
 }
 function sync(askPermission=false){
   const active=playing();
   const live=active&&requestCapture()&&lastFrame>0&&Date.now()-lastFrame<1300;
   overlay.classList.toggle('aurel-cover-rhythm',active);
   overlay.classList.toggle('aurel-beat-live',live);
   // IMPORTANT: no ambient/clock animation can misrepresent the music.
   overlay.classList.remove('aurel-beat-ambient');
   if(!live)setScale(0);
   if(active&&bitPerfect()&&!bitPerfectWarned){
     bitPerfectWarned=true;
     showToast(uk()?'Bit-perfect не дає Android зчитати бас. Для пульсації в такт вимкни bit-perfect.':
       'Android cannot analyze bass in bit-perfect mode. Disable bit-perfect for real rhythm.',5500);
   }
   if(!bitPerfect())bitPerfectWarned=false;
   const wanted=requestCapture();
   const ask=askPermission&&enabled&&!permissionGranted;
   if(wanted!==nativeWanted||ask){
     nativeWanted=wanted;
     if(!wanted)lastFrame=0;
     queueNative(wanted,ask).then(result=>{
       if(result?.permissionGranted===true)permissionGranted=true;
       updateSettingStatus();
     }).catch(()=>{});
   }
   updateSettingStatus();
 }
 window.AurelBeatFrame=function(level){
   if(!requestCapture())return;
   const value=Number(level);
   if(!Number.isFinite(value))return;
   lastFrame=Date.now();
   if(app.overlay&&enabled){
     setScale(value);
     if(!overlay.classList.contains('aurel-beat-live'))sync();
   }
 };
 function installSetting(){
   const root=document.getElementById('screen');
   if(!root?.querySelector('.aurel-settings-heading')||
     root.querySelector('[data-aurel-cover-rhythm]'))return;
   const host=root.querySelector('.aurel-appearance-panel')||
     root.querySelector('[data-aurel-pro-settings="performance"]')||
     root.querySelector('[data-aurel-settings-group="app"] .aurel-settings-group-content');
   if(!host)return;
   const ukrainian=uk();
   const label=document.createElement('label');
   label.className='aurel-appearance-toggle aurel-rhythm-setting';
   label.setAttribute('data-aurel-cover-rhythm','');
   label.innerHTML='<span><strong>'+
     (ukrainian?'Пульсація обкладинки в такт музиці':'Beat-reactive album artwork')+
     '</strong><small>'+
     (ukrainian
       ?'Тільки справжні імпульси баса з Android FFT, без циклічної анімації. Нічого не записується.'
       :'Only real bass transients from Android FFT, never a timed animation. Nothing is recorded.')+
     '</small><small data-aurel-rhythm-status aria-live="polite"></small></span>'+
     '<input type="checkbox" data-aurel-rhythm-toggle aria-label="'+
     (ukrainian?'Пульсація обкладинки':'Beat-reactive album artwork')+
     '" '+(enabled?'checked':'')+'>';
   host.appendChild(label);
   updateSettingStatus();
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
     updateSettingStatus();
   }
   if(kind==='beatStatus'){
     nativeStatus=String(data?.state||'off');
     if(nativeStatus==='live')unavailableWarned=false;
     if(nativeStatus==='unavailable'&&enabled&&app.overlay&&!unavailableWarned){
       unavailableWarned=true;
       showToast(uk()?'Android не передає FFT для цієї аудіосесії — фальшиву пульсацію вимкнено.':
         'Android is not supplying FFT audio data; no simulated pulse is shown.',5500);
     }
     updateSettingStatus();
   }
   return result;
 };
 document.addEventListener('change',event=>{
   if(!event.target.matches?.('[data-aurel-rhythm-toggle]'))return;
   enabled=!!event.target.checked;
   try{localStorage.setItem(KEY,enabled?'on':'off');}catch(_){}
   if(!enabled){unavailableWarned=false;lastFrame=0;}
   // Exactly ONE queued native request, with the desired enabled value.
   // The old code queued (false, requestPermission) and (true, false),
   // which could race across worker threads and leave capture disabled.
   sync(enabled);
 });
 document.addEventListener('visibilitychange',sync);
 if(reduced?.addEventListener)reduced.addEventListener('change',sync);
 installSetting();
 sync();
 window.AurelCoverRhythm={
   enabled:()=>enabled,
   isNativeCaptureRequested:()=>!!nativeWanted,
   status:()=>nativeStatus,
   refresh:sync,
   setAuraCaptureWanted:(wanted,askPermission=false)=>{
     auraRequested=!!wanted;
     sync(!!askPermission);
   },
   hasPermission:()=>permissionGranted
 };
})();
