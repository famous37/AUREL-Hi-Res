/* AUREL Stage 2 — bounded, private listening history and credential-free backup.
 * Remote Qobuz favourites, subscriptions and playlists remain in Qobuz.
 * Export only the explicitly allow-listed local UI preferences and metadata.
 */
(function installAurelStageTwoLibrary(){
'use strict';
const HISTORY='aurel_listening_history_v1';
const FIELDS=[
 'aurel_locale_v1','aurel_palette_artwork_v1','aurel_palette_colors_v1',
 'aurel_motion_mode_v1','aurel_page_buffer_pref_v1',
 'aurel_cover_rhythm_v1','aurel_aurora_shadows_v1',
 'aurel_recent_searches','aurel_navigation_v2',HISTORY
];
const SCHEMA='aurel-safe-backup-v1';
const uk=()=>window.AurelLanguage?.get?.()==='uk';
const text=(en,ua)=>uk()?ua:en;
const MAX_HISTORY=80,MAX_FIELD=180000;
let history=[];
let lastSeen='',lastResult='';
const read=key=>{try{return localStorage.getItem(key);}catch(_){return null;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);return true;}catch(_){return false;}};
function validateRow(t){
 if(!t||typeof t!=='object'||!/^[0-9]{1,24}$/.test(String(t.id||'')))return null;
 const clean=x=>String(x||'').slice(0,180);
 const album=t.album||{};
 return {
  id:String(t.id),title:clean(t.title),artist:clean(t.artist),
  album:{id:clean(album.id).replace(/[^a-zA-Z0-9]/g,'').slice(0,64),
         title:clean(album.title)},
  lastPlayed:Number(t.lastPlayed)||Date.now()
 };
}
function loadHistory(){
 try{
  const rows=JSON.parse(read(HISTORY)||'[]');
  return Array.isArray(rows)?rows.slice(0,MAX_HISTORY).map(validateRow).filter(Boolean):[];
 }catch(_){return [];}
}
history=loadHistory();
function updateHistory(data){
 const t=data?.track||{};
 if(!data?.playing||data.buffering||data.error||!t.id)return;
 if(Number(data.position)<5000)return; // no false history entries from browsing
 if(!/^[0-9]{1,24}$/.test(String(t.id)))return;
 const id=String(t.id);
 if(id===lastSeen)return;
 lastSeen=id;
 const entry=validateRow({
  id, title:String(t.title||'').slice(0,180),
  artist:String(artistLabel(t)||'').slice(0,180),
  album:{id:t.album?.id,title:t.album?.title},
  lastPlayed:Date.now()
 });
 if(!entry)return;
 history=[entry,...history.filter(x=>x.id!==id)].slice(0,MAX_HISTORY);
 write(HISTORY,JSON.stringify(history));
}
function rows(limit){
 if(!history.length)return '<p class="aurel-stage2-note">'+html(text(
  'No listening history yet. A track appears after 5 seconds of playback.',
  'Історія порожня. Трек з’явиться після 5 секунд відтворення.'))+'</p>';
 return '<div class="aurel-stage2-history-list">'+history.slice(0,limit).map(t=>
  '<button class="aurel-stage2-history-entry" type="button" data-aurel-history-id="'+html(t.id)+'">'+
   '<span class="aurel-stage2-history-icon">'+ic('audio',20)+'</span>'+
   '<span><strong>'+html(t.title||'Untitled')+'</strong><small>'+html(t.artist)+
   (t.album.title?' · '+html(t.album.title):'')+'</small></span>'+ic('play',21)+
  '</button>').join('')+'</div>';
}
function appendSettings(){
 const root=document.getElementById('screen');
 if(app.nav!=='settings'||app.selected||!root?.querySelector('.aurel-settings-heading')||
    root.querySelector('[data-aurel-stage2-settings]'))return;
 // The settings accordion is already mounted by the earlier settings layer.
 // Attach data tools inside its real App & data category, never below the cards.
 const host=root.querySelector('[data-aurel-settings-group="app"] .aurel-settings-group-content')||root;
 const section=document.createElement('section');
 section.className='panel aurel-stage2-settings';
 section.setAttribute('data-aurel-stage2-settings','');
 section.innerHTML='<h3>'+html(text('Listening history & backup','Історія та резервні копії'))+'</h3>'+
  '<details class="aurel-stage2-disclosure"><summary>'+html(text('Recently played','Нещодавно прослухані'))+
   ' ('+history.length+')</summary>'+rows(15)+
  '<button type="button" class="aurel-stage2-secondary" data-aurel-history-clear>'+
   html(text('Clear listening history','Очистити історію'))+'</button></details>'+
  '<div class="aurel-stage2-backup-actions">'+
   '<button type="button" data-aurel-backup-export>'+html(text('Export backup','Зберегти копію'))+'</button>'+
   '<button type="button" data-aurel-backup-import>'+html(text('Restore backup','Відновити копію'))+'</button>'+
  '</div>'+
  '<details class="aurel-stage2-disclosure aurel-stage2-backup-info"><summary>'+
    html(text('About backup','Про резервну копію'))+'</summary>'+
    '<p class="aurel-stage2-note">'+html(text(
     'Backup contains only local settings, navigation, searches and listening history. No passwords, Qobuz tokens or online favourites.',
     'Копія містить локальні налаштування, навігацію, пошук та історію. Без паролів, токенів Qobuz і вибраного на сервері.'))+'</p></details>'+
  '<small data-aurel-backup-status role="status">'+html(lastResult)+'</small>';
 host.appendChild(section);
}
function appendHome(){
 const root=document.getElementById('screen');
 if(app.nav!=='home'||app.selected||!history.length||root?.querySelector('[data-aurel-history-home]'))return;
 const section=document.createElement('section');
 section.className='aurel-stage2-recent';
 section.setAttribute('data-aurel-history-home','');
 section.innerHTML='<h2>'+html(text('Recently played','Нещодавно прослухані'))+'</h2>'+rows(6);
 // Keep the first rows above the sticky mini-player/nav while preserving
 // the scrollable full list and the route state.
 const anchor=root.querySelector('.new-section');
 if(anchor)anchor.before(section);else root.appendChild(section);
}
const oldSettings=renderSettings;
renderSettings=function(){const out=oldSettings.apply(this,arguments);appendSettings();return out;};
const oldHome=renderHome;
renderHome=function(){const out=oldHome.apply(this,arguments);appendHome();return out;};
function refreshHistoryUi(){
 const setting=document.querySelector('[data-aurel-stage2-settings]');
 if(setting){
  const expanded=!!setting.querySelector('details')?.open;
  setting.remove();appendSettings();
  const panel=document.querySelector('[data-aurel-stage2-settings] details');
  if(panel)panel.open=expanded;
 }
 const home=document.querySelector('[data-aurel-history-home]');
 if(home)home.remove();
 if(app.nav==='home')appendHome();
}
const originalEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 const out=originalEvent.apply(this,arguments);
 if(kind==='player'){
  const before=history[0]?.id||'';
  updateHistory(data);
  if((history[0]?.id||'')!==before)refreshHistoryUi();
 }
 return out;
};
function makeBackup(){
 window.AurelPersistNow?.();
 const entries={};
 for(const key of FIELDS){
  const value=read(key);
  if(typeof value==='string'&&value.length<=MAX_FIELD)entries[key]=value;
 }
 return JSON.stringify({format:SCHEMA,createdAt:new Date().toISOString(),data:entries});
}
function restoreBackup(content){
 if(typeof content!=='string'||content.length>360000)throw Error('Backup file is too large');
 const source=JSON.parse(content);
 if(source?.format!==SCHEMA||!source.data||Array.isArray(source.data)||
    typeof source.data!=='object')throw Error('Unsupported AUREL backup');
 const entries=source.data;
 if(Object.keys(entries).length>FIELDS.length)throw Error('Unexpected backup fields');
 for(const [key,value] of Object.entries(entries)){
  if(!FIELDS.includes(key)||typeof value!=='string'||value.length>MAX_FIELD)
   throw Error('Unsafe backup field');
 }
 for(const [key,value] of Object.entries(entries)){
  if(!write(key,value))throw Error('Cannot store '+key);
 }
 history=loadHistory();lastSeen='';
 refreshHistoryUi();
 const locale=read('aurel_locale_v1');
 if(locale==='en'||locale==='uk')window.AurelLanguage?.set?.(locale);
 const artwork=read('aurel_palette_artwork_v1');
 if(artwork==='on'||artwork==='off')window.AurelTheme?.setArtworkPalette?.(artwork==='on');
 const motion=read('aurel_motion_mode_v1');
 if(motion==='on'||motion==='off'||motion==='soft')
  window.AurelProSettings?.applyMotion?.(motion==='off'?'off':'soft');
}
function status(message){
 lastResult=message;
 const node=document.querySelector('[data-aurel-backup-status]');
 if(node)node.textContent=message;
 if(message)showToast(message,4200);
}
window.AurelStage2BackupResult=function(result){
 if(!result||result.cancelled)return;
 if(!result.ok){status(text('Backup failed: ','Помилка копії: ')+String(result.message||'unknown').slice(0,100));return;}
 if(result.kind==='import'){
  try{
   restoreBackup(result.content);
   status(text('Settings restored. Reopen AUREL to apply every setting.',
    'Налаштування відновлено. Перезапустіть AUREL, щоб застосувати всі зміни.'));
  }catch(err){status(text('Import error: ','Помилка імпорту: ')+String(err?.message||'invalid file').slice(0,100));}
 }else status(text('Backup saved to your selected location.','Копію збережено у вибраному місці.'));
};
document.addEventListener('click',async e=>{
 const replay=e.target?.closest?.('[data-aurel-history-id]');
 const clear=e.target?.closest?.('[data-aurel-history-clear]');
 const exportButton=e.target?.closest?.('[data-aurel-backup-export]');
 const importButton=e.target?.closest?.('[data-aurel-backup-import]');
 if(!replay&&!clear&&!exportButton&&!importButton)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(replay){
  const t=history.find(x=>x.id===replay.getAttribute('data-aurel-history-id'));
  if(!t)return;
  const track={id:t.id,title:t.title,artist:{name:t.artist},
    album:{id:t.album.id,title:t.album.title}};
  replay.disabled=true;
  try{
   await nativeCall('play',{tracks:[track],index:0});
   app.overlay=true;app.playerSheet='';drawOverlay();
  }catch(error){showToast(error?.message||'Playback unavailable');}
  finally{if(replay.isConnected)replay.disabled=false;}
  return;
 }
 if(clear){
  history=[];lastSeen='';write(HISTORY,'[]');refreshHistoryUi();
  status(text('Listening history cleared.','Історію прослуховування очищено.'));
  return;
 }
 const button=exportButton||importButton;
 if(button.disabled)return;
 button.disabled=true;
 try{
  const result=exportButton
   ?await nativeCall('stage2BackupExport',{content:makeBackup()})
   :await nativeCall('stage2BackupImport',{});
  if(!result?.pickerOpened)throw Error('Cannot open Android document picker');
 }catch(error){
  status(text('Cannot open backup: ','Не вдалося відкрити копію: ')+
   String(error?.message||'unknown').slice(0,100));
 }finally{if(button.isConnected)button.disabled=false;}
},true);
window.AurelListeningHistory={get:()=>history.map(t=>({...t})),clear:()=>{
 history=[];lastSeen='';write(HISTORY,'[]');refreshHistoryUi();},makeBackup,restoreBackup};
})();