/* AUREL 1.1.32 — real Android diagnostics + safe performance controls.
 * Unsupported DSP is explained, never represented by a fake enabled switch.
 */
(function installAurelProSettings(){
'use strict';
const MOTION_KEY='aurel_motion_mode_v1';
const motion=()=>{try{return localStorage.getItem(MOTION_KEY)==='off'?'off':'soft';}catch(_){return 'soft';}};
function applyMotion(mode){
 const value=mode==='off'?'off':'soft';
 document.documentElement.dataset.aurelMotion=value;
 try{localStorage.setItem(MOTION_KEY,value);}catch(_){}
}
applyMotion(motion());
const h=x=>html(x==null?'':String(x));
let lastDiagnostics=null;
let scanInFlight=null;
const bitPerfectActive=()=>!!(app.player?.bitPerfect||app.session?.bitPerfect)?.enabled;
function signalPath(){
 const p=app.player||{},bp=p.bitPerfect||app.session?.bitPerfect||{};
 const verified=p.sourceVerified&&p.bits&&p.sampleRateHz;
 const source=verified?(p.codec||'FLAC')+' · '+p.bits+'-bit / '+Math.round(p.sampleRateHz)+' Hz':
   p.streamHeaderVerified&&p.sampleRateHz?(p.codec||'Audio')+' · '+Math.round(p.sampleRateHz)+' Hz (depth unknown)':
   'Source PCM not independently verified';
 const decode=p.decoderSampleRateHz?Math.round(p.decoderSampleRateHz)+' Hz'+
   (p.decoderChannels?' / '+p.decoderChannels+' channels':''):'Android did not report decoder format';
 const routed=lastDiagnostics?.outputs?.find(d=>d.currentlyRouted);
 const output=bp.directUsbSelected?'USB UAC1/2/3 · libusbdac PCM (clock unverified)':routed?.bluetooth?'Bluetooth · '+(routed.name||routed.category||'Audio device'):
   routed?.usb?'USB · '+(routed.name||'DAC')+
     (bp.mixerPreferenceAccepted?' · mixer preference accepted':''):
   routed?(routed.name||routed.category||'Android output')+' · routed':
   bp.usbRouted?'USB routed · preference '+(bp.mixerPreferenceAccepted?'accepted':'unconfirmed'):
   'Playback output not confirmed';
 return '<div class="aurel-signal-chain" role="status">'+
   '<div><b>Source</b><strong>'+h(source)+'</strong></div>'+
   '<div><b>Stream format</b><strong>'+h(decode)+'</strong></div>'+
   '<div><b>Android / DAC</b><strong>'+h(output)+'</strong></div>'+
   '</div>';
}
function statusText(){
 const s=window.AurelPageCache?.info()||{pages:0,limit:0,hits:0,bytes:0};
 return s.pages+' / '+s.limit+' pages · '+Math.round(s.bytes/1024)+' KB · '+s.hits+' quick opens';
}
function audioPanel(){
 const s=app.session||{},locked=bitPerfectActive(),
       db=locked?0:(Number(s.digitalHeadroomDb)||0),
       preload=s.preloadNextMetadata!==false;
 const choices=[0,-3,-6,-9,-12].map(n=>'<button type="button" data-aurel-headroom="'+n+
  '" aria-pressed="'+(n===db)+'" '+(locked&&n!==0?'disabled aria-disabled="true" ':'')+
  'class="'+(n===db?'is-selected':'')+'">'+
  (n===0?'Off':n+' dB')+'</button>').join('');
 return '<section class="panel aurel-pro-settings" data-aurel-pro-settings="audio">'+
   '<h3>Audio outputs</h3>'+
   '<div class="aurel-pro-feature aurel-output-feature">'+
   '<div class="aurel-output-heading"><strong>Connected devices</strong>'+
   '<button type="button" class="aurel-pro-button" data-aurel-scan-dac>Refresh outputs</button></div>'+
   '<div class="aurel-dac-results" aria-live="polite"></div></div>'+
   '<div class="aurel-pro-feature aurel-technical-details">'+
   '<details class="aurel-pro-disclosure"><summary>Signal path</summary>'+
   signalPath()+'</details></div>'+
   '<div class="aurel-pro-feature"><strong>Digital headroom</strong>'+
   '<div class="aurel-pro-choice" role="group" aria-label="Digital headroom">'+choices+'</div>'+
   '<small class="aurel-headroom-note">'+(locked?
     'Disabled in bit-perfect: PCM amplitude must remain unchanged.':
     'Optional attenuation is applied only through standard Android audio.')+'</small></div>'+
   '<div class="aurel-pro-feature"><label class="aurel-pro-switch-label">'+
   '<span><strong>Preload next track metadata</strong></span>'+
   '<input type="checkbox" data-aurel-preload '+(preload?'checked':'')+'></label></div>'+
   '</section>';
}
function perfPanel(){
 const s=window.AurelPageCache?.info()||{enabled:false,limit:32};
 const options=[12,24,32,40].map(n=>'<option value="'+n+'" '+(s.limit===n?'selected':'')+'>'+n+' pages</option>').join('');
 const motionChoices=['soft','off'].map(n=>'<button type="button" data-aurel-motion="'+n+
  '" aria-pressed="'+(motion()===n)+'" class="'+(motion()===n?'is-selected':'')+'">'+
  (n==='soft'?'Soft':'None')+'</button>').join('');
 return '<section class="panel aurel-pro-settings" data-aurel-pro-settings="performance">'+
   '<h3>Performance &amp; motion</h3>'+
   '<div class="aurel-pro-feature"><label class="aurel-pro-switch-label">'+
   '<span><strong>Remember recently opened pages</strong>'+
   '</span>'+
   '<input type="checkbox" data-aurel-cache-enable '+(s.enabled?'checked':'')+'></label>'+
   '<div class="aurel-pro-inline"><label>Cache capacity <select data-aurel-cache-limit>'+
   options+'</select></label>'+
   '<button type="button" class="aurel-pro-button secondary" data-aurel-cache-clear>Clear cache</button></div>'+
   '<small class="aurel-pro-cache-status" role="status">'+h(statusText())+'</small></div>'+
   '<div class="aurel-pro-feature"><strong>Transitions</strong>'+
   ''+
   '<div class="aurel-pro-choice" role="group" aria-label="Transitions">'+motionChoices+'</div>'+ 
    '<small class="aurel-gesture-guide">Now Playing gestures: swipe down to minimize · right for next track · left for previous track.</small></div>'+
   ''+
   '</section>';
}
function addPanels(){
 if(app.nav!=='settings'||app.selected)return;
 const root=document.getElementById('screen');
 if(!root?.querySelector('.aurel-settings-heading')||root.querySelector('[data-aurel-pro-settings]'))return;
 const host=document.createElement('div');
 host.innerHTML=audioPanel()+perfPanel();
 const panels=Array.from(host.children);
 const anchor=root.querySelector('.aurel-bp-panel')?.closest('.panel');
 if(anchor)anchor.after(...panels);else root.append(...panels);
}
const base=renderSettings;
renderSettings=function(){
 const out=base.apply(this,arguments);
 addPanels();
 return out;
};
if(app.nav==='settings')addPanels();
function updateCache(){
 const item=document.querySelector('.aurel-pro-cache-status');
 if(item)item.textContent=statusText();
}
function renderDac(data){
 lastDiagnostics=data;
 const target=document.querySelector('.aurel-dac-results');
 if(!target)return;
 const all=Array.isArray(data?.outputs)?data.outputs:[];
 let devices=all.filter(d=>d.currentlyRouted||d.bluetooth||d.usb||
   /headphone|headset|analog/i.test(d.category||''));
 if(!devices.length)devices=all.filter(d=>d.currentlyRouted);
 devices.sort((a,b)=>Number(!!b.currentlyRouted)-Number(!!a.currentlyRouted)||
   Number(!!b.bluetooth)-Number(!!a.bluetooth));
 if(!devices.length){target.textContent='No audio outputs reported.';return;}
 target.innerHTML=devices.slice(0,10).map(d=>{
   const rates=Array.isArray(d.advertisedSampleRates)?d.advertisedSampleRates:[];
   const supported=Array.isArray(d.mixerFormats)?d.mixerFormats.filter(v=>v.bitPerfect):[];
   const status=d.currentlyRouted?'ACTIVE OUTPUT':'AVAILABLE';
   const rateText=rates.length?rates.map(n=>n>=1000?(n/1000)+' kHz':n+' Hz').join(', '):'Not reported';
   return '<div class="aurel-dac-device'+(d.currentlyRouted?' is-active':'')+'">'+
     '<strong>'+h(d.name||'Audio device')+'</strong>'+
     '<small>'+h(d.category||'Android output')+' · '+status+'</small>'+
     '<small>Android rates: '+h(rateText)+'</small>'+
     (d.usb&&supported.length?'<small>USB mixer: '+
       h(supported.slice(0,8).map(v=>v.hz+' Hz').join(', '))+'</small>':'')+
     '</div>';
 }).join('');
 const chain=document.querySelector('.aurel-signal-chain');
 if(chain)chain.outerHTML=signalPath();
}
async function scanOutputs(){
 if(scanInFlight)return scanInFlight;
 scanInFlight=(async()=>{
   const button=document.querySelector('[data-aurel-scan-dac]');
   if(button){button.disabled=true;button.textContent='Scanning…';}
   try{renderDac(await nativeCall('audioDiagnostics'));}
   catch(err){const out=document.querySelector('.aurel-dac-results');
     if(out)out.textContent='Output diagnostics unavailable: '+(err?.message||'Unknown error');}
   finally{
     const button=document.querySelector('[data-aurel-scan-dac]');
     if(button){button.disabled=false;button.textContent='Refresh outputs';}
   }
 })();
 try{return await scanInFlight;}finally{scanInFlight=null;}
}
document.addEventListener('click',async e=>{
 const b=e.target?.closest?.('[data-aurel-scan-dac],[data-aurel-headroom],[data-aurel-cache-clear],[data-aurel-motion]');
 if(!b||b.disabled)return;
 if(b.hasAttribute('data-aurel-scan-dac')){
   await scanOutputs();
 }else if(b.hasAttribute('data-aurel-headroom')){
   const db=Number(b.getAttribute('data-aurel-headroom'));
   if(bitPerfectActive()&&db!==0){
     showToast('Digital headroom is disabled in bit-perfect mode.');
     return;
   }
   if(db===Number(app.session?.digitalHeadroomDb||0))return;
   b.disabled=true;
   try{
     const sync=window.AurelPreferenceSync;
     const result=sync?await sync.change('digitalHeadroomDb',db,
       value=>nativeCall('setDigitalHeadroom',{db:value})):
       await nativeCall('setDigitalHeadroom',{db});
     if(!result?.superseded)showToast(db?'Digital headroom: '+db+' dB':'Digital headroom off');
   }catch(err){showToast(err?.message||'Cannot change digital headroom',5500);}
   finally{if(b.isConnected)b.disabled=false;}
 }else if(b.hasAttribute('data-aurel-cache-clear')){
   window.AurelPageCache?.clear();updateCache();
   showToast('Page buffer cleared');
 }else if(b.hasAttribute('data-aurel-motion')){
   const chosen=b.dataset.aurelMotion;applyMotion(chosen);
   document.querySelectorAll('[data-aurel-motion]').forEach(x=>{
     const yes=x.dataset.aurelMotion===chosen;
     x.classList.toggle('is-selected',yes);x.setAttribute('aria-pressed',String(yes));
   });
 }
},false);
document.addEventListener('change',async e=>{
 const input=e.target;
 if(input.matches?.('[data-aurel-cache-enable]')){
   window.AurelPageCache?.configure({enabled:input.checked});updateCache();
 }else if(input.matches?.('[data-aurel-cache-limit]')){
   window.AurelPageCache?.configure({limit:Number(input.value)});updateCache();
 }else if(input.matches?.('[data-aurel-preload]')){
   const value=input.checked;
   input.disabled=true;
   try{
     const sync=window.AurelPreferenceSync;
     if(sync)await sync.change('preloadNextMetadata',value,
       enabled=>nativeCall('setMetadataPreload',{enabled}));
     else {
       await nativeCall('setMetadataPreload',{enabled:value});
       app.session={...(app.session||{}),preloadNextMetadata:value};
     }
   }catch(err){showToast(err?.message||'Unable to save preload setting');}
   finally{if(input.isConnected)input.disabled=false;}
 }
},false);
window.AurelProSettings={applyMotion,signalPath,scanOutputs};
})();