/* AUREL v1.1.88 — open screenshot-derived local music entries online.
 * Uses only an existing, authorized Qobuz catalogue search session.
 * A unique exact match opens automatically; ambiguous matches require choice.
 * Verified IDs persist in the AtomicFile-backed local library, not in tokens.
 */
(function installOnlineLibraryResolver(){
'use strict';
const TYPES=new Set(['artists','albums','tracks','playlists']);
const isOffline=id=>/^local_[0-9a-f]{32}$/.test(String(id||''));
const providerId=(id,type)=>{
 const value=String(id??'');
 return type==='albums'?/^[a-zA-Z0-9_-]{1,96}$/.test(value)&&!isOffline(value):
   /^[0-9]{1,24}$/.test(value);
};
const isUk=()=>window.AurelLanguage?.get?.()==='uk';
const tr=(en,ua)=>isUk()?ua:en;
const esc=s=>html(String(s==null?'':s));
function fold(s){
 return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase();
}
function name(item,type){
 return String(type==='artists'||type==='playlists'?
   (item.name||item.title||''):(item.title||item.name||'')).trim();
}
function artistName(item){
 const ar=item?.artist||item?.performer||item?.album?.artist||item?.main_artist;
 if(typeof ar==='string')return ar.trim();
 return String(ar?.name||item?.artist_name||'').trim();
}
function sameArtist(left,right){
 return !left||fold(left)==='provider'||fold(left)===fold(right);
}
function exact(item,candidate,type){
 if(fold(name(item,type))!==fold(name(candidate,type)))return false;
 if((type==='albums'||type==='tracks')&&item.artist)
  return sameArtist(item.artist,artistName(candidate));
 return true;
}
let current=null,requestId=0;
function modal(){
 let node=document.getElementById('aurel-online-resolver');
 if(!node){
  node=document.createElement('section');
  node.id='aurel-online-resolver';
  node.className='aurel-online-resolver';
  node.setAttribute('role','dialog');
  node.setAttribute('aria-modal','true');
  node.setAttribute('aria-label','Qobuz catalogue match');
  document.body.appendChild(node);
 }
 return node;
}
function close(){
 ++requestId;current=null;
 const node=document.getElementById('aurel-online-resolver');
 if(node)node.remove();
}
function actions(){
 return '<button type="button" data-online-action="close">'+
  esc(tr('Close','Закрити'))+'</button>';
}
function render(){
 if(!current)return;
 const entry=current;
 const node=modal();
 const secondary=entry.item.artist&&fold(entry.item.artist)!=='provider'?
   ' · '+entry.item.artist:'';
 const results=entry.candidates||[];
 node.innerHTML='<div class="aurel-online-mask" data-online-action="close"></div>'+
  '<div class="aurel-online-sheet"><div class="aurel-online-header">'+
   '<div><div class="aurel-online-kicker">QOBUZ / '+esc(entry.type.toUpperCase())+'</div>'+
   '<h3>'+esc(tr('Open online','Відкрити онлайн'))+'</h3>'+
   '<p>'+esc(name(entry.item,entry.type)+secondary)+'</p></div>'+actions()+'</div>'+
   '<p class="aurel-online-subtitle">'+esc(tr(
     'AUREL searches the authorized Qobuz catalogue. Exact unique matches open automatically; choose if there are several.',
     'AUREL шукає в авторизованому каталозі Qobuz. Єдиний точний збіг відкривається автоматично; якщо варіантів кілька — обери правильний.'))+'</p>'+
   '<form id="aurel-online-search-form"><input id="aurel-online-query" type="search" maxlength="180" autocomplete="off" value="'+
     esc(entry.query)+'" aria-label="'+esc(tr('Qobuz search query','Пошуковий запит Qobuz'))+'">'+
     '<button type="submit">'+esc(tr('Search','Знайти'))+'</button></form>'+
   (entry.busy?'<div class="aurel-online-loading" role="status">'+
     esc(tr('Searching authorized Qobuz catalogue…','Пошук в авторизованому каталозі Qobuz…'))+'</div>':'')+
   (entry.error?'<p class="aurel-online-error" role="alert">'+esc(entry.error)+'</p>':'')+
   (!entry.busy?'<div class="aurel-online-results" role="list">'+
     (results.length?results.map((row,index)=>{
       let title=name(row,entry.type)||tr('Unnamed entry','Запис без назви');
       let artist=(entry.type==='albums'||entry.type==='tracks')?artistName(row):'';
       let detail=artist?artist:'Qobuz '+entry.type.slice(0,-1);
       const year=row.release_date_original||row.release_date_stream||row.release_date||'';
       if(year&&entry.type==='albums')detail+=' · '+String(year).slice(0,4);
       return '<button type="button" class="aurel-online-choice" data-online-choice="'+index+
         '" role="listitem"><strong>'+esc(title)+'</strong><small>'+esc(detail)+'</small>'+
         '<span aria-hidden="true">›</span></button>';
     }).join(''):'<p class="aurel-online-empty">'+esc(tr(
       'No matching catalogue entries. Try another spelling or a shorter search.',
       'Збігів у каталозі немає. Спробуй інше написання або коротший запит.'))+'</p>')+
     '</div>':'')+
   '<div class="aurel-online-footer">'+
    (entry.item.linkedId?'<button type="button" data-online-action="forget">'+
      esc(tr('Forget saved match','Скинути збережений збіг'))+'</button>':'')+
     '<button type="button" data-online-action="normal-search">'+
      esc(tr('Search in AUREL','Пошук в AUREL'))+'</button>'+
   '</div></div>';
}
function queryFor(item,type){
 // Album and track names search best by title. Artist metadata is used
 // when checking candidates rather than appended to the text query.
 return name(item,type).slice(0,180);
}
function candidatesFrom(response,type){
 const list=sliceItems(response,type);
 const seen=new Set();
 return list.filter(row=>{
  const id=String(row?.id||'');
  if(!providerId(id,type)||seen.has(id))return false;
  seen.add(id);return true;
 }).slice(0,35);
}
async function onlineTrack(item,providerIdValue,preferred){
 // The player requires real provider track metadata, not screenshot titles.
 let row=preferred&&String(preferred.id)===String(providerIdValue)?preferred:null;
 if(!row){
  const result=await api('search',{type:'tracks',query:queryFor(item,'tracks')},true);
  row=candidatesFrom(result,'tracks').find(x=>String(x.id)===String(providerIdValue));
 }
 if(!row){
  showToast(tr('Track unavailable in the current Qobuz search. Search again to choose another.',
   'Трек недоступний у поточному пошуку Qobuz. Повтори пошук і обери інший.'),7000);
  return;
 }
 await playFromTracks([row],0);
}
async function openOnline(item,type,providerIdValue,candidate){
 if(type==='artists'){
  await openArtist(String(providerIdValue));
  if(!app.selected||String(app.selected.id)!==String(providerIdValue))
   showToast(tr('Qobuz did not return this artist page.',
     'Qobuz не повернув сторінку цього виконавця.'),6500);
  return;
 }
 if(type==='albums'){
  await openAlbum(String(providerIdValue));
  if(!app.selected||String(app.selected.id)!==String(providerIdValue))
   showToast(tr('Qobuz did not return this album page.',
     'Qobuz не повернув сторінку цього альбому.'),6500);
  return;
 }
 if(type==='playlists'){
  await openPlaylist(String(providerIdValue));
  if(!app.selected||String(app.selected.id)!==String(providerIdValue))
   showToast(tr('Qobuz did not allow this playlist to open.',
     'Qobuz не дозволив відкрити цей плейлист.'),6000);
  return;
 }
 if(type==='tracks')return onlineTrack(item,providerIdValue,candidate);
}
async function pick(row){
 const entry=current;if(!entry||entry.saving)return;
 if(!providerId(row?.id,entry.type))return;
 const ticket=requestId;
 entry.saving=true;entry.busy=true;
 entry.error='';render();
 try{
  // No favourites/remote playlists are modified. Only an offline->Qobuz
  // identity mapping is written transactionally to the private JSON file.
  await nativeCall('libraryTransferLink',{
   type:entry.type,localId:entry.item.id,providerId:String(row.id)
  });
  if(ticket!==requestId)return;
  const item={...entry.item,linkedId:String(row.id)};
  const type=entry.type;
  close();
  void window.AurelLibraryTransfer?.onLinked?.();
  try{await openOnline(item,type,String(row.id),row);}
  catch(error){
   showToast(tr('Qobuz did not open this catalogue entry: ',
     'Не вдалося відкрити запис Qobuz: ')+
     String(error?.message||'Unavailable').slice(0,150),7000);
  }
 }catch(error){
  if(ticket!==requestId)return;
  entry.saving=false;entry.busy=false;
  entry.error=String(error?.message||'Could not save verified Qobuz ID').slice(0,220);
  render();
 }
}
async function find(ticket){
 const entry=current;if(!entry||ticket!==requestId)return;
 entry.busy=true;entry.error='';entry.candidates=[];render();
 try{
  const response=await api('search',{type:entry.type,query:entry.query},true);
  if(ticket!==requestId||!current)return;
  entry.candidates=candidatesFrom(response,entry.type);
  const verified=entry.candidates.filter(row=>exact(entry.item,row,entry.type));
  if(!entry.forceChoice&&verified.length===1){
   // Never silently select fuzzy or same-title-but-different-artist results.
   // A unique exact match may be safely opened on first tap.
   await pick(verified[0]);return;
  }
  entry.busy=false;render();
 }catch(error){
  if(ticket!==requestId||!current)return;
  entry.busy=false;entry.error=tr(
   'Qobuz search unavailable: ','Пошук Qobuz недоступний: ')+
   String(error?.message||'Network or authorization error').slice(0,180);
  render();
 }
}
async function open(item,type,forceChoice=false){
 if(!TYPES.has(type)||!item||!isOffline(item.id))return;
 if(item.linkedId&&!forceChoice&&providerId(item.linkedId,type)){
  try{return await openOnline(item,type,String(item.linkedId));}
  catch(error){
   showToast(tr('Unable to open Qobuz: ','Не вдалося відкрити Qobuz: ')+
    String(error?.message||'Unavailable').slice(0,170),6500);
   return;
  }
 }
 const query=queryFor(item,type);
 if(!query){
  showToast(tr('This entry has no searchable name','Запис не має назви для пошуку'));return;
 }
 current={item,type,query,candidates:[],busy:true,error:'',saving:false,
  forceChoice:!!forceChoice};
 const ticket=++requestId;
 render();
 await find(ticket);
}
document.addEventListener('click',async event=>{
 const target=event.target?.closest?.(
  '#aurel-online-resolver [data-online-action], #aurel-online-resolver [data-online-choice]');
 if(!target)return;
 event.preventDefault();event.stopImmediatePropagation();
 const action=target.getAttribute('data-online-action');
 if(action==='close'){close();return;}
 const entry=current;if(!entry)return;
 if(action==='forget'){
  try{
   await nativeCall('libraryTransferLink',{
    type:entry.type,localId:entry.item.id,providerId:''
   });
   entry.item.linkedId='';
   void window.AurelLibraryTransfer?.onLinked?.();
   entry.forceChoice=true;render();
  }catch(e){entry.error=String(e?.message||e);render();}
  return;
 }
 if(action==='normal-search'){
  const query=entry.query,type=entry.type;
  close();
  if(type==='playlists'){
   showToast(tr('Qobuz playlist search must be available in this account.',
     'Для пошуку плейлистів потрібен дозвіл Qobuz.'),5000);return;
  }
  await navigate('search');
  app.searchType=type;app.searchQuery=query;renderSearch();
  await search();
  return;
 }
 const choice=target.getAttribute('data-online-choice');
 if(choice!=null){
  const index=Number(choice);
  if(!Number.isSafeInteger(index)||index<0||index>=entry.candidates.length)return;
  await pick(entry.candidates[index]);
 }
},true);
document.addEventListener('submit',event=>{
 if(event.target?.id!=='aurel-online-search-form')return;
 event.preventDefault();event.stopImmediatePropagation();
 if(!current)return;
 const text=document.getElementById('aurel-online-query')?.value?.trim()||'';
 if(!text)return;
 current.query=text.slice(0,180);
 current.forceChoice=false;
 const ticket=++requestId;
 void find(ticket);
},true);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&current){event.preventDefault();close();}
},true);
window.AurelOnlineLibraryResolver={open,close,
 matchExact:exact,validProviderId:providerId};
})();
