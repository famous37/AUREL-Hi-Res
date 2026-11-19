/* AUREL 1.1.32 — bounded, account-isolated page metadata buffer.
 *
 * Only catalogue responses are retained, IN MEMORY, never passwords, tokens,
 * audio URLs, playback grants, signed streams or favourite mutations.
 * Fresh hits reopen instantaneously. Expired hits fall back only if the live
 * request fails, and background refresh never re-renders the active page.
 */
(function installAurelPageBuffer(){
 'use strict';
 if(window.AurelPageCache?.installed)return;
 const PREF='aurel_page_buffer_pref_v1';
 const DEFAULT={enabled:true,limit:32};
 const LIMITS=[12,24,32,40];
 const BYTES_MAX=6*1024*1024;
 const policies={
   discover:5*60*1000,
   search:8*60*1000,
   artist:20*60*1000,
   album:20*60*1000,
   artistAlbums:10*60*1000,
   artistReleaseType:10*60*1000,
   playlist:3*60*1000
 };
 let settings={...DEFAULT},owner='',bytes=0,hits=0,misses=0,
     staleFallbacks=0,reads=0;
 const entries=new Map();
 const pending=new Set();
 // Coalesce concurrent reads for the same account/key; never share playback URLs.
 const inflight=new Map();
 let cacheGeneration=0;
 try{
   const stored=JSON.parse(localStorage.getItem(PREF)||'null');
   if(stored&&typeof stored==='object'){
     settings.enabled=stored.enabled!==false;
     settings.limit=LIMITS.includes(stored.limit)?stored.limit:DEFAULT.limit;
   }
 }catch(_){}
 const permitted=action=>Object.prototype.hasOwnProperty.call(policies,action);
 const cloned=value=>JSON.parse(JSON.stringify(value));
 const account=()=>{
   const s=app.session||{},lp=s.libraryProfile||{},p=s.profile||{};
   return [
     s.libraryConnected?'library':'stream',
     String(s.libraryUserId||lp.userId||s.streamUserId||p.userId||''),
     String(s.libraryAppId||s.appId||''),
     s.mornyeConnected?'gateway':'qobuz',
     s.libraryConnected?'1':'0'
   ].join('|');
 };
 function persist(){
   try{localStorage.setItem(PREF,JSON.stringify(settings));}catch(_){}
 }
 function reset(){
   // In-flight responses from previous sessions or a cleared cache may still
   // finish, but they must not repopulate the new account's metadata.
   cacheGeneration++;
   entries.clear();pending.clear();inflight.clear();bytes=0;
 }
 function ensureAccount(){
   const current=account();
   if(current!==owner){reset();owner=current;}
 }
 function keyFor(action,params){
   if(!permitted(action))return '';
   let object={};
   if(action==='search'){
     object={
       query:String(params?.query||'').trim().toLocaleLowerCase().slice(0,200),
       type:String(params?.type||'tracks')
     };
     if(!object.query)return '';
   }else if(action==='discover'){object={};}
   else{
     const id=String(params?.id||'').trim();
     if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return '';
     object={id};
     if(params?.offset!=null)object.offset=Math.max(0,Math.trunc(Number(params.offset)||0));
     if(params?.limit!=null)object.limit=Math.min(200,Math.max(1,Math.trunc(Number(params.limit)||1)));
     if(params?.releaseType)object.releaseType=String(params.releaseType);
   }
   return action+':'+JSON.stringify(object);
 }
 function evict(){
   while(entries.size>settings.limit||bytes>BYTES_MAX){
     const oldest=entries.keys().next().value;
     if(oldest==null)break;
     const item=entries.get(oldest);
     bytes-=item?.size||0;entries.delete(oldest);
   }
 }
 function save(key,action,result){
   if(!settings.enabled||!key||result==null)return;
   try{
     const serial=JSON.stringify(result);
     if(!serial||serial.length>1100000||/user_auth_token|streaming_url|signed_url/i.test(serial))return;
     const size=serial.length*2;
     if(size>BYTES_MAX)return;
     const existing=entries.get(key);
     if(existing)bytes-=existing.size;
     entries.delete(key);
     entries.set(key,{serialized:serial,size,created:Date.now(),ttl:policies[action]});
     bytes+=size;evict();
   }catch(_){}
 }
 function find(action,params,allowStale=false){
   ensureAccount();
   const key=keyFor(action,params);
   const item=entries.get(key);
   if(!settings.enabled||!item)return null;
   const age=Math.max(0,Date.now()-item.created);
   if(!allowStale&&age>item.ttl)return null;
   if(age>24*60*60*1000)return null;
   // Touch entry to give it most-recently-used priority.
   entries.delete(key);entries.set(key,item);
   try{return {value:JSON.parse(item.serialized),age,ttl:item.ttl,key};}
   catch(_){bytes-=item.size;entries.delete(key);return null;}
 }
 function preview(action,params){
   const x=find(action,params,false);
   return x?x.value:null;
 }
 function config(newSettings){
   if(!newSettings||typeof newSettings!=='object')return info();
   if(Object.prototype.hasOwnProperty.call(newSettings,'enabled')){
     settings.enabled=!!newSettings.enabled;
     if(!settings.enabled)reset();
   }
   if(LIMITS.includes(Number(newSettings.limit)))settings.limit=Number(newSettings.limit);
   evict();persist();return info();
 }
 function info(){
   ensureAccount();
   return {installed:true,enabled:settings.enabled,limit:settings.limit,
     pages:entries.size,bytes,hits,misses,staleFallbacks,inFlight:inflight.size,
     persistedPages:false,ttlMinutes:20};
 }
 function refresh(action,params,key,fetcher){
   if(pending.has(key)||document.hidden)return;
   pending.add(key);
   const generation=cacheGeneration;
   // No UI reload, route mutation or scroll restoration on background updates.
   Promise.resolve().then(()=>fetcher(action,params,true))
     .then(data=>{if(owner===account()&&generation===cacheGeneration&&settings.enabled)save(key,action,data);})
     .catch(()=>{}).finally(()=>pending.delete(key));
 }
 const originalApi=api;
 api=async function(action,params={},quiet=false){
   if(!permitted(action)||!settings.enabled||!hasAuth())
     return originalApi.apply(this,arguments);
   ensureAccount();
   const k=keyFor(action,params);
   if(!k)return originalApi.apply(this,arguments);
   const item=find(action,params,false);
   if(item){
     hits++;
     if(item.age>item.ttl*.65)refresh(action,params,k,originalApi);
     return item.value;
   }
   // A renderer, background preload and route restoration may request the
   // same metadata simultaneously. Only one native/network query is needed.
   const shared=inflight.get(k);
   if(shared){
     const data=await shared;
     return data==null?data:cloned(data);
   }
   misses++;reads++;
   const stale=find(action,params,true);
   const expectedOwner=owner,expectedGeneration=cacheGeneration;
   const request=(async()=>{
     try{
       const data=await originalApi.call(this,action,params,quiet);
       if(owner===expectedOwner&&account()===expectedOwner&&
          expectedGeneration===cacheGeneration&&settings.enabled)save(k,action,data);
       return data;
     }catch(error){
       if(stale&&owner===expectedOwner&&account()===expectedOwner&&
          expectedGeneration===cacheGeneration&&settings.enabled){
         staleFallbacks++;
         return stale.value;
       }
       throw error;
     }
   })();
   inflight.set(k,request);
   try{
     const data=await request;
     return data==null?data:cloned(data);
   }finally{
     if(inflight.get(k)===request)inflight.delete(k);
   }
 };
 window.AurelPageCache={
   installed:true,peek:preview,info,configure:config,clear(){reset();return info();},
   invalidate(action,id){
     ensureAccount();
     // Previously queued requests must not revive invalidated catalogue data.
     cacheGeneration++;
     inflight.clear();pending.clear();
     for(const k of [...entries.keys()]){
       if(!action||k.startsWith(action+':')&&(!id||k.includes('"id":"'+String(id)+'"'))){
         bytes-=entries.get(k).size;entries.delete(k);
       }
     }
     return info();
   }
 };
})();