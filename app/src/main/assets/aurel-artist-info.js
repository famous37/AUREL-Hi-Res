/* AUREL artist information: full Qobuz biography, no invented metadata.
 * A fixed accessible dialog survives asynchronous discography rerenders.
 * Loaded after navigation to handle Android Back without breaking history. */
(function installArtistInfo(){
 'use strict';
 const ID='aurel-artist-info-modal';
 let activeArtist='',previousFocus=null;
 const root=()=>document.getElementById(ID);
 const source=()=>window.AurelArtistInfoData?.(activeArtist);
 function refresh(id){
   if(!activeArtist||String(id)!==activeArtist)return;
   const layer=root(),info=source();
   if(!layer||!info){close();return;}
   const name=layer.querySelector('[data-aurel-artist-name]');
   const body=layer.querySelector('[data-aurel-biography]');
   const status=layer.querySelector('[data-aurel-artist-info-status]');
   if(name&&name.textContent!==info.name)name.textContent=info.name;
   if(!body||!status)return;
   const biography=info.biography||'';
   if(biography){
     if(body.dataset.rawBiography!==biography){
       const position=body.scrollTop;
       body.textContent=biography;
       body.dataset.rawBiography=biography;
       body.scrollTop=position;
     }
     status.textContent='';
     body.hidden=false;
   }else{
     body.hidden=true;
     body.dataset.rawBiography='';
     status.textContent=info.loading?'Loading biography…':
       info.error?'Biography unavailable. Please try again later.':
       'No biography provided by Qobuz.';
   }
 }
 function close(){
   const layer=root();
   if(!layer)return false;
   if(layer.classList.contains('is-closing'))return true;
   const target=previousFocus;
   activeArtist='';
   layer.classList.add('is-closing');
   const finalize=()=>{
     // If a new artist sheet opened meanwhile, leave its state alone.
     if(root()!==layer)return;
     layer.remove();
     document.documentElement.classList.remove('aurel-artist-info-open');
     previousFocus=null;
     if(target?.isConnected)try{target.focus({preventScroll:true});}catch(_){}
   };
   const reduced=document.documentElement.dataset.aurelMotion==='off'||
     !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
   if(reduced)finalize();
   else window.setTimeout(finalize,200);
   return true;
 }
 function open(){
   if(app.selectedKind!=='artist'||!app.selected?.id)return;
   const artistId=String(app.selected.id);
   if(root()){
     if(activeArtist===artistId&&!root().classList.contains('is-closing'))return;
     root().remove();
     document.documentElement.classList.remove('aurel-artist-info-open');
     activeArtist='';previousFocus=null;
   }
   const layer=document.createElement('div');
   layer.id=ID;
   layer.className='aurel-artist-info-overlay';
   layer.innerHTML='<section class="aurel-artist-info-dialog" role="dialog"'+
     ' aria-modal="true" aria-labelledby="aurel-artist-info-title" tabindex="-1">'+
     '<header class="aurel-artist-info-header">'+
     '<h2 id="aurel-artist-info-title">About artist</h2>'+
     '<button type="button" data-artist-info-close aria-label="Close artist information">'+
     ic('close')+
     '</button></header>'+
     '<h3 class="aurel-artist-info-name" data-aurel-artist-name></h3>'+
     '<p class="aurel-artist-info-status" data-aurel-artist-info-status role="status"></p>'+
     '<div class="aurel-artist-info-biography" data-aurel-biography tabindex="0"></div>'+
     '</section>';
   previousFocus=document.activeElement;
   activeArtist=artistId;
   document.body.appendChild(layer);
   document.documentElement.classList.add('aurel-artist-info-open');
   refresh(artistId);
   layer.querySelector('.aurel-artist-info-dialog')?.focus({preventScroll:true});
 }
 document.addEventListener('click',function(e){
   const target=e.target;
   if(target?.closest?.('[data-artist-info-open]')){
     e.preventDefault();e.stopImmediatePropagation();open();return;
   }
   const layer=root();
   if(!layer)return;
   if(target===layer||target?.closest?.('[data-artist-info-close]')){
     e.preventDefault();e.stopImmediatePropagation();close();
   }
 },true);
 document.addEventListener('keydown',function(e){
   const layer=root();
   if(!layer)return;
   if(e.key==='Escape'||e.key==='Backspace'&&e.target.tagName!=='INPUT'){
     e.preventDefault();e.stopImmediatePropagation();close();return;
   }
   if(e.key!=='Tab')return;
   const focusables=Array.from(layer.querySelectorAll('button,[tabindex="0"]'))
     .filter(n=>!n.hidden);
   if(!focusables.length)return;
   const first=focusables[0],last=focusables[focusables.length-1];
   if(e.shiftKey&&document.activeElement===first){
     e.preventDefault();last.focus();
   }else if(!e.shiftKey&&document.activeElement===last){
     e.preventDefault();first.focus();
   }
 },true);
 const previousBack=window.AurelBack;
 window.AurelBack=function(){
   if(close())return;
   return previousBack?.apply(this,arguments);
 };
 // Exposed only for the Qobuz artist data completion hook.
 window.AurelArtistInfoRefresh=refresh;
 window.AurelArtistInfo={open,close,isOpen:()=>!!root()};
})();
