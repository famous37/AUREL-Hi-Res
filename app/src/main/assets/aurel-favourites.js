/* AUREL 1.1.23 — shared Qobuz favourites with reversible, optimistic controls.
 * The native bridge owns all authenticated requests. No tokens enter this file. */
(function installAurelFavourites(){
'use strict';
const types=['tracks','albums','artists'];
const saved={tracks:new Set(),albums:new Set(),artists:new Set()};
const inFlight=new Set();
let account='',generation=0,ready=false,loading=null,lastFailure=0,lastError='';
const idOf=value=>String(value==null?'':value).trim();
function authorized(){
 const s=app.session||{};
 return !!(s.libraryConnected||(s.streamConnected&&!s.mornyeConfigured));
}
function identity(){
 const s=app.session||{},lp=s.libraryProfile||{},profile=s.profile||{};
 return [
   s.libraryConnected?'library':'stream',s.libraryAppId||s.appId||'',
   s.libraryUserId||lp.userId||s.streamUserId||profile.userId||'',
   s.mornyeConfigured?'mornye':'qobuz',s.libraryConnected?'1':'0'
 ].join('|');
}
function reset(){
 generation++;ready=false;loading=null;lastError='';lastFailure=0;
 types.forEach(type=>saved[type].clear());
}
function checkAccount(){
 const key=identity();
 if(key!==account){account=key;reset();}
}
function idsFrom(value){
 const list=Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[];
 return list.map(v=>idOf(typeof v==='object'&&v!==null?(v.id??v.item_id):v)).filter(Boolean);
}
function isSaved(type,id){return !!(saved[type]&&saved[type].has(idOf(id)));}
function local(en,uk){return window.AurelLanguage?.get?.()==='uk'?uk:en;}
function matchingControls(root=document){
 if(!root||typeof root.querySelectorAll!=='function')return [];
 const all=Array.from(root.querySelectorAll('[data-like-track],[data-like-album],[data-like-artist],[data-artist-follow],[data-mini-fav]'));
 if(root.matches?.('[data-like-track],[data-like-album],[data-like-artist],[data-artist-follow],[data-mini-fav]'))all.unshift(root);
 return all;
}
function describeControl(b){
 if(b.hasAttribute('data-artist-follow'))return ['artists',b.getAttribute('data-artist-follow')];
 if(b.hasAttribute('data-like-artist'))return ['artists',b.getAttribute('data-like-artist')];
 if(b.hasAttribute('data-like-album'))return ['albums',b.getAttribute('data-like-album')];
 if(b.hasAttribute('data-mini-fav'))return ['tracks',b.getAttribute('data-mini-fav')];
 return ['tracks',b.getAttribute('data-like-track')];
}
function updateButton(b){
 const [type,id]=describeControl(b);
 if(!id||!types.includes(type))return;
 const on=ready&&isSaved(type,id);
 const pending=inFlight.has(type+':'+id);
 b.classList.toggle('aurel-is-favourite',on);
 b.classList.toggle('aurel-favourite-pending',pending);
 b.setAttribute('aria-pressed',String(on));
 b.setAttribute('aria-label',on?local('Remove from favourites','Вилучити з вибраного'):local('Add to favourites','Додати до вибраного'));
 if(pending)b.setAttribute('aria-busy','true');else b.removeAttribute('aria-busy');
 if(b.classList.contains('aurel-artist-follow')){
   const label=b.querySelector('span');
   const next=on?local('Following','Відстежується'):local('Follow','Стежити');
   if(label&&label.textContent!==next)label.textContent=next;
   return;
 }
 if(b.classList.contains('aurel-favourite-control')){
   if(b.textContent!==(on?'♥':'♡'))b.textContent=on?'♥':'♡';
   b.setAttribute('title',on?local('Remove from favourites','Вилучити з вибраного'):local('Add to favourites','Додати до вибраного'));
   return;
 }
 if(b.hasAttribute('data-mini-fav'))return;
 if(b.classList.contains('aurel-fav-button')||b.closest('.murglar-quick-actions')){
   const label=b.querySelector('span');
   const next=on?local('Saved','Збережено'):local('Favourite','Вибране');
   if(label&&label.textContent!==next)label.textContent=next;
   return;
 }
 if(b.hasAttribute('data-like-track')&&!b.querySelector('svg')){
   if(b.textContent!==(on?'♥':'♡'))b.textContent=on?'♥':'♡';
   b.setAttribute('title',on?local('Remove from favourites','Вилучити з вибраного'):local('Add to favourites','Додати до вибраного'));
 }else if(b.hasAttribute('data-like-album')&&!b.querySelector('svg')){
   const next=on?local('♥ Saved','♥ Збережено'):local('♡ Save','♡ Зберегти');
   if(b.textContent!==next)b.textContent=next;
 }
}
function syncAll(){
 checkAccount();
 matchingControls(document).forEach(updateButton);
}
function makeHeart(type,id){
 const b=document.createElement('button');
 b.type='button';
 b.className='aurel-favourite-control';
 b.setAttribute('data-like-'+type.slice(0,-1),id);
 b.textContent='♡';
 b.setAttribute('aria-pressed','false');
 b.setAttribute('aria-label','Add to favourites');
 return b;
}
function decorate(root=document){
 if(!root?.querySelectorAll)return;
 // Plain album articles may contain a separate accessible action.
 root.querySelectorAll('.albumcard[data-open-album]').forEach(card=>{
   const cover=card.querySelector('.cover');
   if(!cover||cover.querySelector('.aurel-favourite-control'))return;
   cover.appendChild(makeHeart('albums',card.dataset.openAlbum));
 });
 // The following tiles ARE buttons. Never nest a real button inside another:
 // use a sibling favourite button inside a minimal grid/flex wrapper.
 root.querySelectorAll('.album-shelf > .shelf-card[data-open-album]').forEach(card=>{
   const shell=document.createElement('div');
   shell.className='aurel-shelf-shell';
   const id=card.dataset.openAlbum;
   card.parentNode.insertBefore(shell,card);
   shell.appendChild(card);
   shell.appendChild(makeHeart('albums',id));
 });
 root.querySelectorAll('.artistrows > .artistrow[data-open-artist]').forEach(card=>{
   const shell=document.createElement('div');
   shell.className='aurel-artist-item';
   const id=card.dataset.openArtist;
   card.parentNode.insertBefore(shell,card);
   shell.appendChild(card);
   shell.appendChild(makeHeart('artists',id));
 });
 root.querySelectorAll('.library-album-list > .library-album-row[data-open-album]').forEach(card=>{
   const shell=document.createElement('div');
   shell.className='aurel-album-row-shell';
   const id=card.dataset.openAlbum;
   card.parentNode.insertBefore(shell,card);
   shell.appendChild(card);
   shell.appendChild(makeHeart('albums',id));
 });
 matchingControls(root).forEach(updateButton);
}
async function ensureLoaded(force=false){
 checkAccount();
 if(!authorized())throw new Error('Connect a personal Qobuz library in Settings to manage favourites.');
 if(ready&&!force)return;
 if(loading)return loading;
 if(!force&&lastFailure&&Date.now()-lastFailure<4500)throw new Error(lastError||'Could not load Qobuz favourites.');
 const ticket=generation;
 const task=nativeCall('favoriteIds').then(data=>{
   if(ticket!==generation)return;
   if(!data||!types.every(t=>Array.isArray(data[t])||Array.isArray(data[t]?.items)))
     throw new Error('Qobuz did not return a complete favourites list.');
   types.forEach(type=>{
     saved[type]=new Set(idsFrom(data[type]));
   });
   ready=true;lastError='';lastFailure=0;syncAll();
 }).catch(e=>{
   if(ticket===generation){lastFailure=Date.now();lastError=e?.message||'Cannot read Qobuz favourites';}
   throw e;
 }).finally(()=>{if(ticket===generation)loading=null;});
 loading=task;
 return task;
}
function removeFromVisibleLibrary(type,id){
 if(app.nav!=='library'||app.libType!==type)return;
 const match=x=>idOf(x?.id)!==id;
 if(Array.isArray(app.libraryItems))app.libraryItems=app.libraryItems.filter(match);
 if(app.libraryCache&&app.libraryCache[type]?.items)
   app.libraryCache[type].items=app.libraryCache[type].items.filter(match);
 const root=document.getElementById('libraryContent');
 if(!root)return;
 matchingControls(root).filter(b=>{
   const [kind,otherId]=describeControl(b);
   return kind===type&&otherId===id;
 }).forEach(b=>{
   const row=b.closest('.albumcard,.aurel-shelf-shell,.aurel-album-row-shell,.track,.aurel-artist-item,.artistrow,.library-album-row');
   if(!row||row.classList.contains('aurel-fav-removing'))return;
   row.classList.add('aurel-fav-removing');
   setTimeout(()=>{
     if(row.isConnected)row.remove();
     if(root.isConnected&&!root.querySelector('.albumcard,.track,.artistrow,.aurel-artist-item,.library-album-row,.aurel-album-row-shell'))
       root.innerHTML='<div class="empty">No favourites in this category.</div>';
   },170);
 });
}
async function toggle(type,id,button){
 type=idOf(type);id=idOf(id);
 if(!types.includes(type)||!id)return false;
 const key=type+':'+id;
 if(inFlight.has(key))return false;
 checkAccount();
 inFlight.add(key);
 if(button)button.classList.add('aurel-favourite-pending');
 try{
   await ensureLoaded();
   const ticket=generation;
   if(ticket!==generation)throw new Error('Account changed; try again.');
   const wasSaved=isSaved(type,id);
   if(wasSaved)saved[type].delete(id);else saved[type].add(id);
   syncAll();
   try{
     await nativeCall(wasSaved?'favoriteRemove':'favoriteAdd',{type,id});
     if(ticket!==generation)return false;
     // The next library tab refresh should read the server, not a stale cache.
     if(app.libraryCache)delete app.libraryCache[type];
     if(wasSaved)removeFromVisibleLibrary(type,id);
     showToast(wasSaved?'Removed from favourites':'Added to favourites',3200);
     return true;
   }catch(error){
     if(ticket===generation){
       if(wasSaved)saved[type].add(id);else saved[type].delete(id);
       syncAll();
     }
     throw error;
   }
 }catch(error){
   showToast(error?.message||'Could not update favourites',6000);
   return false;
 }finally{
   inFlight.delete(key);
   syncAll();
 }
}
// This replaces the old add-only handler, including mini-player shortcuts.
like=function(type,id){return toggle(type,id);};
window.AurelFavoriteToggle=toggle;
window.AurelFavourites={
 isSaved,ensureLoaded,refresh:()=>ensureLoaded(true),toggle,
 reset:()=>{account='';reset();syncAll();}
};
document.addEventListener('click',event=>{
 const btn=event.target?.closest?.('button[data-like-artist]');
 if(!btn)return;
 event.preventDefault();event.stopImmediatePropagation();
 void toggle('artists',btn.dataset.likeArtist,btn);
},true);
let syncScheduled=false;
function schedule(){
 if(syncScheduled)return;
 syncScheduled=true;
 setTimeout(()=>{
   syncScheduled=false;
   try{
     decorate(document);
     checkAccount();
     if(authorized()&&!ready&&!loading&&(!lastFailure||Date.now()-lastFailure>12000))
       void ensureLoaded().catch(()=>{/* Do not interrupt browsing if Qobuz is unavailable. */});
   }catch(_){/* UI remains responsive even if a tile was unmounted. */}
 },0);
}
if(typeof MutationObserver==='function'){
 const observer=new MutationObserver(function(records){
   // Playback timer updates only text nodes; ignore those mutations instead
   // of rescanning every button on every second of music.
   if(records.some(change=>Array.from(change.addedNodes).some(n=>n.nodeType===1)))
     schedule();
 });
 const screen=document.getElementById('screen');
 const overlay=document.getElementById('overlay');
 if(screen)observer.observe(screen,{childList:true,subtree:true});
 if(overlay)observer.observe(overlay,{childList:true,subtree:true});
}
schedule();
})();