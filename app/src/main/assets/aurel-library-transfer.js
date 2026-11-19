/* AUREL Library Import / Export Manager
 * All remote reads stay in the authorised native Qobuz bridge.
 * The local library is offline metadata, not another streaming account.
 */
(function installAurelLibraryTransfer(){
'use strict';
const TYPES=['artists','albums','tracks','playlists'];
const LABELS={
 artists:['Artists','Виконавці'],albums:['Albums','Альбоми'],
 tracks:['Tracks','Треки'],playlists:['Playlists','Плейлисти']
};
let lastLibraryConnection=null;
const state={
 status:{busy:false,stage:'idle',message:'',done:0,total:0,
  counts:{artists:0,albums:0,tracks:0,playlists:0}},
 opened:false,active:'albums',selected:new Set(TYPES),
 offset:0,total:0,items:[],loading:false,playlist:null,
 pending:'',serial:0
};
const uk=()=>window.AurelLanguage?.get?.()==='uk';
const tr=(en,ua)=>uk()?ua:en;
const label=type=>LABELS[type]?.[uk()?1:0]||type;
const isLocalId=id=>/^local_[0-9a-f]{32}$/.test(String(id||''));
const localNotice=()=>tr(
 'Imported from a screenshot · not linked to Qobuz',
 'Імпортовано зі скриншота · не прив’язано до Qobuz'
);
const esc=value=>html(String(value==null?'':value));
function counts(){return state.status.counts||{};}
function root(){return document.getElementById('screen');}
function mount(){
 if(!['settings','library'].includes(app.nav)||app.selected)return;
 const host=root();if(!host||host.querySelector('#aurel-library-transfer'))return;
 if(app.nav==='settings'&&!host.querySelector('.aurel-settings-heading'))return;
 const node=document.createElement('section');
 node.id='aurel-library-transfer';
 node.className='panel aurel-ltm';
 if(app.nav==='library'){
  const anchor=host.querySelector('.collection-note');
  if(anchor)anchor.after(node);else host.prepend(node);
 }else{
  const anchor=host.querySelector('[data-aurel-stage2-settings]');
  if(anchor)anchor.before(node);else host.appendChild(node);
 }
 draw();
}
function summary(){
 return TYPES.map(t=>'<span class="aurel-ltm-total"><strong>'+
   (Number(counts()[t])||0)+'</strong> '+esc(label(t))+'</span>').join('');
}
function button(action,caption,disabled=false,extra=''){
 return '<button type="button" data-ltm-action="'+esc(action)+'" '+extra+
  (disabled?' disabled':'')+'>'+esc(caption)+'</button>';
}
function contentRows(){
 if(state.loading)return '<p class="aurel-ltm-empty">'+
  esc(tr('Loading saved entries…','Завантаження збережених записів…'))+'</p>';
 if(state.playlist){
  const playlist=state.playlist,rows=Array.isArray(playlist.tracks)?playlist.tracks:[];
  return '<div class="aurel-ltm-playlist-head">'+
   button('back',tr('Back to playlists','Назад до плейлистів'))+
   '<h4>'+esc(playlist.name||'Playlist')+'</h4>'+
   button('play-playlist',tr('Play playlist','Відтворити плейлист'),
       !rows.length||!app.session?.streamConnected)+'</div>'+
   '<p class="aurel-ltm-note">'+rows.length+' '+esc(tr('tracks · requires active streaming authorization','треків · потрібна активна авторизація відтворення'))+'</p>'+
   '<div class="aurel-ltm-entries">'+rows.slice(0,100).map((row,i)=>
    '<button type="button" data-ltm-play-index="'+i+'"><span class="aurel-ltm-index">'+(i+1)+
    '</span><span><strong>'+esc(row.title||'Track')+'</strong><small>'+
     esc(row.artist||'')+'</small></span></button>').join('')+'</div>'+
    (rows.length>100?'<p class="aurel-ltm-note">'+esc(
       tr('First 100 shown; the entire sequence is saved.','Показано перші 100; усю чергу збережено.'))+'</p>':'');
 }
 if(!state.items.length)return '<p class="aurel-ltm-empty">'+
   esc(tr('No local entries in this category.','У цій категорії немає локальних записів.'))+'</p>';
 return '<div class="aurel-ltm-entries">'+state.items.map(item=>{
  const name=state.active==='artists'?item.name:state.active==='playlists'?item.name:item.title;
  const local=isLocalId(item.id);
  const linked=local&&item.linkedId&&!(isLocalId(item.linkedId));
  const sub=state.active==='playlists'
    ?(Number(item.tracksCount)||0)+' '+tr('tracks','треків'):
    item.artist||'';
  return '<button type="button" data-ltm-open="'+esc(item.id)+'" aria-label="'+esc(name)+
   '"><span><strong>'+esc(name||'Untitled')+'</strong><small>'+esc(sub)+'</small>'+
   (local?'<small class="aurel-ltm-unlinked">'+esc(linked?
      tr('Linked · opens in Qobuz catalogue','Пов’язано · відкривається у каталозі Qobuz'):
      tr('Tap to find and open online','Натисніть для пошуку та відкриття онлайн'))+'</small>':'')+
   '</span><span class="aurel-ltm-actions-row">'+
   (state.active==='playlists'?'<span role="button" tabindex="-1" data-ltm-local-playlist="'+esc(item.id)+
      '" class="aurel-ltm-relink" aria-label="'+esc(tr('View saved track list','Переглянути збережені треки'))+
      '" title="'+esc(tr('Local track list','Локальний список треків'))+'">☷</span>':'')+
   (local&&linked?'<span role="button" tabindex="-1" data-ltm-relink="'+esc(item.id)+
       '" class="aurel-ltm-relink" aria-label="'+esc(tr('Change Qobuz match','Змінити збіг Qobuz'))+
       '" title="'+esc(tr('Change match','Змінити збіг'))+'">⋯</span>':'')+
   '<span class="aurel-ltm-chevron">›</span></span></button>';
 }).join('')+'</div>';
}
function draw(){
 const node=document.getElementById('aurel-library-transfer');if(!node)return;
 const busy=!!state.status.busy;
 const source=!!app.session?.libraryConnected;
 const progress=Number(state.status.done)||0,maximum=Math.max(0,Number(state.status.total)||0);
 const percentage=maximum?Math.min(100,Math.round(100*progress/maximum)):0;
 node.innerHTML='<div class="aurel-ltm-title"><span class="aurel-ltm-mark">▦</span><div>'+
  '<h3>'+esc(tr('Library Import / Export','Імпорт та експорт бібліотеки'))+'</h3>'+
  '<p>'+esc(tr('Independent local copy of your Qobuz collections',
    'Незалежна локальна копія колекцій Qobuz'))+'</p></div></div>'+
  '<div class="aurel-ltm-counts">'+summary()+'</div>'+
  '<p class="aurel-ltm-note">'+esc(source?tr(
   'Source: connected separate Qobuz library account. Streaming account stays unchanged.',
   'Джерело: підключений окремий Qobuz-акаунт. Акаунт відтворення не змінюється.'):
   tr('To fetch another Qobuz account, connect it under Settings → Personal Qobuz library. You can still import a saved JSON.',
   'Для перенесення з іншого Qobuz-акаунта підключіть його в Налаштування → Особиста бібліотека Qobuz. Імпорт JSON доступний і без цього.'))+'</p>'+
  '<div class="aurel-ltm-select">'+TYPES.map(t=>
   '<label><input type="checkbox" data-ltm-kind="'+t+'" '+
   (state.selected.has(t)?'checked':'')+(busy?' disabled':'')+'><span>'+esc(label(t))+'</span></label>').join('')+'</div>'+
  '<div class="aurel-ltm-actions">'+
  button('sync',tr('Import from Qobuz','Завантажити з Qobuz'),
    busy||!source||!state.selected.size)+
  button('export',tr('Export JSON','Експорт JSON'),busy)+
  button('import',tr('Import JSON · merge','Імпорт JSON · об’єднати'),busy)+
  button('replace',tr('Restore · replace local copy','Відновити · замінити копію'),busy)+
  '</div>'+
  (busy?'<div class="aurel-ltm-progress"><progress max="100" value="'+percentage+
   '"></progress><span>'+esc(state.status.message||'Working…')+
    (maximum?' · '+progress+'/'+maximum:'')+'</span>'+
    button('cancel',tr('Cancel transfer','Скасувати перенесення'))+'</div>':'')+
  (!busy&&state.status.message?'<p class="aurel-ltm-status" role="status">'+
    esc(state.status.message)+'</p>':'')+
  (state.pending?'<div class="aurel-ltm-confirm" role="alert"><p>'+
   esc(state.pending==='clear'
    ?tr('Clear only the local copy? Qobuz will not be modified.',
       'Очистити лише локальну копію? Дані Qobuz не зміняться.')
    :tr('Replace the local library with the JSON file? Make an export first.',
       'Замінити локальну бібліотеку вмістом JSON? Спочатку збережіть копію.'))+'</p>'+
   button('confirm',tr('Confirm','Підтвердити'))+
   button('cancel-confirm',tr('Keep existing data','Зберегти дані'))+'</div>':'')+
  '<div class="aurel-ltm-browser-head">'+
    button('toggle',state.opened?tr('Hide local library','Сховати локальну бібліотеку'):
      tr('Browse local library','Переглянути локальну бібліотеку'))+
    button('clear',tr('Clear local copy','Очистити локальну копію'),busy)+'</div>'+
   (state.opened?'<div class="aurel-ltm-browser">'+
    '<div class="aurel-ltm-tabs">'+TYPES.map(t=>'<button type="button" data-ltm-tab="'+t+
       '" class="'+(state.active===t?'active':'')+'">'+esc(label(t))+'</button>').join('')+'</div>'+
    contentRows()+
    (!state.playlist&&state.total>30?'<div class="aurel-ltm-pager">'+
      button('prev','‹',state.offset===0)+
      '<span>'+(state.offset+1)+'–'+Math.min(state.offset+30,state.total)+' / '+state.total+'</span>'+
      button('next','›',state.offset+30>=state.total)+'</div>':'')+
    '</div>':'')+
  '<p class="aurel-ltm-note">'+esc(tr(
    'JSON contains catalogue metadata only, never passwords, session tokens, signed URLs or audio. Local playlists are not written to Qobuz. Playing saved tracks requires a permitted online source.',
    'JSON містить лише метадані каталогу: без паролів, токенів, підписаних URL та аудіо. Локальні плейлисти не змінюють Qobuz. Для відтворення потрібне авторизоване онлайн-джерело.'))+'</p>';
 window.AurelLanguage?.refresh?.(node);
}
async function call(action,payload){
 try{return await nativeCall(action,payload||{});}
 catch(err){
  state.status={...state.status,busy:false,stage:'error',message:String(err?.message||'Operation failed').slice(0,240)};
  draw();return null;
 }
}
async function refresh(){
 const result=await call('libraryTransferStatus',{});
 if(result){state.status=result;draw();}
}
async function browse(){
 if(!state.opened||state.playlist)return;
 const ticket=++state.serial;
 state.loading=true;draw();
 const result=await call('libraryTransferBrowse',
   {type:state.active,offset:state.offset,limit:30});
 if(ticket!==state.serial)return;
 state.loading=false;
 if(result){state.items=Array.isArray(result.items)?result.items:[];
  state.total=Number(result.total)||0;}
 draw();
}
async function playlist(id){
 state.loading=true;draw();
 const result=await call('libraryTransferPlaylist',{id});
 state.loading=false;
 if(result){state.playlist=result;}
 draw();
}
const prevSettings=renderSettings;
renderSettings=function(){
 const result=prevSettings.apply(this,arguments);
 mount();return result;
};
const prevLibrary=renderLibrary;
renderLibrary=function(){
 const result=prevLibrary.apply(this,arguments);
 mount();return result;
};
const previousEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 const result=previousEvent.apply(this,arguments);
 if(kind==='libraryTransfer'){
  const earlier=state.status?.busy;
  state.status={...state.status,...(data||{})};
  draw();
  if(earlier&&!state.status.busy&&state.status.stage==='complete'){
   void refresh();
   if(state.opened){state.offset=0;state.playlist=null;void browse();}
  }
 }
 if(kind==='session'){
  const connected=!!app.session?.libraryConnected;
  if(lastLibraryConnection!==connected){
   lastLibraryConnection=connected;
   if(document.getElementById('aurel-library-transfer'))draw();
  }
 }
 return result;
};
document.addEventListener('change',event=>{
 const kind=event.target?.getAttribute?.('data-ltm-kind');
 if(!kind||!TYPES.includes(kind))return;
 if(event.target.checked)state.selected.add(kind);
 else state.selected.delete(kind);
 draw();
},true);
function trackObj(row){
 return {
  id:row.id,title:row.title||'',duration:Number(row.duration)||0,
  artist:{name:row.artist||''},
  album:{id:row.albumId||'',title:row.albumTitle||''}
 };
}
async function playLocal(rows,index){
 if(!app.session?.streamConnected){
  showToast(tr('Connect a streaming account first.','Спочатку підключіть джерело відтворення.'));
  return;
 }
 const selected=rows[index];if(!selected)return;
 if(isLocalId(selected.id)){
  if(window.AurelOnlineLibraryResolver)
   await window.AurelOnlineLibraryResolver.open(selected,'tracks');
  else showToast(tr('Online library resolver unavailable','Онлайн-пошук недоступний'));
  return;
 }
 const items=rows.slice(0,Math.min(rows.length,400)).map(trackObj);
 const target=Math.min(index,items.length-1);
 if(index>=items.length){
  showToast(tr('Select a track in the first 400 items.','Оберіть трек серед перших 400.'));
  return;
 }
 try{
  await nativeCall('play',{tracks:items,index:target});
  app.overlay=true;app.playerSheet='';drawOverlay();
 }catch(err){showToast(String(err?.message||'Playback requires authorized access'));}
}
document.addEventListener('click',async event=>{
 const target=event.target?.closest?.(
  '#aurel-library-transfer [data-ltm-action], #aurel-library-transfer [data-ltm-tab],'+
  '#aurel-library-transfer [data-ltm-open], #aurel-library-transfer [data-ltm-play-index],'+
  '#aurel-library-transfer [data-ltm-relink], #aurel-library-transfer [data-ltm-local-playlist]');
 if(!target)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(target.hasAttribute('data-ltm-play-index')){
  const index=Number(target.getAttribute('data-ltm-play-index'));
  if(state.playlist)await playLocal(state.playlist.tracks||[],index);
  return;
 }
 const kind=target.getAttribute('data-ltm-tab');
 if(kind){
  if(!TYPES.includes(kind))return;
  state.active=kind;state.offset=0;state.playlist=null;
  await browse();return;
 }
 const relink=target.getAttribute('data-ltm-relink');
 if(relink){
  const row=state.items.find(x=>String(x.id)===relink);
  if(row&&window.AurelOnlineLibraryResolver)
   await window.AurelOnlineLibraryResolver.open(row,state.active,true);
  return;
 }
 const offlinePlaylist=target.getAttribute('data-ltm-local-playlist');
 if(offlinePlaylist){await playlist(offlinePlaylist);return;}
 const open=target.getAttribute('data-ltm-open');
 if(open){
  const item=state.items.find(x=>String(x.id)===open);
  if(!item)return;
  if(isLocalId(open)){
   if(window.AurelOnlineLibraryResolver)
    await window.AurelOnlineLibraryResolver.open(item,state.active);
   else showToast(tr('Online library resolver unavailable','Онлайн-пошук недоступний'));
  }else if(state.active==='playlists')await openPlaylist(open);
  else if(state.active==='artists')await openArtist(open);
  else if(state.active==='albums')await openAlbum(open);
  else if(state.active==='tracks')await playLocal([item],0);
  return;
 }
 const action=target.getAttribute('data-ltm-action');
 if(!action)return;
 if(state.status.busy&&!['cancel'].includes(action))return;
 switch(action){
 case 'toggle':
  state.opened=!state.opened;state.playlist=null;
  draw();if(state.opened)await browse();break;
 case 'sync':
  await call('libraryTransferSync',{types:[...state.selected]});
  break;
 case 'export':await call('libraryTransferExport',{});break;
 case 'import':await call('libraryTransferImport',{mode:'merge'});break;
 case 'replace':state.pending='replace';draw();break;
 case 'clear':state.pending='clear';draw();break;
 case 'confirm':
  if(state.pending==='clear')await call('libraryTransferClear',{confirm:'CLEAR LOCAL LIBRARY'});
  if(state.pending==='replace')await call('libraryTransferImport',{mode:'replace'});
  state.pending='';draw();break;
 case 'cancel-confirm':state.pending='';draw();break;
 case 'cancel':await call('libraryTransferCancel',{});break;
 case 'prev':state.offset=Math.max(0,state.offset-30);await browse();break;
 case 'next':state.offset+=30;await browse();break;
 case 'back':state.playlist=null;await browse();break;
 case 'play-playlist':
  if(state.playlist)await playLocal(state.playlist.tracks||[],0);
  break;
 }
},true);
setTimeout(()=>{if(window.AurelNative)void refresh();},1800);
window.AurelLibraryTransfer={refresh,browse,status:()=>state.status,
  onLinked:async()=>{
   // Keep the local library page visible after a successful match.
   if(state.opened&&!app.selected)await browse();
  }};
})();