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
function signalPath(){
 const p=app.player||{},bp=p.bitPerfect||app.session?.bitPerfect||{};
 const verified=p.sourceVerified&&p.bits&&p.sampleRateHz;
 const source=verified?(p.codec||'FLAC')+' · '+p.bits+'-bit / '+Math.round(p.sampleRateHz)+' Hz':
   p.streamHeaderVerified&&p.sampleRateHz?(p.codec||'Audio')+' · '+Math.round(p.sampleRateHz)+' Hz (depth unknown)':
   'Source PCM not independently verified';
 const decode=p.decoderSampleRateHz?Math.round(p.decoderSampleRateHz)+' Hz'+
   (p.decoderChannels?' / '+p.decoderChannels+' channels':''):'Android did not report decoder format';
 const routed=lastDiagnostics?.outputs?.find(d=>d.currentlyRouted);
 const output=routed?.bluetooth?'Bluetooth · '+(routed.name||routed.category||'Audio device')+
     ' (codec not exposed)':
   routed?.usb?'USB · '+(routed.name||'DAC')+
     (bp.mixerPreferenceAccepted?' · mixer preference accepted':''):
   routed?(routed.name||routed.category||'Android output')+' · routed':
   bp.usbRouted?'USB routed · preference '+(bp.mixerPreferenceAccepted?'accepted':'unconfirmed'):
   'Playback output not confirmed';
 return '<div class="aurel-signal-chain" role="status">'+
   '<div><b>Source</b><strong>'+h(source)+'</strong></div>'+
   '<div><b>Decoder</b><strong>'+h(decode)+'</strong></div>'+
   '<div><b>Android / DAC</b><strong>'+h(output)+'</strong></div>'+
   '<small>Catalogue quality and Android mixer properties are not evidence of physical DAC samples.</small></div>';
}
function statusText(){
 const s=window.AurelPageCache?.info()||{pages:0,limit:0,hits:0,bytes:0};
 return s.pages+' / '+s.limit+' pages · '+Math.round(s.bytes/1024)+' KB · '+s.hits+' quick opens';
}
function audioPanel(){
 const s=app.session||{},db=Number(s.digitalHeadroomDb)||0,preload=s.preloadNextMetadata!==false;
 const choices=[0,-3,-6,-9,-12].map(n=>'<button type="button" data-aurel-headroom="'+n+
  '" aria-pressed="'+(n===db)+'" class="'+(n===db?'is-selected':'')+'">'+
  (n===0?'Off':n+' dB')+'</button>').join('');
 return '<section class="panel aurel-pro-settings" data-aurel-pro-settings="audio">'+
   '<h3>Audio outputs</h3>'+
   '<p class="aurel-pro-intro">Live Android routing and reported device capabilities.</p>'+
   '<div class="aurel-pro-feature"><strong>Signal path</strong>'+
   '<small>Verified stream data versus Android routing.</small>'+
   signalPath()+'</div>'+
   '<div class="aurel-pro-feature"><strong>Connected outputs · USB &amp; Bluetooth</strong>'+
   '<small>Active route, device name and reported formats. Bluetooth codec is restricted by Android.</small>'+
   '<button type="button" class="aurel-pro-button" data-aurel-scan-dac>Refresh outputs</button>'+
   '<div class="aurel-dac-results" aria-live="polite"></div></div>'+
   '<div class="aurel-pro-feature"><strong>Digital headroom</strong>'+
   '<small>Reduces digital volume. Not ReplayGain; unavailable with USB bit-perfect.</small>'+
   '<div class="aurel-pro-choice" role="group" aria-label="Digital headroom">'+choices+'</div></div>'+
   '<div class="aurel-pro-feature"><label class="aurel-pro-switch-label">'+
   '<span><strong>Preload next track metadata</strong>'+
   '<small>Preload track details only, not audio.</small></span>'+
   '<input type="checkbox" data-aurel-preload '+(preload?'checked':'')+'></label></div>'+
   '<details class="aurel-pro-limits"><summary>Audio engine limits</summary>'+
   '<p><b>Gapless:</b> Android MediaPlayer does not guarantee sample-accurate joins.</p>'+
   '<p><b>ReplayGain:</b> Requires verified loudness tags or PCM analysis; digital headroom is not normalization.</p>'+
   '<p><b>PEQ, Crossfeed and FIR:</b> Require an integrated DSP engine; these effects are not enabled.</p>'+
   '<p><b>Network audio buffer:</b> MediaPlayer manages its own buffer and exposes no accurate buffer-size setting.</p>'+
   '</details></section>';
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
   '<small>Keep recent pages in memory. No tokens or audio URLs stored.</small></span>'+
   '<input type="checkbox" data-aurel-cache-enable '+(s.enabled?'checked':'')+'></label>'+
   '<div class="aurel-pro-inline"><label>Cache capacity <select data-aurel-cache-limit>'+
   options+'</select></label>'+
   '<button type="button" class="aurel-pro-button secondary" data-aurel-cache-clear>Clear cache</button></div>'+
   '<small class="aurel-pro-cache-status" role="status">'+h(statusText())+'</small></div>'+
   '<div class="aurel-pro-feature"><strong>Transitions</strong>'+
   '<small>Gentle page transitions, without repeated effects.</small>'+
   '<div class="aurel-pro-choice" role="group" aria-label="Transitions">'+motionChoices+'</div></div>'+
   '<p class="aurel-pro-footnote">Page memory clears when AUREL closes.</p>'+
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
 // Keep the relevant output choices visible, never dozens of unused devices.
 let devices=all.filter(d=>d.currentlyRouted||d.bluetooth||d.usb||
   /headphone|headset|analog/i.test(d.category||''));
 if(!devices.length)devices=all.filter(d=>d.currentlyRouted);
 devices.sort((a,b)=>Number(!!b.currentlyRouted)-Number(!!a.currentlyRouted)||
   Number(!!b.bluetooth)-Number(!!a.bluetooth));
 if(!devices.length){target.textContent='No audio outputs reported.';return;}
 const lines=devices.slice(0,10).map(d=>{
   const rates=Array.isArray(d.advertisedSampleRates)?d.advertisedSampleRates:[];
   const supported=Array.isArray(d.mixerFormats)?d.mixerFormats.filter(v=>v.bitPerfect):[];
   const status=d.currentlyRouted?'ACTIVE OUTPUT':'AVAILABLE · route not confirmed';
   const rateText=rates.length?rates.map(n=>n>=1000?(n/1000)+' kHz':n+' Hz').join(', '):'Not reported';
   return '<div class="aurel-dac-device'+(d.currentlyRouted?' is-active':'')+'">'+
     '<strong>'+h(d.name||'Audio device')+'</strong>'+
     '<small>'+h(d.category||'Android output')+' · '+status+'</small>'+
     '<small>Android-reported rates: '+h(rateText)+'</small>'+
     (d.bluetooth?'<small>Active Bluetooth codec / bitrate: unavailable to standard Android apps</small>':'')+
     (d.usb?'<small>USB bit-perfect mixer formats: '+(supported.length?
       h(supported.slice(0,8).map(v=>v.hz+' Hz').join(', ')):'Not exposed')+'</small>':'')+
     '</div>';
 }).join('');
 target.innerHTML=lines+
   '<small class="aurel-pro-footnote">Reported rates are not measured output rates.</small>';
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
   try{
     await nativeCall('setDigitalHeadroom',{db});
     app.session={...(app.session||{}),digitalHeadroomDb:db};
     document.querySelectorAll('[data-aurel-headroom]').forEach(x=>{
       const yes=Number(x.dataset.aurelHeadroom)===db;
       x.classList.toggle('is-selected',yes);x.setAttribute('aria-pressed',String(yes));
     });
     showToast(db?'Digital headroom: '+db+' dB':'Digital headroom off');
   }catch(err){showToast(err?.message||'Cannot change digital headroom',5500);}
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
   const value=input.checked;input.disabled=true;
   try{await nativeCall('setMetadataPreload',{enabled:value});
     app.session={...(app.session||{}),preloadNextMetadata:value};}
   catch(err){input.checked=!value;showToast(err?.message||'Unable to save preload setting');}
   finally{input.disabled=false;}
 }
},false);
window.AurelProSettings={applyMotion,signalPath,scanOutputs};
})();