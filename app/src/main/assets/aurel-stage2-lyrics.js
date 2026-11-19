/* AUREL Stage 2 — LRCLIB lyrics on explicit user request only.
 * Track metadata (title/artist/album/duration) is sent to LRCLIB via the native
 * client. No Qobuz tokens, media URLs or session grants leave the player.
 */
(function installAurelLyrics(){
'use strict';
const state={key:'',status:'idle',lines:[],plain:'',message:'',synced:false};
const memo=new Map();
let inflight=null,raf=0,lastTick=0,activeLine=-1,userScrollUntil=0;
const uk=()=>window.AurelLanguage?.get?.()==='uk';
const say=(en,ua)=>uk()?ua:en;
const overlay=document.getElementById('overlay');
const validId=id=>/^[0-9]{1,24}$/.test(String(id||''));
const durationSeconds=p=>{
 const millis=Number(p?.duration)||0;
 return millis>0&&millis<24*60*60*1000?Math.round(millis/1000):0;
};
function signature(p){
 const t=p?.track||{};
 return validId(t.id)?[
  String(t.id),String(t.title||'').slice(0,160),
  String(artistLabel(t)||'').slice(0,160),
  durationSeconds(p)
 ].join('|'):'';
}
function parseLrc(source){
 if(typeof source!=='string'||source.length>90000)return [];
 let offset=0,lines=[];
 const rows=source.replace(/\r/g,'').split('\n');
 for(const line of rows.slice(0,500)){
  const m=/^\[offset:([+-]?\d+)\]/i.exec(line.trim());
  if(m)offset=Math.max(-10000,Math.min(10000,Number(m[1])||0));
 }
 for(const line of rows.slice(0,500)){
  const stamps=[...line.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
  if(!stamps.length)continue;
  const content=line.replace(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g,'')
    .replace(/<\d{2}:\d{2}[.:]\d{2,3}>/g,'').trim().slice(0,280);
  if(!content)continue;
  for(const stamp of stamps.slice(0,6)){
   const fraction=(stamp[3]||'').padEnd(3,'0').slice(0,3);
   const at=Math.max(0,Number(stamp[1])*60000+Number(stamp[2])*1000+
     (Number(fraction)||0)+offset);
   lines.push({at,text:content});
   if(lines.length>=280)break;
  }
  if(lines.length>=280)break;
 }
 lines.sort((a,b)=>a.at-b.at);
 return lines.filter((item,i)=>i===0||item.at!==lines[i-1].at||item.text!==lines[i-1].text);
}
function applyResult(result){
 const status=String(result?.status||'missing');
 const lines=parseLrc(String(result?.syncedLyrics||''));
 const plain=String(result?.plainLyrics||'').slice(0,80000);
 state.status=status==='ok'?'ready':status;
 state.lines=lines;state.plain=plain;state.synced=lines.length>0;
 state.message='';
}
function linesPanel(){
 if(state.synced){
  return '<div class="aurel-lyrics-lines" aria-label="'+html(say('Synchronized lyrics','Синхронізований текст'))+'">'+
   state.lines.map((line,index)=>'<button type="button" class="aurel-lyrics-line" data-aurel-lyric-index="'+index+'" data-aurel-lyric-ms="'+line.at+'" aria-label="'+html(line.text)+'">'+html(line.text)+'</button>').join('')+
   '</div>';
 }
 if(state.plain){
  return '<div class="aurel-lyrics-plain">'+state.plain.split(/\r?\n/).slice(0,280)
   .map(x=>'<p>'+html(x)+'</p>').join('')+'</div>';
 }
 return '<div class="aurel-lyrics-empty">'+html(
  state.status==='loading'?say('Looking for lyrics…','Шукаємо текст пісні…'):
  state.status==='instrumental'?say('Instrumental track — no lyrics.','Інструментальний трек — тексту немає.'):
  state.status==='error'?state.message||say('Could not retrieve lyrics.','Не вдалося отримати текст пісні.'):
  say('Lyrics are not available for this recording.','Текст для цього запису недоступний.'))+
  (state.status==='error'?'<button type="button" data-aurel-lyrics-retry>'+html(say('Try again','Повторити'))+'</button>':'')+'</div>';
}
function lyricsPanel(p){
 if(signature(p)!==state.key){
  return '<div class="aurel-lyrics-empty">'+html(say('Opening lyrics…','Відкриваємо текст…'))+'</div>';
 }
 return '<div class="aurel-lyrics-container">'+linesPanel()+
   '<p class="aurel-lyrics-credit">'+html(say('Lyrics from LRCLIB · tap a timed line to seek',
      'Тексти LRCLIB · торкніться рядка, щоб перейти до нього'))+'</p></div>';
}
function redraw(){
 if(!app.overlay||app.playerSheet!=='lyrics')return;
 const panel=overlay?.querySelector('.aurel-detail-sheet');
 if(!panel)return;
 const content=lyricsPanel(app.player);
 if(panel.__aurelPanelHTML!==content){
  panel.innerHTML=content;
  panel.__aurelPanelHTML=content;
  window.AurelLanguage?.refresh?.(panel);
 }
 activeLine=-1;
 updateLine();
}
function updateLine(){
 if(!app.overlay||app.playerSheet!=='lyrics'||!state.synced)return;
 const position=Number(window.AurelProgressClock?.read?.(app.player)??app.player?.position??0);
 if(!Number.isFinite(position))return;
 let lo=0,hi=state.lines.length-1,current=-1;
 while(lo<=hi){
  const mid=(lo+hi)>>1;
  if(state.lines[mid].at<=position+110){current=mid;lo=mid+1;}
  else hi=mid-1;
 }
 if(current===activeLine)return;
 const old=overlay?.querySelector('.aurel-lyrics-line.is-current');
 old?.classList.remove('is-current');
 activeLine=current;
 if(current<0)return;
 const next=overlay?.querySelector('[data-aurel-lyric-index="'+current+'"]');
 next?.classList.add('is-current');
 if(next&&Date.now()>userScrollUntil){
  const scroller=overlay.querySelector('.aurel-detail-scroll');
  if(scroller){
   // Local scrolling only. Never move the player cover or the app viewport.
   const top=next.offsetTop-scroller.offsetTop-scroller.clientHeight*.40;
   scroller.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  }
 }
}
function stopClock(){
 if(raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(raf);
 raf=0;
}
function frame(t){
 raf=0;
 if(!app.overlay||app.playerSheet!=='lyrics'||document.hidden)return;
 if(t-lastTick>=150){lastTick=t;updateLine();}
 if(app.player?.playing)raf=requestAnimationFrame(frame);
}
function startClock(){
 if(raf||!app.overlay||app.playerSheet!=='lyrics'||document.hidden)return;
 updateLine();
 if(app.player?.playing&&typeof requestAnimationFrame==='function')
  raf=requestAnimationFrame(frame);
}
async function load(p,force=false){
 const key=signature(p);
 if(!key)return;
 if(!force&&key===state.key&&['ready','missing','instrumental','loading','error'].includes(state.status))return;
 state.key=key;state.status='loading';state.lines=[];state.plain='';state.synced=false;state.message='';
 activeLine=-1;
 redraw();
 if(!force&&memo.has(key)){applyResult(memo.get(key));redraw();startClock();return;}
 const t=p.track;
 const query={title:String(t.title||'').slice(0,160),
  artist:String(artistLabel(t)||'').slice(0,160),
  album:String(t.album?.title||'').slice(0,160),
  duration:durationSeconds(p)};
 const token=key;
 const request=nativeCall('lyrics',query);
 inflight=request;
 try{
  const result=await request;
  if(inflight!==request||state.key!==token)return;
  if(memo.size>=36)memo.delete(memo.keys().next().value);
  memo.set(token,result);
  applyResult(result);
 }catch(err){
  if(inflight!==request||state.key!==token)return;
  state.status='error';
  state.message=say('Lyrics are temporarily unavailable.','Текст тимчасово недоступний.');
  window.AurelErrorLog?.record?.('lyrics',String(err?.message||'LRCLIB request failed').slice(0,150));
 }finally{
  if(inflight===request)inflight=null;
  if(state.key===token){redraw();startClock();}
 }
}
function afterDraw(){
 if(!app.overlay||app.playerSheet!=='lyrics'){stopClock();return;}
 const key=signature(app.player);
 if(!key){stopClock();return;}
 if(key!==state.key)void load(app.player);
 else {updateLine();startClock();}
}
const previousDraw=drawOverlay;
drawOverlay=function(){
 const out=previousDraw.apply(this,arguments);
 afterDraw();
 return out;
};
const previousEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 const out=previousEvent.apply(this,arguments);
 if(kind==='player'&&app.overlay&&app.playerSheet==='lyrics'){
  if(signature(data)!==state.key)void load(data);
  else {updateLine();startClock();}
 }
 return out;
};
document.addEventListener('click',e=>{
 const retry=e.target?.closest?.('[data-aurel-lyrics-retry]');
 const line=e.target?.closest?.('[data-aurel-lyric-ms]');
 if(retry){
  e.preventDefault();e.stopImmediatePropagation();
  memo.delete(state.key);
  void load(app.player,true);
  return;
 }
 if(!line)return;
 e.preventDefault();e.stopImmediatePropagation();
 const ms=Number(line.getAttribute('data-aurel-lyric-ms'));
 if(!Number.isFinite(ms)||ms<0||ms>24*60*60*1000)return;
 userScrollUntil=Date.now()+4500;
 nativeCall('seek',{ms:Math.round(ms)}).catch(error=>showToast(error?.message||'Seek unavailable'));
},true);
document.addEventListener('scroll',e=>{
 if(e.target?.classList?.contains('aurel-detail-scroll')&&app.playerSheet==='lyrics'&&e.isTrusted)
  userScrollUntil=Date.now()+7000;
},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopClock();else startClock();});
window.AurelStage2Lyrics={parseLrc,afterDraw,status:()=>state.status,redraw};
})();