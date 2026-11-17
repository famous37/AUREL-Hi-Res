/* AUREL 1.1.38 — durable in-session audio preferences.
 * Android SecureStore remains authoritative across app restarts.
 * Serialize writes of each setting, then reconcile out-of-order native
 * snapshots with the user's latest choice; never recreate Settings on a tick. */
(function installAurelPreferenceSync(){
 'use strict';
 const tracked=['quality','digitalHeadroomDb','preloadNextMetadata','bitPerfect'];
 const desired=new Map(),sequences=new Map(),queued=new Map();
 const identityOf=s=>{
   if(!s)return '';
   return [s.authMode||'',s.streamUserId||'',s.libraryUserId||'',
     String(!!s.streamConnected),String(!!s.libraryConnected)].join('|');
 };
 let identity=identityOf(app.session);
 function read(s,key){
   if(key==='bitPerfect')return !!s?.bitPerfect?.enabled;
   return s?.[key];
 }
 function accountChange(next){
   const candidate=identityOf(next);
   // Session can become available after startup; treat it as initial state.
   if(!identity){identity=candidate;return;}
   if(candidate&&candidate!==identity){
     desired.clear();sequences.clear();queued.clear();
     identity=candidate;
   }
 }
 function reconcileSession(snapshot){
   if(!snapshot||typeof snapshot!=='object')return snapshot;
   accountChange(snapshot);
   const next={...snapshot};
   for(const key of tracked){
     if(!desired.has(key))continue;
     const value=desired.get(key);
     if(key==='bitPerfect'){
       next.bitPerfect={...(next.bitPerfect||{}),enabled:!!value};
     }else next[key]=value;
   }
   return next;
 }
 function applyLocal(key,value){
   const prior=app.session||{};
   if(key==='bitPerfect')
     app.session={...prior,bitPerfect:{...(prior.bitPerfect||{}),enabled:!!value}};
   else app.session={...prior,[key]:value};
   refreshControls();
 }
 function refreshControls(){
   if(app.nav!=='settings')return;
   const session=app.session||{};
   const quality=Number(session.quality);
   document.querySelectorAll('[data-quality]').forEach(b=>{
     const selected=Number(b.dataset.quality)===quality;
     if(b.classList.contains('selected')!==selected)b.classList.toggle('selected',selected);
     if(b.getAttribute('aria-pressed')!==String(selected))b.setAttribute('aria-pressed',String(selected));
   });
   const db=Number(session.digitalHeadroomDb)||0;
   document.querySelectorAll('[data-aurel-headroom]').forEach(b=>{
     const selected=Number(b.dataset.aurelHeadroom)===db;
     if(b.classList.contains('is-selected')!==selected)b.classList.toggle('is-selected',selected);
     if(b.getAttribute('aria-pressed')!==String(selected))b.setAttribute('aria-pressed',String(selected));
   });
   document.querySelectorAll('[data-aurel-preload]').forEach(el=>{
     const checked=session.preloadNextMetadata!==false;
     if(el.checked!==checked)el.checked=checked;
   });
   document.querySelectorAll('[data-bit-perfect-toggle]').forEach(b=>{
     const checked=!!session.bitPerfect?.enabled;
     if(b.classList.contains('is-on')!==checked)b.classList.toggle('is-on',checked);
     if(b.getAttribute('aria-checked')!==String(checked))b.setAttribute('aria-checked',String(checked));
   });
   // Native AudioManager may change the USB route without a user gesture.
   // Update just its status and optional explanation, not the entire panel.
   const bp=session.bitPerfect||{},status=String(bp.status||'off');
   const labels={
     off:'Standard playback',android_version:'Android 14+ required',
     no_usb:'Waiting for USB DAC',waiting_track:'Waiting for a track',
     unknown_format:'Track format unknown',unsupported_format:'PCM format unavailable',policy_unavailable:'USB driver lacks bit-perfect',policy_error:'USB mixer query failed',
     unsupported:'Not supported',rejected:'Mixer request rejected',
     requested:'USB mixer requested',usb_mixer_routed:'USB mixer routed'
   };
   const descriptions={
     off:'',android_version:'Android 14 or newer required.',
     no_usb:'Connect a compatible USB DAC.',
     waiting_track:'Play a lossless track to check USB output.',
     unknown_format:'Track audio format cannot be verified.',
     unsupported_format:'Android bit-perfect mixer does not support the track format.',
     policy_unavailable:'Android USB driver does not advertise bit-perfect.',
     policy_error:'Unable to query USB audio policy.',
     unsupported:'USB mixer controls are unavailable on this device.',
     rejected:'Android rejected the USB mixer request.',
     requested:'USB mixer preference accepted; PCM bit identity unverified.',
     usb_mixer_routed:'USB audio routed; PCM bit identity unverified.'
   };
   const localize=value=>window.AurelLanguage?.get?.()==='uk'
     ?(window.AurelLanguage.translate?.(value)||value):value;
   const statusNode=document.querySelector('.aurel-bp-status strong');
   const dot=document.querySelector('.aurel-bp-dot');
   const message=localize(labels[status]||'Checking USB output');
   if(statusNode&&statusNode.textContent!==message)statusNode.textContent=message;
   if(dot){
     dot.classList.toggle('is-routed',status==='usb_mixer_routed');
     dot.classList.toggle('is-requested',status==='requested');
   }
   const container=document.querySelector('.aurel-bp-panel');
   let detail=container?.querySelector('.aurel-bp-detail');
   const explanation=localize(['unsupported_format','policy_unavailable','policy_error'].includes(status)
     ?String(bp.detail||descriptions[status]||'')
     :(descriptions[status]??String(bp.detail||'')));
   if(detail&&!explanation){detail.remove();detail=null;}
   if(explanation&&container){
     if(!detail){
       detail=document.createElement('p');detail.className='aurel-bp-detail';
       container.appendChild(detail);
     }
     if(detail.textContent!==explanation)detail.textContent=explanation;
   }
 }
 async function change(key,value,write){
   if(!tracked.includes(key)||typeof write!=='function')throw new Error('Unsupported preference write');
   const previous=read(app.session,key),seq=(sequences.get(key)||0)+1;
   sequences.set(key,seq);
   desired.set(key,value);
   applyLocal(key,value); // immediate, stable feedback without HTML replacement
   const older=queued.get(key)||Promise.resolve();
   const next=older.catch(()=>{}).then(()=>write(value));
   queued.set(key,next);
   try{
     const result=await next;
     if(sequences.get(key)===seq){
       // Retain the confirmed value until app restart/account switch:
       // a delayed native session signal must not restore an older snapshot.
       desired.set(key,value);
       applyLocal(key,value);
     }
     return {result,superseded:sequences.get(key)!==seq};
   }catch(error){
     if(sequences.get(key)===seq){
       desired.delete(key);
       applyLocal(key,previous);
     }
     throw error;
   }finally{
     if(sequences.get(key)===seq)queued.delete(key);
   }
 }
 function reset(){
   desired.clear();queued.clear();sequences.clear();
   identity=identityOf(app.session);
 }
 window.AurelPreferenceSync={change,reconcileSession,refreshControls,reset};
})();
