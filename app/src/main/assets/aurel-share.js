/* AUREL 1.1.24 — sharing real public Qobuz links.
 * Does not call a streaming endpoint or expose account/session details. */
(function installAurelSharing(){
'use strict';
// Use the same high-contrast vector as every player control.
const icon=()=>ic('share');
const valid={
 track:/^[0-9]{1,20}$/,
 album:/^[A-Za-z0-9]{1,64}$/,
 artist:/^[0-9]{1,20}$/
};
function linkFor(type,id){
 type=String(type||'');
 id=String(id===undefined||id===null?'':id).trim();
 if(!Object.prototype.hasOwnProperty.call(valid,type)||!valid[type].test(id))
  throw new Error('Invalid Qobuz item ID for sharing');
 return 'https://open.qobuz.com/'+type+'/'+id;
}
function make(type,id,mode='icon'){
 if(!linkFor(type,id))return null;
 const button=document.createElement('button');
 button.type='button';
 button.className='aurel-share-control'+(mode==='label'?' aurel-share-label':' aurel-share-icon');
 button.setAttribute('data-aurel-share-kind',type);
 button.setAttribute('data-aurel-share-id',String(id));
 button.setAttribute('aria-label','Share '+type);
 button.setAttribute('title','Share '+type);
 button.innerHTML=icon()+(mode==='label'?'<span>Share</span>':'');
 return button;
}
function appendOnce(parent,kind,id,mode='icon'){
 if(!parent||!id||parent.querySelector('.aurel-share-control'))return;
 try{parent.appendChild(make(kind,id,mode));}
 catch(_){/* Do not create a broken share action for incomplete catalogue data. */}
}
function decorate(){
 const screen=document.getElementById('screen');
 const overlay=document.getElementById('overlay');
 if(screen){
  if(app.selectedKind==='album'&&app.selected?.id)
    appendOnce(screen.querySelector('.actionbar'),'album',app.selected.id,'label');
  if(app.selectedKind==='artist'&&app.selected?.id)
    appendOnce(screen.querySelector('.aurel-artist-actions'),'artist',app.selected.id,'label');

  screen.querySelectorAll('.track[data-aurel-track-id]').forEach(row=>{
   appendOnce(row,'track',row.dataset.aurelTrackId);
  });
  screen.querySelectorAll('.albumcard[data-open-album]').forEach(card=>{
   appendOnce(card.querySelector('.cover'),'album',card.dataset.openAlbum);
  });
  // Album shelf tiles and library rows are themselves buttons. Place
  // share controls in the same wrapper as the separate favourite button.
  // Never put a button inside another button.
  screen.querySelectorAll('.aurel-shelf-shell').forEach(shell=>{
   appendOnce(shell,'album',shell.querySelector('.shelf-card')?.dataset.openAlbum);
  });
  screen.querySelectorAll('.aurel-album-row-shell').forEach(shell=>{
   appendOnce(shell,'album',shell.querySelector('.library-album-row')?.dataset.openAlbum);
  });
  screen.querySelectorAll('.aurel-artist-item').forEach(shell=>{
   appendOnce(shell,'artist',shell.querySelector('.artistrow')?.dataset.openArtist);
  });
 }
 if(overlay&&app.overlay){
  appendOnce(overlay.querySelector('.murglar-quick-actions'),'track',app.player?.track?.id,'label');
 }
}
async function share(type,id){
 try{
  // Validate before opening the native share sheet; the Android bridge
  // independently verifies it again and constructs the URL itself.
  linkFor(type,id);
  const locale=window.AurelLanguage?.get?.()==='uk'?'uk':'en';
  return await nativeCall('shareQobuzLink',{type,id:String(id),locale});
 }catch(error){
  showToast(error?.message||'Unable to share Qobuz link');
  return null;
 }
}
document.addEventListener('click',function(event){
 const button=event.target?.closest?.('button[data-aurel-share-kind]');
 if(!button)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 void share(button.getAttribute('data-aurel-share-kind'),
            button.getAttribute('data-aurel-share-id'));
},true);
let scheduled=false;
function scheduleDecorate(){
 if(scheduled)return;
 scheduled=true;
 setTimeout(()=>{
  scheduled=false;
  try{decorate();}catch(_){/* A view may have been unmounted on navigation. */}
 },0);
}
if(typeof MutationObserver==='function'){
 const observer=new MutationObserver(function(records){
   // The elapsed-time counter is not a new shareable item.
   if(records.some(change=>Array.from(change.addedNodes).some(n=>
       n.nodeType===1&&n.namespaceURI!=='http://www.w3.org/2000/svg'&&!n.matches?.('.aurel-share-control,.aurel-favourite-control'))))
     scheduleDecorate();
 });
 for(const id of ['screen','overlay']){
  const el=document.getElementById(id);
  if(el)observer.observe(el,{childList:true,subtree:true});
 }
}
window.AurelShare={linkFor,share,decorate};
scheduleDecorate();
})();