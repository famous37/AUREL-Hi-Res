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
 const same=(a,b)=>a===b;
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
