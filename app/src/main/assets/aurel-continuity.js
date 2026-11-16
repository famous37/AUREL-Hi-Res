/* AUREL: remember route, entity, page scroll and player viewport (no tokens). */
(function(){
'use strict';
const KEY='aurel_view_state_v1';
const routes=['home','search','library','playlists','magazine','settings'];
const num=x=>Math.max(0,Math.min(1000000,Math.round(Number(x)||0)));
let state={nav:'home',positions:{}};
try{const old=JSON.parse(localStorage.getItem(KEY)||'null');
 if(old&&typeof old==='object')state={...state,...old,positions:old.positions&&typeof old.positions==='object'?old.positions:{}};}catch(_){}
const resume={...state};
let ready=false,shown='',pendingOverlay=!!resume.overlay,flushTimer=0,latestError='',lastErrorTime=0;
const nextFrame=f=>typeof requestAnimationFrame==='function'?requestAnimationFrame(f):setTimeout(f,0);
const key=()=>[app.nav,app.selected?.id?String(app.selectedKind||'album')+':'+String(app.selected.id):'',app.nav==='library'?app.libType:app.nav==='search'?app.searchType:''].join('|');
const scrolling=()=>document.scrollingElement||document.documentElement;
function rememberPage(){if(!shown||app.overlay)return;state.positions[shown]=num(scrolling()?.scrollTop??window.scrollY??0);}
function rememberPlayer(){
 const el=document.querySelector('#overlay .murglar-player-content');
 if(!el)return;
 state.playerTrack=String(app.player?.track?.id||'');
 state.playerScroll=num(el.scrollTop);
 const detail=document.querySelector('#overlay .aurel-detail-scroll');
 if(detail)state.detailScroll=num(detail.scrollTop);
}
function flush(){
 clearTimeout(flushTimer);flushTimer=0;
 if(!ready||!hasAuth())return;
 state.nav=routes.includes(app.nav)?app.nav:'home';
 state.libType=app.libType;
 state.searchType=app.searchType;
 state.searchQuery=String(app.searchQuery||'').slice(0,200);
 state.entity=app.selected?.id?{kind:app.selectedKind,id:String(app.selected.id)}:null;
 state.overlay=!!app.overlay;
 state.playerSheet=app.overlay?String(app.playerSheet||''):'';
 try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}
}
function soon(){clearTimeout(flushTimer);flushTimer=setTimeout(flush,150);}
function restorePage(which){
 const y=num(state.positions[which]);
 nextFrame(()=>{if(app.overlay||shown!==which)return;
  if(typeof window.scrollTo==='function')window.scrollTo(0,y);
  else if(scrolling())scrolling().scrollTop=y;});
}
function restorePlayer(){
 if(!app.overlay||String(app.player?.track?.id||'')!==String(state.playerTrack||''))return;
 nextFrame(()=>{
  if(!app.overlay||String(app.player?.track?.id||'')!==String(state.playerTrack||''))return;
  const el=document.querySelector('#overlay .murglar-player-content');
  if(el)el.scrollTop=num(state.playerScroll);
  const detail=document.querySelector('#overlay .aurel-detail-scroll');
  if(detail)detail.scrollTop=num(state.detailScroll);
 });
}
async function hydrate(){
 if(!ready||!hasAuth())return;
 const e=resume.entity;
 if(e?.id&&!app.selected&&['artist','album','playlist'].includes(e.kind)){
  try{if(e.kind==='artist')await openArtist(e.id);
   else if(e.kind==='playlist')await openPlaylist(e.id);
   else await openAlbum(e.id);}catch(_){}
 }else if(app.nav==='search'&&app.searchQuery){
  try{await search();}catch(_){}
 }else if(app.nav==='library'){
  try{await (app.libType==='playlists'?loadPlaylists():loadLibrary());}catch(_){}
 }
 restorePage(key());
}
const oldRender=render;
render=function(){
 if(!ready&&app.session&&hasAuth()){
  ready=true;
  if(routes.includes(resume.nav))app.nav=resume.nav;
  if(['playlists','albums','tracks','artists'].includes(resume.libType))app.libType=resume.libType;
  if(['tracks','albums','artists'].includes(resume.searchType))app.searchType=resume.searchType;
  app.searchQuery=String(resume.searchQuery||'').slice(0,200);
  setTimeout(hydrate,0);
 }
 rememberPage();
 const out=oldRender.apply(this,arguments);
 if(ready&&hasAuth()){shown=key();restorePage(shown);soon();}
 return out;
};
window.AurelBeforeOpenEntity=()=>{rememberPage();shown='';soon();};
const oldNavigate=navigate;
navigate=async function(){rememberPage();const result=await oldNavigate.apply(this,arguments);
 if(ready){restorePage(key());soon();}return result;};
const oldDraw=drawOverlay;
drawOverlay=function(){
 rememberPlayer();
 const out=oldDraw.apply(this,arguments);
 if(app.overlay){
  restorePlayer();
  const err=String(app.player?.error||'').trim(),now=Date.now();
  if(err&&(err!==latestError||now-lastErrorTime>120000)){latestError=err;lastErrorTime=now;showToast(err,7500);}
  if(!err)latestError='';
 }
 soon();return out;
};
const oldEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 const result=oldEvent.apply(this,arguments);
 if(kind==='player'&&pendingOverlay&&ready&&hasAuth()&&data?.track?.id){
  pendingOverlay=false;app.overlay=true;
  app.playerSheet=['audio','credits','upnext'].includes(resume.playerSheet)?resume.playerSheet:'';
  drawOverlay();
 }
 return result;
};
document.addEventListener('scroll',e=>{
 const el=e.target;
 if(el?.classList?.contains('murglar-player-content')||el?.classList?.contains('aurel-detail-scroll'))rememberPlayer();
 else if(!app.overlay&&shown&&(el===document||el===document.body||el===document.documentElement||el===scrolling()))rememberPage();
 soon();
},{capture:true,passive:true});
document.addEventListener('click',e=>{
 if(e.target?.closest?.('[data-dismiss-aurel-toast]')){
  const toast=document.getElementById('toast');
  if(toast){toast.classList.remove('aurel-toast-visible');toast.classList.add('hidden');}
 }
 rememberPage();if(app.overlay)rememberPlayer();
},true);
if(typeof window.addEventListener==='function'){
 window.addEventListener('pagehide',()=>{rememberPage();rememberPlayer();flush();});
 window.addEventListener('scroll',()=>{if(!app.overlay){rememberPage();soon();}},{passive:true});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){rememberPage();rememberPlayer();flush();}});
})();