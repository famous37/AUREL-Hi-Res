/* AUREL 1.1.66 — cover-matched lighting, controlled by REAL FFT transients.
 * No synthetic BPM, independent color orbit, microphone recording, or audio
 * processing. USB bit-perfect keeps the static palette, never a fake beat.
 */
(function installAurelAurora(){
 'use strict';
 const KEY='aurel_aurora_shadows_v1';
 const overlay=document.getElementById('overlay');
 if(!overlay)return;
 let enabled=true;
 try{enabled=localStorage.getItem(KEY)!=='off';}catch(_){}
 const palettes=new Map();
 const FALLBACK={primary:'#82736c',secondary:'#a39a89',tertiary:'#574b48'};
 let lastCover='',lastFrame=0;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const uk=()=>window.AurelLanguage?.get?.()==='uk';
 const motionAllowed=()=>!document.hidden&&!reduced?.matches&&
   document.documentElement?.dataset?.aurelMotion!=='off';
 const isPlaying=()=>!!(app.overlay&&app.player?.playing&&
   !app.player?.buffering&&!app.player?.error);
 const bitPerfect=()=>!!app.player?.bitPerfect?.enabled;
 const currentCover=()=>app.player?.track?image(app.player.track):'';
 const hexOK=value=>typeof value==='string'&&/^#[0-9A-Fa-f]{6}$/.test(value);
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function hueOf(hex){
   const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
   const hi=Math.max(...rgb),lo=Math.min(...rgb),delta=hi-lo;
   if(delta<.02)return null;
   let h=hi===rgb[0]?((rgb[1]-rgb[2])/delta)%6:
     hi===rgb[1]?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4;
   return ((h*60)%360+360)%360;
 }
 // Stay within the actual image's dominant hue family; never force
 // neon cyan/purple onto an amber, rust, or monochrome album cover.
 function harmonize(bg,surface,accent){
   const hue=hueOf(accent);
   if(hue===null)return FALLBACK;
   const color=(offset,sat,light)=>
     'hsl('+(((hue+offset)%360+360)%360).toFixed(1)+'deg '+
     Math.round(sat*100)+'% '+Math.round(light*100)+'%)';
   return {
     primary:color(0,.84,.54),
     secondary:color(19,.77,.58),
     tertiary:color(-17,.71,.36)
   };
 }
 function ownedCover(url){
   if(!url||!app.player?.track)return false;
   if(url===currentCover())return true;
   const track=app.player.track;
   for(const obj of [track.image,track.album?.image,track.picture,track.cover]){
     if(typeof obj==='string'&&obj===url)return true;
     if(obj&&typeof obj==='object'){
       if(Object.values(obj).some(v=>v===url))return true;
       if(obj.images&&Object.values(obj.images).some(v=>v===url))return true;
     }
   }
   return false;
 }
 function colors(palette){
   overlay.style.setProperty('--aurel-aurora-primary',palette.primary);
   overlay.style.setProperty('--aurel-aurora-secondary',palette.secondary);
   overlay.style.setProperty('--aurel-aurora-tertiary',palette.tertiary);
 }
 function setPalette(){
   const url=currentCover();
   if(url!==lastCover){
     lastCover=url;
     lastFrame=0;
     clearBeat();
   }
   colors(palettes.get(url)||FALLBACK);
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
 function clearBeat(){
   overlay.classList.remove('aurel-aurora-beat');
   overlay.style.setProperty('--aurel-aurora-pulse-opacity','.30');
   overlay.style.setProperty('--aurel-aurora-diffuse-opacity','.20');
   overlay.style.setProperty('--aurel-aurora-pulse-scale','1');
   overlay.style.setProperty('--aurel-aurora-button-opacity','.24');
   lastFrame=0;
 }
 function beat(level){
   if(!enabled||!isPlaying()||!motionAllowed()||bitPerfect())return;
   const n=Number(level);
   if(!Number.isFinite(n))return;
   // Native AurelBeatEnvelope has already smoothed the real bass transient.
   const amount=Math.pow(clamp(n,0,1),.72);
   lastFrame=Date.now();
   overlay.classList.add('aurel-aurora-beat');
   overlay.style.setProperty('--aurel-aurora-pulse-opacity',(.30+.63*amount).toFixed(3));
   overlay.style.setProperty('--aurel-aurora-diffuse-opacity',(.20+.42*amount).toFixed(3));
   overlay.style.setProperty('--aurel-aurora-pulse-scale',(1+.085*amount).toFixed(4));
   overlay.style.setProperty('--aurel-aurora-button-opacity',(.24+.70*amount).toFixed(3));
 }
 function sync(){
   const visible=enabled&&!!app.overlay;
   overlay.classList.toggle('aurel-aurora-enabled',visible);
   overlay.classList.toggle('aurel-aurora-playing',visible&&isPlaying()&&motionAllowed());
   if(visible){
     addHalo();
     setPalette();
   }
   if(!visible||!isPlaying()||!motionAllowed()||bitPerfect()||
      (lastFrame&&Date.now()-lastFrame>1000))clearBeat();
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
     (uk()?'Кольори обкладинки та світіння в такт':'Artwork colors and beat-reactive glow')+
     '</strong><small>'+
     (uk()?'Гармонійна палітра з обкладинки. У звичайному аудіорежимі справжні FFT-імпульси підсилюють світіння; Android може запитати дозвіл на аналіз аудіо. У bit-perfect підсвічування статичне.':
       'Harmonized artwork colors. Real FFT transients brighten the glow on standard audio output; Android may request audio analysis permission. Glow stays static with bit-perfect.')+
     '</small></span><input type="checkbox" data-aurel-aurora-toggle '+
     'aria-label="'+(uk()?'Світіння кольорами обкладинки':'Artwork glow')+'" '+
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
   if(kind==='player'||kind==='beatStatus')sync();
   return result;
 };
 const oldPalette=window.AurelCoverPalette;
 window.AurelCoverPalette=function(url,bg,surface,accent){
   const result=typeof oldPalette==='function'?
     oldPalette.apply(this,arguments):undefined;
   if(url&&hexOK(bg)&&hexOK(surface)&&hexOK(accent)){
     const next=harmonize(bg,surface,accent);
     palettes.set(url,next);
     if(palettes.size>40)palettes.delete(palettes.keys().next().value);
     if(ownedCover(url)){
       palettes.set(currentCover(),next);
       if(enabled&&app.overlay)colors(next);
     }
   }
   return result;
 };
 if(typeof window.AurelBeatFrame==='function'){
   const oldBeat=window.AurelBeatFrame;
   window.AurelBeatFrame=function(level){
     const result=oldBeat.apply(this,arguments);
     beat(level);
     return result;
   };
 }
 document.addEventListener('change',event=>{
   if(!event.target.matches?.('[data-aurel-aurora-toggle]'))return;
   enabled=!!event.target.checked;
   try{localStorage.setItem(KEY,enabled?'on':'off');}catch(_){}
   sync();
   window.AurelCoverRhythm?.refresh?.(enabled);
 });
 document.addEventListener('visibilitychange',()=>{
   sync();
   window.AurelCoverRhythm?.refresh?.();
 });
 if(reduced?.addEventListener)reduced.addEventListener('change',sync);
 installSetting();
 clearBeat();
 sync();
 window.AurelAurora={enabled:()=>enabled,wantsBeat:()=>enabled,refresh:sync};
 window.AurelCoverRhythm?.refresh?.();
})();