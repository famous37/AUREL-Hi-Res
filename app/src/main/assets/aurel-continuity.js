/* AUREL 1.1.17: real page history, persistent location, and scroll continuity.
 * This file loads last, after the discography and player integrations.
 * Only navigation state/IDs are persisted; Qobuz credentials are never stored.
 */
(function installAurelHistory(){
'use strict';
const KEY='aurel_navigation_v2', LEGACY='aurel_view_state_v1';
const routeNames=new Set(['home','search','library','playlists','magazine','settings']);
const kinds=new Set(['album','artist','playlist']);
const clamp=n=>Math.max(0,Math.min(1000000,Math.round(Number(n)||0)));
const currentScroll=()=>document.scrollingElement||document.documentElement;
const raf=fn=>typeof requestAnimationFrame==='function'?requestAnimationFrame(fn):setTimeout(fn,0);
const cachedViews=new Map();
let saved=null;
try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){}
if(!saved||typeof saved!=='object'){
 let old=null;
 try{old=JSON.parse(localStorage.getItem(LEGACY)||'null');}catch(_){}
 saved={current:old?{nav:old.nav,kind:old.entity?.kind,id:old.entity?.id,
       libType:old.libType,searchType:old.searchType,searchQuery:old.searchQuery,
       overlay:old.overlay,playerSheet:old.playerSheet}:null,
       history:[],positions:old?.positions||{}};
}
const positions=saved.positions&&typeof saved.positions==='object'?saved.positions:{};
let history=Array.isArray(saved.history)?saved.history.slice(-20).filter(x=>x&&routeNames.has(x.nav)):[];
let boot=saved.current&&routeNames.has(saved.current.nav)?saved.current:null;
let started=false,shown='',restoring=false,renderSerial=0;
let persistTimer=0,playerScroll=clamp(saved.playerScroll),detailScroll=clamp(saved.detailScroll);
let lastPlayerTrack=String(saved.playerTrack||''),openPlayerAfterBoot=!!boot?.overlay;
let lastError='',lastErrorAt=0;
function location(){
 return {nav:routeNames.has(app.nav)?app.nav:'home',
  kind:app.selected?.id&&kinds.has(app.selectedKind)?app.selectedKind:'',
  id:app.selected?.id?String(app.selected.id):'',
  libType:app.libType||'albums',searchType:app.searchType||'tracks',
  searchQuery:String(app.searchQuery||'').slice(0,200),
  libSort:app.libSort||'recent',libLayout:app.libLayout||'grid',
  discoverTab:app.discoverTab||'new'};
}
function locKey(view){
 return [view.nav,view.kind&&view.id?view.kind+':'+view.id:'',
    view.nav==='library'?view.libType:view.nav==='search'?view.searchType:''].join('|');
}
function key(){return locKey(location());}
function busy(){return !!(app.libraryLoading||app.playlistsLoading||app.searchBusy);}
function readY(){return clamp(currentScroll()?.scrollTop??window.scrollY??0);}
function remember(){
 if(!shown||app.overlay||restoring||busy())return;
 positions[shown]=readY();
}
function rememberPlayer(){
 const view=document.querySelector('#overlay .murglar-player-content');
 if(!view)return;
 lastPlayerTrack=String(document.getElementById('overlay')?.dataset?.openTrack||app.player?.track?.id||'');
 playerScroll=clamp(view.scrollTop);
 const detail=document.querySelector('#overlay .aurel-detail-scroll');
 if(detail)detailScroll=clamp(detail.scrollTop);
}
function rememberData(view){
 if(!view.kind||!view.id||!app.selected)return;
 cachedViews.set(locKey(view),{selected:app.selected,selectedTracks:app.selectedTracks,
    selectedKind:app.selectedKind});
 if(cachedViews.size>24)cachedViews.delete(cachedViews.keys().next().value);
}
function snapshot(){
 const view=location();view.y=clamp(positions[locKey(view)]??readY());
 return view;
}
function saveCurrent(){
 if(!started||!hasAuth())return;
 const view=location();
 saved={current:{...view,overlay:!!app.overlay,playerSheet:app.overlay?(app.playerSheet||''):''},
  history:history.slice(-20),positions,playerTrack:lastPlayerTrack,
  playerScroll,detailScroll};
 try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(_){}
}
function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(saveCurrent,180);}
function push(){
 if(restoring||!started||!hasAuth())return;
 remember();
 const old=snapshot();rememberData(old);
 const previous=history[history.length-1];
 if(!previous||locKey(previous)!==locKey(old))
  history.push(old);
 if(history.length>20)history.shift();
 shown='';persist();
}
function restoreY(view){
 const wanted=clamp(view.y??positions[locKey(view)]??0);
 const dest=locKey(view);
 const set=()=>{
  if(app.overlay||shown!==dest)return;
  if(typeof window.scrollTo==='function')window.scrollTo(0,wanted);
  else if(currentScroll())currentScroll().scrollTop=wanted;
 };
 raf(set);raf(()=>raf(set)); // after native WebView has measured the newly drawn list
}
function restorePlayer(){
 if(!app.overlay||String(app.player?.track?.id||'')!==lastPlayerTrack)return;
 raf(()=>{
  if(!app.overlay||String(app.player?.track?.id||'')!==lastPlayerTrack)return;
  const p=document.querySelector('#overlay .murglar-player-content');
  if(p)p.scrollTop=playerScroll;
  const d=document.querySelector('#overlay .aurel-detail-scroll');
  if(d)d.scrollTop=detailScroll;
 });
}
async function restore(view){
 if(!view||!routeNames.has(view.nav))return;
 const serial=++renderSerial;
 restoring=true;
 try{
  app.overlay=false;app.playerSheet='';
  app.nav=view.nav;
  app.libType=view.libType||'albums';app.searchType=view.searchType||'tracks';
  app.searchQuery=String(view.searchQuery||'').slice(0,200);
  app.libSort=view.libSort||'recent';app.libLayout=view.libLayout||'grid';
  app.discoverTab=view.discoverTab||'new';
  app.selected=null;app.selectedKind='';app.selectedTracks=[];
  shown='';
  const stored=cachedViews.get(locKey(view));
  if(view.kind&&view.id&&kinds.has(view.kind)){
    if(stored){
      app.selected=stored.selected;app.selectedKind=stored.selectedKind;
      app.selectedTracks=stored.selectedTracks||[];
    }else{
      // Read-only catalogue lookup only when recovering across process restart.
      let d=null;
      try{
        d=await api(view.kind==='artist'?'artist':view.kind==='playlist'?'playlist':'album',{id:view.id},true);
      }catch(_){}
      if(serial!==renderSerial)return;
      if(d?.id){
        app.selected=d;app.selectedKind=view.kind;
        app.selectedTracks=view.kind==='artist'?[]:withAlbum(sliceItems(d,'tracks'),d);
        rememberData(location());
      }
    }
  }
  if(serial!==renderSerial)return;
  render();
  if(!app.selected&&app.nav==='library'){
    // Use the already-loaded collection immediately after Back.
    const cache=app.libraryCache?.[app.libType];
    if(cache){app.libraryItems=cache.items;render();}
    else await (app.libType==='playlists'?loadPlaylists():loadLibrary());
  }else if(!app.selected&&app.nav==='search'&&app.searchQuery&&!app.results?.length){
    await search();
  }else if(!app.selected&&app.nav==='home'&&!app.albums?.length){
    await loadHome();
  }
  if(serial!==renderSerial)return;
  if(view.kind==='artist'&&view.id&&!stored)window.AurelEnsureArtistExtras?.(view.id);
  shown=key();restoreY(view);
 }finally{
  if(serial===renderSerial){restoring=false;persist();}
 }
}
async function back(){
 if(app.overlay&&app.playerSheet){
  app.playerSheet='';drawOverlay();persist();return;
 }
 if(app.overlay){
  rememberPlayer();app.overlay=false;app.playerSheet='';
  drawOverlay();persist();return;
 }
 if(restoring)return;
 remember();
 if(history.length){
  const destination=history.pop();
  await restore(destination);
  return;
 }
 // Do not silently jump to Discover if there is no prior page.
 if(app.selected){app.selected=null;app.selectedKind='';app.selectedTracks=[];shown='';render();restoreY(location());persist();}
}
window.AurelBack=()=>{void back();};
window.AurelHistoryBack=()=>{void back();};
window.AurelBeforeOpenEntity=()=>{remember();shown='';persist();};
function wrapOpen(name){
 const original=({artist:openArtist,album:openAlbum,playlist:openPlaylist})[name];
 return async function(id){
  if(!id)return;
  if(!restoring&&String(app.selected?.id||'')===String(id)&&app.selectedKind===name)return;
  const prior=snapshot();
  push();
  const expectedKey=locKey({nav:app.nav,kind:name,id:String(id),
      libType:app.libType,searchType:app.searchType});
  positions[expectedKey]=0;
  try{await original.apply(this,arguments);}catch(e){if(!restoring)showToast(e?.message||'Unable to open page');}
  if(!app.selected||app.selectedKind!==name||String(app.selected.id)!==String(id)){
    // The underlying API catches many failures itself; recover the page
    // rather than erasing the artist/library context on network errors.
    if(history.length&&locKey(history[history.length-1])===locKey(prior))
      history.pop();
    await restore(prior);
    return;
  }
  shown=expectedKey;positions[expectedKey]=0;
  persist();
 };
}
openArtist=wrapOpen('artist');
openAlbum=wrapOpen('album');
openPlaylist=wrapOpen('playlist');
const oldNavigate=navigate;
navigate=async function(page){
 if(restoring){renderSerial++;restoring=false;}
 if(page!==app.nav||app.selected)push();
 const result=await oldNavigate.apply(this,arguments);
 if(!restoring){shown=key();restoreY(location());persist();}
 return result;
};
const oldRender=render;
render=function(){
 if(!started&&app.session&&hasAuth()){
  started=true;
  if(boot){
   app.nav=boot.nav;
   app.libType=boot.libType||app.libType;
   app.searchType=boot.searchType||app.searchType;
   app.searchQuery=String(boot.searchQuery||'').slice(0,200);
   app.libSort=boot.libSort||app.libSort;
   app.libLayout=boot.libLayout||app.libLayout;
   app.discoverTab=boot.discoverTab||app.discoverTab;
  }
 }
 if(started)remember();
 const before=shown;
 const out=oldRender.apply(this,arguments);
 if(started){
  shown=key();
  // Restore scroll only on a genuine route change. Re-rendering metadata or
  // favourites on the same page must never reset scroll on the next two frames.
  if(before!==shown||!before)restoreY(location());
  persist();
  if(boot){
   const initial=boot;boot=null;
   if(initial.kind&&initial.id)setTimeout(()=>void restore(initial),0);
   else if(initial.nav==='library')setTimeout(()=>void restore(initial),0);
   else if(initial.nav==='search'&&initial.searchQuery)setTimeout(()=>void restore(initial),0);
  }
 }
 return out;
};
const oldDraw=drawOverlay;
drawOverlay=function(){
 rememberPlayer();
 const out=oldDraw.apply(this,arguments);
 if(app.overlay){
  restorePlayer();
  const message=String(app.player?.error||'').trim(),now=Date.now();
  if(message&&(message!==lastError||now-lastErrorAt>120000)){
   lastError=message;lastErrorAt=now;showToast(message,7500);
  }
  if(!message)lastError='';
 }
 persist();return out;
};
const oldEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 const result=oldEvent.apply(this,arguments);
 if(kind==='player'&&openPlayerAfterBoot&&started&&hasAuth()&&data?.track?.id){
  openPlayerAfterBoot=false;
  app.overlay=true;
  app.playerSheet=['audio','credits','upnext'].includes(saved.current?.playerSheet)?saved.current.playerSheet:'';
  drawOverlay();
 }
 return result;
};
// Capture explicit Back buttons before the legacy click handler clears
// app.selected and discards the artist → album chain.
document.addEventListener('click',e=>{
 const backButton=e.target?.closest?.('[data-back]');
 if(backButton){
  e.preventDefault();e.stopImmediatePropagation();void back();return;
 }
 if(e.target?.closest?.('[data-dismiss-aurel-toast]')){
  const toast=document.getElementById('toast');
  if(toast){toast.classList.remove('aurel-toast-visible');toast.classList.add('hidden');}
 }
 remember();if(app.overlay)rememberPlayer();
},true);
document.addEventListener('scroll',e=>{
 const el=e.target;
 if(el?.classList?.contains('murglar-player-content')||
    el?.classList?.contains('aurel-detail-scroll'))rememberPlayer();
 else if(!app.overlay&&!busy()&&shown&&
   (el===document||el===document.body||el===document.documentElement||el===currentScroll()))remember();
 persist();
},{capture:true,passive:true});
if(typeof window.addEventListener==='function'){
 window.addEventListener('pagehide',()=>{remember();rememberPlayer();saveCurrent();});
 window.addEventListener('scroll',()=>{remember();persist();},{passive:true});
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){remember();rememberPlayer();saveCurrent();}
});
})();