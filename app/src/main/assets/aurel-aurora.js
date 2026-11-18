/* AUREL 1.1.66 — album-derived, genuinely beat-reactive ambient light.
 * A real FFT frame changes shadow brightness and gradient position.
 * No timer, constant rotation or pretend beat. The native artwork palette
 * comes from actual Qobuz image pixels, independent of CORS/canvas.
 * The optional audio capture runs only for AUREL's own audio session and
 * stops when playback ends or bit-perfect disables Android Visualizer.
 */
(function installAurelAurora(){
 'use strict';
 const KEY='aurel_aurora_shadows_v1';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 let enabled=true;
 try{enabled=localStorage.getItem(KEY)!=='off';}catch(_){}
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const uk=()=>window.AurelLanguage?.get?.()==='uk';
 const motionAllowed=()=>!document.hidden&&!reduced?.matches&&
   document.documentElement?.dataset?.aurelMotion!=='off';
 const isPlaying=()=>!!(app.overlay&&app.player?.playing&&
   !app.player?.buffering&&!app.player?.error);
 const bitPerfect=()=>!!app.player?.bitPerfect?.enabled;
 const validHex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
 const neutral={
   bg:'#111214',surface:'#222326',accent:'#D5D7DB',
   one:'#D0C8C2',two:'#B6A99F',three:'#E3D3C5'
 };
 let currentCover='',current=neutral,captureWanted=null,lastFrame=0;
 let lastPulse=0,lastPeak=0,rotation=0;
 const palettes=new Map();

 function coverUrl(){
   return app.player?.track&&typeof image==='function'?image(app.player.track):'';
 }
 function setStyle(colors){
   const c=colors||neutral;
   current=c;
   // The full-screen player and its persistent bottom navigation are siblings.
   // Mirror verified artwork CSS tokens onto the nav so they match without
   // changing the appearance of unrelated app pages.
   const nav=document.querySelector?.('.bottom-nav');
   for(const target of [overlay,nav]){
     if(!target?.style)continue;
     target.style.setProperty('--aurel-album-bg',c.bg);
     target.style.setProperty('--aurel-album-surface',c.surface);
     target.style.setProperty('--aurel-album-accent',c.accent);
     target.style.setProperty('--aurel-album-one',c.one);
     target.style.setProperty('--aurel-album-two',c.two);
     target.style.setProperty('--aurel-album-three',c.three);
   }
 }
 function addHalo(){
   const art=overlay.querySelector('.murglar-view .murglar-art-wrap');
   const cover=art?.querySelector('.murglar-cover');
   if(!art||!cover||art.querySelector('.aurel-aurora-halo'))return;
   const halo=document.createElement('span');
   halo.className='aurel-aurora-halo';
   halo.setAttribute('aria-hidden','true');
   art.insertBefore(halo,cover);
 }
 function intensity(value){
   overlay.style.setProperty('--aurel-aurora-opacity',
     Math.max(0,Math.min(1,value)).toFixed(3));
 }
 function resetBeat(){
   lastFrame=0;lastPeak=0;lastPulse=0;rotation=0;
   overlay.style.setProperty('--aurel-aurora-rotation','0deg');
 }
 function wantCapture(ask=false){
   // Capture only AUREL's currently-playing MediaPlayer session, not global
   // output or the microphone. No capture during Android bit-perfect mode.
   const wanted=enabled&&isPlaying()&&motionAllowed()&&!bitPerfect();
   if(wanted===captureWanted&&!ask)return;
   captureWanted=wanted;
   window.AurelCoverRhythm?.setAuraCaptureWanted?.(wanted,!!ask);
 }
 function sync(){
   const next=coverUrl();
   if(next!==currentCover){
     currentCover=next;
     setStyle(palettes.get(next)||neutral);
     resetBeat();
   }
   const visible=enabled&&!!app.overlay;
   const active=visible&&isPlaying()&&motionAllowed();
   const real=active&&!bitPerfect()&&lastFrame>0&&Date.now()-lastFrame<1500;
   overlay.classList.toggle('aurel-aurora-enabled',visible);
   overlay.classList.toggle('aurel-aurora-playing',active);
   overlay.classList.toggle('aurel-aurora-beat-live',real);
   if(visible)addHalo();
   if(!active){
     resetBeat();
     intensity(visible ? .26 : 0);
   }else if(!real){
     // Static, dim album tint when Android denies FFT or bit-perfect is on.
     // No unsolicited fabricated beat. Actual FFT will light it up.
     intensity(.34);
   }
   wantCapture();
   updateStatus();
 }
 function onBeat(value){
   if(!enabled||!isPlaying()||!motionAllowed()||bitPerfect())return;
   const n=Number(value);
   if(!Number.isFinite(n))return;
   const level=Math.max(0,Math.min(1,n));
   const now=Date.now();
   lastFrame=now;
   const strong=Math.pow(level,.70);
   overlay.style.setProperty('--aurel-aurora-beat',strong.toFixed(3));
   intensity(.30+strong*.66);
   if(level>.27&&level>lastPeak+.11&&now-lastPulse>190){
     lastPulse=now;
     rotation=(rotation+12)%360;
     overlay.style.setProperty('--aurel-aurora-rotation',rotation+'deg');
   }
   lastPeak=level;
   overlay.classList.add('aurel-aurora-beat-live');
 }
 function nativePalette(url,bg,surface,accent,one,two,three){
   if(typeof url!=='string'||!url)return;
   if(![bg,surface,accent,one,two,three].every(validHex))return;
   const colors={bg,surface,accent,one,two,three};
   palettes.set(url,colors);
   if(palettes.size>30)palettes.delete(palettes.keys().next().value);
   if(url===coverUrl()){
     currentCover=url;
     setStyle(colors);
     sync();
   }
 }
 function statusText(){
   if(!enabled)return uk()?'Вимкнено.':'Off.';
   if(bitPerfect())return uk()?
     'У bit-perfect Android FFT недоступний: світіння залишається статичним.':
     'Bit-perfect: Android FFT is unavailable; glow stays static.';
   if(!motionAllowed())return uk()?
     'Рух вимкнено в Android або AUREL.':
     'Motion is disabled in Android or AUREL.';
   if(!app.player?.playing)return uk()?
     'Пульсація почнеться під час відтворення.':
     'Pulse starts when music is playing.';
   const st=window.AurelCoverRhythm?.status?.()||'waiting';
   if(st==='live')return uk()?
     'Світіння реагує на справжні FFT-імпульси.':
     'Glow follows real FFT bass transients.';
   if(st==='permission')return uk()?
     'Потрібен дозвіл Android на аудіоаналіз: вимкни й знову ввімкни світіння.':
     'Audio analysis permission required: switch glow off/on to retry.';
   if(st==='unavailable'||st==='silent')return uk()?
     'Android не передає придатний FFT для поточного аудіовиходу.':
     'Android is not providing usable FFT from this audio route.';
   return uk()?'Очікування реальних FFT-даних…':'Waiting for genuine FFT frames…';
 }
 function updateStatus(){
   const element=document.querySelector?.('[data-aurel-aurora-status]');
   if(element)element.textContent=statusText();
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
     (uk()?'Світіння в кольорах обкладинки':'Album-colored glow')+
     '</strong><small>'+
     (uk()?'Палітра з обкладинки. Світіння змінюється в такт справжнім FFT-імпульсам у звичайному режимі. У bit-perfect залишається статичним.':
       'Colors sampled from the album. Real FFT pulses drive the glow in standard audio; it stays static in bit-perfect.')+
     '</small><small data-aurel-aurora-status aria-live="polite"></small></span><input type="checkbox" data-aurel-aurora-toggle '+
     'aria-label="'+(uk()?'Кольорове світіння':'Album-colored glow')+'" '+
     (enabled?'checked':'')+'>';
   host.appendChild(label);
   updateStatus();
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
   if(kind==='player'||kind==='beatStatus'||kind==='beatPermission')sync();
   return result;
 };
 if(typeof window.AurelBeatFrame==='function'){
   const prior=window.AurelBeatFrame;
   window.AurelBeatFrame=function(level){
     const result=prior.apply(this,arguments);
     onBeat(level);
     return result;
   };
 }
 document.addEventListener('change',event=>{
   if(!event.target.matches?.('[data-aurel-aurora-toggle]'))return;
   enabled=!!event.target.checked;
   try{localStorage.setItem(KEY,enabled?'on':'off');}catch(_){}
   resetBeat();
   // An explicit user toggle can retry the Android Visualizer permission.
   // Automatic redraws and playback updates never repeatedly prompt.
   sync(enabled);
 });
 document.addEventListener('visibilitychange',sync);
 if(reduced?.addEventListener)reduced.addEventListener('change',sync);
 window.AurelAuroraPalette=nativePalette;
 window.AurelAurora={enabled:()=>enabled,refresh:sync,isPlaying,
   isCaptureRequested:()=>!!captureWanted,acceptPalette:nativePalette};
 setStyle(neutral);
 installSetting();
 sync();
})();
