'use strict';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeCover=url=>{try{let u=new URL(String(url||''));return u.protocol==='https:'&&(u.hostname==='qobuz.com'||u.hostname.endsWith('.qobuz.com'))?u.href:''}catch(_){return ''}};
// Small covers for lists, full-size artwork for the actual Now Playing view.
const image=(o,size='full')=>{
 const keys=size==='thumb'?['medium','small','thumbnail','large','extralarge','default']:
                           ['large','extralarge','medium','small','thumbnail','default'];
 for(const obj of [o?.image,o?.album?.image,o?.picture,o?.cover]){
  if(typeof obj==='string'){const direct=safeCover(obj);if(direct)return direct;}
  if(obj&&typeof obj==='object'){
   for(const key of keys){const url=safeCover(obj[key]||obj.images?.[key]);if(url)return url;}
  }
 }
 return '';
};
const withAlbum=(tracks,album)=>tracks.map(t=>({...t,
  album:{...(t.album||{}),id:t.album?.id||album?.id,image:t.album?.image||album?.image,
    title:t.album?.title||album?.title,artist:t.album?.artist||album?.artist,
    artists:t.album?.artists||album?.artists},
  image:t.image||t.album?.image||album?.image,
  artist:t.artist||t.performer||t.album?.artist||album?.artist||album?.artists?.items?.[0]}));
// Qobuz releases and tracks may encode an artist as an object, array, display-name
// object, or nested list. Do not label a known artist as Unknown merely because a
// shallow 'artist.name' field is absent from one endpoint.
// Provider names can be objects, arrays, and even JSON-serialized strings.
// Keep catalogue titles intact but never print provider objects verbatim.
const nameOf=(o,depth=0)=>{
 if(depth>5||o==null)return '';
 if(typeof o==='string'){
  const value=o.trim();
  if(value.startsWith('{')||(value.startsWith('[')&&value.endsWith(']'))){
   try{return nameOf(JSON.parse(value),depth+1);}catch(_){return '';}
  }
  return value;
 }
 if(Array.isArray(o))return o.slice(0,8).map(v=>nameOf(v,depth+1)).filter(Boolean).join(', ');
 if(typeof o!=='object')return '';
 for(const v of [o.display,o.name,o.display_name,o.displayName,o.full_name,
                 o.artist_name,o.title,o.artist,o.performer,o.items]){
  const found=nameOf(v,depth+1);
  if(found)return found;
 }
 return '';
};
const trackTitle=t=>nameOf(t?.title)||'Untitled';
const artistChoices=o=>[o?.artist,o?.album?.artist,o?.main_artist,o?.mainArtist,o?.performer,o?.performers?.items?.[0],
 o?.artists?.items?.[0],Array.isArray(o?.artists)?o.artists[0]:null,
 o?.artists?.main?.[0],o?.artist_name,o?.main_artist_name,
 o?.album?.artist,o?.album?.artist_name,o?.album?.main_artist,o?.album?.performer,o?.album?.artists?.items?.[0],
 Array.isArray(o?.album?.artists)?o.album.artists[0]:null];
const artistName=o=>nameOf(o)||nameOf(o?.artist)||nameOf(o?.performer)||'Artist not provided';
const artist=o=>artistChoices(o).map(v=>nameOf(v)).find(Boolean)||'';
const artistId=o=>{
 for(const candidate of artistChoices(o)){
  const id=candidate&&typeof candidate==='object'?(candidate.id??candidate.artist_id):null;
  if(id!=null&&/^\d+$/.test(String(id)))return String(id);
 }
 for(const id of [o?.artist_id,o?.main_artist_id,o?.album?.artist_id])if(id!=null&&/^\d+$/.test(String(id)))return String(id);
 return '';
};
const artistLabel=o=>artist(o)||'Artist information unavailable';
const duration=n=>{n=Math.max(0,Math.floor(Number(n)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`};
const qualityText=q=>({'5':'MP3 · 320 kbps','6':'FLAC · 16-bit / 44.1 kHz','7':'Hi-Res · up to 24-bit / 96 kHz','27':'Hi-Res · up to 24-bit / 192 kHz'})[q]||'Automatic';
const fallbackArt=`<div class="cover"><div style="position:absolute;inset:10%;border-radius:50%;border:22px solid #8f657555;box-shadow:0 0 60px #c08c9955"></div></div>`;
const art=(o,cl='')=>{
 const hero=/artist-image|aurel-artist-photo|album-hero-art/.test(cl);
 const src=image(o,hero?'full':'thumb');
 return src?`<img class="${cl}" loading="${hero?'eager':'lazy'}" decoding="async" ${hero?'fetchpriority="high"':''} src="${html(src)}" alt="Album art">`:'';
};
const app={nav:'home',loginMode:'token',loginTarget:'stream',session:null,albums:[],results:[],searchQuery:'',searchType:'tracks',libType:'albums',selected:null,selectedTracks:[],searchBusy:false,player:null,overlay:false,dragging:false};
let sequence=1;const waiting=new Map();
function nativeCall(action,data={}){
 return new Promise((resolve,reject)=>{
  if(!window.AurelNative){reject(new Error('Android-only function: open inside the APK'));return;}
  const id=String(sequence++); const timer=setTimeout(()=>{waiting.delete(id);reject(new Error('Qobuz did not respond in time'))},65000);
  waiting.set(id,{resolve,reject,timer});
  try{window.AurelNative.call(id,action,JSON.stringify(data))}catch(e){clearTimeout(timer);waiting.delete(id);reject(e)}
 });
}
window.AurelReceive=(id,reply)=>{
 const pending=waiting.get(String(id));if(!pending)return;
 clearTimeout(pending.timer);waiting.delete(String(id));
 reply?.ok?pending.resolve(reply.data):pending.reject(new Error(reply?.error||'Unknown API error'));
};
window.AurelEvent=(kind,data)=>{
 if(kind==='mornyeVerificationResult'){
   if(data?.streamRecovery){
     // Automatic re-verification keeps the same screen, queue and selection.
     if(data?.connected){
       app.session=data;
       showToast('Mornye session verified',4500);
       if(data?.catalogRecovery){
         // Retry whichever catalogue view was visible before the session
         // expired. Artist extras have a separate cache that must be cleared.
         if(app.selected?.id&&app.selectedKind==='artist'){
           const id=String(app.selected.id);
           window.AurelResetArtistMetadata?.(id);
           openArtist(id);
         }else if(app.selected?.id&&app.selectedKind==='album'){
           openAlbum(String(app.selected.id));
         }else if(app.nav==='search'&&app.searchQuery){
           search();
         }else if(app.nav==='home'){
           loadHome();
         }else{
           render();
         }
       }
     }else{
       app.session={...(app.session||{}),...data,gatewayPlaybackRejected:true};
       showToast(data?.error||'Mornye verification did not complete',6500);
       if(app.nav==='settings')renderSettings();
     }
     return;
   }
   if(data?.connected){
     app.session=data;app.results=[];app.albums=[];app.loginTarget='stream';
     showToast('Mornye gateway session verified',4500);
     navigate('home');
   }else{
     app.loginMode='mornye';app.loginTarget='stream';renderLogin();
     const field=$('#mornyeLoginError');
     if(field){field.textContent=data?.error||'Mornye gateway did not authorize the session.';field.classList.remove('hidden');}
   }
   return;
 }
 if(kind==='session'){
  // Media routing, digital headroom and preload emit full session snapshots.
  // Do not rebuild the active Settings DOM for every asynchronous update:
  // it would reset toggles, focus, open sections and scroll position.
  const before=app.session||{};
  const next=window.AurelPreferenceSync?.reconcileSession(data)||data;
  app.session=next;
  const fields=['loggedIn','streamConnected','libraryConnected',
    'mornyeConnected','mornyeConfigured','gatewayPlaybackRejected',
    'streamValidation','libraryValidation','authMode','streamUserId',
    'libraryUserId','hasSecret','hasLibrarySecret'];
  const structural=fields.some(key=>before[key]!==next[key])||
    (before.profile?.displayName||'')!==(next.profile?.displayName||'')||
    (before.profile?.subscription||'')!==(next.profile?.subscription||'');
  if(structural&&(app.nav==='home'||app.nav==='settings'))render();
  else if(app.nav==='settings')window.AurelPreferenceSync?.refreshControls();
  return;
 }
 if(kind==='player'){
  const changed=app.player?.track?.id!==data?.track?.id || app.player?.error!==data?.error;
  app.player=data;
  updateMini();
  if(app.overlay){if(changed)drawOverlay();else updateOverlayState()}
  if(data?.error && data?.error!==app.lastPlayerError){app.lastPlayerError=data.error;showToast(data.error,6000)}
 }
};
window.AurelBack=()=>{if(app.overlay){app.overlay=false;drawOverlay();return;}if(app.selected){app.selected=null;app.selectedTracks=[];render();return;}navigate('home')};
function showToast(msg,ms=3600){
 const t=$('#toast'),message=String(msg??'').trim();if(!t||!message)return;
 const now=Date.now();if(showToast.previous===message&&now-showToast.when<1800)return;
 showToast.previous=message;showToast.when=now;
 t.replaceChildren();
 const label=document.createElement('span');label.className='aurel-toast-message';label.textContent=message;t.appendChild(label);
 if((app.session?.mornyeConnected||app.session?.mornyeConfigured)&&/mornye|zarz|gateway|verification|session grant/i.test(message)&&!/rate limit|try again|too many requests|cooldown/i.test(message)){
  const action=document.createElement('button');action.type='button';action.textContent='Verify';
  action.className='aurel-toast-action';action.setAttribute('data-reverify-mornye','');t.appendChild(action);
 }
 const close=document.createElement('button');close.type='button';close.className='aurel-toast-close';
 close.textContent='×';close.setAttribute('aria-label','Dismiss notification');
 close.setAttribute('data-dismiss-aurel-toast','');t.appendChild(close);
 t.setAttribute('role',/error|fail|unavailable|limit|rejected|expired|verification|try again/i.test(message)?'alert':'status');
 t.classList.remove('hidden');t.classList.add('aurel-toast-visible');
 clearTimeout(showToast.t);
 showToast.t=setTimeout(()=>{t.classList.remove('aurel-toast-visible');setTimeout(()=>{
  if(!t.classList.contains('aurel-toast-visible'))t.classList.add('hidden');
 },240);},Math.max(3000,Math.min(12000,Number(ms)||3600)));
}
async function api(action,params={},quiet=false){try{return await nativeCall(action,params)}catch(e){if(!quiet)showToast(e.message,6000);throw e}}
const sliceItems=(body,key)=>{if(!body)return[];const o=key?body[key]:body;return Array.isArray(o)?o:Array.isArray(o?.items)?o.items:Array.isArray(body.items)?body.items:[]};
const hasAuth=()=>!!((app.session?.streamConnected&&app.session?.streamValidation!=='rejected')||app.session?.libraryConnected);
function title(name,subtitle){return `<div class="eyebrow">AUREL / ${html(name)}</div><h1 class="headline">${html(subtitle)}</h1>`}
function banner(){return `<div class="hero"><div class="content"><div class="eyebrow" style="color:#f3b8a9">HI-RES WITHOUT COMPROMISE</div><h2>Hear the music.<br>Feel everything.</h2><p>Uncompressed detail, thoughtful discovery and a listening space made for music lovers.</p><button class="pill" data-nav="search">Explore music <span>↗</span></button></div></div>`}
function albumCards(items){if(!items.length)return `<div class="empty"><strong>Nothing to show yet</strong>Search for your favourite artists or explore another section.</div>`;
 return `<div class="cards">${items.map((o,i)=>{
   let name=o.title||o.name||'Untitled';let rawId=html(o.id||'');let cd=art(o);
   return `<article class="albumcard" data-open-album="${rawId}"><div class="cover">${cd}<span class="hoverplay">▶</span></div><div class="album-title">${html(name)}</div><div class="album-artist">${html(artistLabel(o))}</div>${o.hires||Number(o.maximum_bit_depth)>16?`<span class="audio-badge">HI-RES AUDIO</span>`:''}</article>`;
 }).join('')}</div>`
}
function listTracks(items){if(!items.length)return '<div class="empty">No tracks found.</div>';
 return '<div class="tracklist">'+items.map((o,i)=>{
  const access=window.AurelTrackAccess?.status(o)||{playable:true,reason:''};
  const unavailable=!access.playable;
  const reason=html(access.reason||'Not available for streaming');
  const status=unavailable?'<div class="aurel-track-unavailable" role="note">'+
    (access.future?'Coming soon':'Unavailable')+
    (access.date?' · '+html(access.date):'')+'</div>':'';
  return '<div class="track '+(unavailable?'aurel-unavailable-track':'')+'" data-aurel-track-id="'+html(o.id||'')+'">'+
   '<span class="index">'+(i+1)+'</span>'+(art(o,'track-art')||'<div class="track-art"></div>')+
   '<div class="track-details" '+(unavailable?'':'data-play-index="'+i+'"')+'><div class="track-title">'+html(o.title||'Untitled')+'</div>'+
   '<div class="track-meta">'+html(artistLabel(o))+(o.album?.title?' · '+html(o.album.title):'')+'</div>'+status+'</div>'+
   '<span class="track-length">'+duration(o.duration)+'</span>'+
   '<button class="icon-btn aurel-track-action" aria-label="Add to favourites" title="Add to favourites" data-like-track="'+html(o.id||'')+'">'+ic('heart',24)+'</button>'+
   '<button class="icon-btn queue-add-icon aurel-track-action" data-play-next="'+i+'" aria-label="'+(unavailable?reason:'Play next')+'" title="'+(unavailable?reason:'Play next')+'" '+(unavailable?'disabled':'')+'>'+ic('plus',24)+'</button>'+
   '<button class="icon-btn aurel-track-action" data-play-index="'+i+'" aria-label="'+(unavailable?reason:'Play track')+'" title="'+(unavailable?reason:'Play')+'" '+(unavailable?'disabled':'')+'>'+ic('play',25)+'</button></div>';
 }).join('')+'</div>';
}
function render(){
 $$('.nav,.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===app.nav));

 if(!hasAuth()&&app.nav!=='settings'){renderLogin();return;}
 if(app.selected){if(app.selectedKind==='artist')renderArtist();else renderAlbum();return;}
 switch(app.nav){case 'home':renderHome();break;case 'magazine':renderMagazine();break;case 'search':renderSearch();break;case 'library':renderLibrary();break;case 'playlists':renderPlaylists();break;case 'settings':renderSettings();break;default:renderHome()}
}
function renderHome(){
 $('#screen').innerHTML=`<div style="padding:8px 0 21px"><div class="eyebrow">WELCOME TO YOUR LISTENING ROOM</div><h1 class="headline">Discover something<br>extraordinary<span style="color:var(--accent)">.</span></h1><div class="subline">Editorial warmth. Exceptional sound. Your music, your way.</div></div>${banner()}
 <div class="sectionhead"><div><h2>Fresh releases</h2><p>New arrivals across the Qobuz catalogue</p></div><span class="tag">LOSSLESS &amp; HI-RES</span></div>
 ${app.albums.length?albumCards(app.albums):'<div class="empty"><strong>Your discovery feed</strong>Sign in with a working Qobuz token to load recent releases.<br><button class="pill secondary" data-refresh>Try again</button></div>'}
 <p class="footer-note">Streaming and available quality depend on your active Qobuz subscription, the catalogue and API access.</p>`;
}
function renderSearch(){
 $('#screen').innerHTML=title('DISCOVER','What moves you?')+`<div class="subline">Artists, albums, and every track worth hearing.</div>
 <form id="searchForm" class="searchbox"><span>⌕</span><input id="searchInput" placeholder="Search tracks, albums, artists…" autocomplete="off" value="${html(app.searchQuery)}" autofocus></form>
 <div class="tabs">${['tracks','albums','artists'].map(t=>`<button class="tab ${app.searchType===t?'active':''}" data-search-type="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
 <div id="searchResults">${app.searchBusy?'<div class="loading"><div class="pulse"></div>Searching catalogue…</div>':searchResults()}</div>`;
}
function searchResults(){if(!app.searchQuery)return '<div class="empty"><strong>Find your next favourite</strong>Search Qobuz by artist, album or track.</div>';
 if(!app.results.length)return '<div class="empty">No results. Try a different search.</div>';
 if(app.searchType==='tracks')return listTracks(app.results);
 if(app.searchType==='artists')return artistRows(app.results);
 return albumCards(app.results);
}
function artistRows(items){if(!items.length)return '<div class="empty">No artists found.</div>';
 return `<div class="artistrows">${items.map(o=>`<button class="artistrow" data-open-artist="${html(o.id||'')}">${art(o,'artist-avatar')||'<span class="artist-avatar artist-placeholder">♫</span>'}<span class="artist-text"><strong>${html(artistName(o))}</strong><small>Artist · Discography</small></span><span class="chevron">›</span></button>`).join('')}</div>`;
}
function renderLibrary(){
 $('#screen').innerHTML=title('YOUR COLLECTION','The music you love.')+`<div class="subline">Your Qobuz favourites, always close.</div>
 <div class="tabs"><button class="tab ${app.libType==='albums'?'active':''}" data-lib-type="albums">Albums</button><button class="tab ${app.libType==='tracks'?'active':''}" data-lib-type="tracks">Tracks</button><button class="tab ${app.libType==='artists'?'active':''}" data-lib-type="artists">Artists</button></div>
 <div id="libraryContent">${app.libraryLoading?'<div class="loading"><div class="pulse"></div>Loading favourites…</div>':app.libType==='tracks'?listTracks(app.libraryItems||[]):app.libType==='albums'?albumCards(app.libraryItems||[]):artistRows(app.libraryItems||[])}</div>`;
}
function renderPlaylists(){
 const lists=app.playlists||[];
 $('#screen').innerHTML=title('YOUR LIBRARY','Playlists.')+`<p class="subline">Made by you. Collected for every mood.</p><div class="sectionhead"><h2>My playlists</h2></div>
 ${app.playlistsLoading?'<div class="loading"><div class="pulse"></div>Loading playlists…</div>':lists.length?`<div class="tracklist">${lists.map(o=>`<div class="track"><div class="track-details" data-playlist-id="${html(o.id)}"><div class="track-title">${html(o.name)}</div><div class="track-meta">${o.tracks_count||0} tracks</div></div><button class="icon-btn aurel-playlist-open" data-playlist-id="${html(o.id)}">${ic('chevron',23)}</button></div>`).join('')}</div>`:'<div class="empty">No Qobuz playlists returned by your account.</div>'}`;
}
function renderAlbum(){
 let o=app.selected;
 if(!o)return;
 let content=`<button class="small-link" data-back>${ic('back',20)}<span>Back</span></button><div class="albumhero"><div class="cover">${art(o,"album-hero-art")}</div><div class="details"><div class="eyebrow">${app.selectedKind==='playlist'?'PLAYLIST':'ALBUM'}</div><h1>${html(o.title||o.name||'Untitled')}</h1><button class="album-artist-button" data-artist-from-album aria-label="Open artist discography">${html(artistLabel(o))}<span aria-hidden="true">${ic('chevron',20)}</span></button><div class="subline" style="margin-top:7px">${app.selectedTracks.length} tracks ${Number(o.maximum_bit_depth)>16?' · HI-RES':''}</div></div></div>
 <div class="actionbar"><button class="pill" data-play-all>${ic('play',20)}<span>Play album</span></button><button class="pill secondary" data-like-album="${html(o.id)}">${ic('heart',20)}<span class="aurel-save-label">Save</span></button></div>
 ${listTracks(app.selectedTracks)}<p class="footer-note">Availability and stream quality are verified when playback is requested. Direct-file streaming only in this alpha build.</p>`;
 $('#screen').innerHTML=content;
}
function renderArtist(){let o=app.selected||{},albums=sliceItems(o,'albums');
 $('#screen').innerHTML=`<button class="small-link" data-back>${ic('back',20)}<span>Back</span></button><div class="artist-hero">${art(o,'artist-image')||'<div class="artist-image artist-placeholder">♫</div>'}<div><div class="eyebrow">ARTIST</div><h1>${html(artistName(o))}</h1><p class="subline">Browse albums and listen using your connected streaming account.</p></div></div><div class="sectionhead"><h2>Discography</h2><span class="discography-count">${albums.length} releases</span></div>${albumCards(albums)}${albums.length>=Number(o.albums?.limit||100)&&albums.length<Number(o.albums?.total||albums.length)?`<button class="load-more-albums" data-load-more-artist>Show more releases</button>`:``}`;
}
function renderLogin(){
  const secondary=app.loginTarget==='library';
  const savedAppId=secondary?app.session?.libraryAppId:app.session?.appId;
  const savedUserId=secondary?app.session?.libraryUserId:app.session?.streamUserId;
  const rejected=secondary?app.session?.libraryValidation==='rejected':app.session?.streamValidation==='rejected';
  const appId=rejected?'':(savedAppId||'');
  const passwordMode=app.loginMode==='password';
  const webMode=app.loginMode==='mornye'&&!secondary;
  if(webMode){
    $('#screen').innerHTML=`<div class="auth-shell aurel-signin">
      <div class="aurel-signin-symbol" aria-hidden="true">a<span>.</span></div>
      <div class="eyebrow">AUREL / MORNYE</div><h1>Connect with Mornye.</h1>
      <p class="aurel-signin-subtitle">Direct Mornye signed session, with no Qobuz browser sign-in.</p>
      <div class="aurel-login-methods" role="tablist" aria-label="Sign-in method">
        <button type="button" role="tab" aria-selected="false" data-login-mode="token">${ic('key',19)} Token</button>
        <button type="button" role="tab" aria-selected="false" data-login-mode="password">${ic('user',19)} Password</button>
        <button type="button" role="tab" aria-selected="true" class="active" data-login-mode="mornye">${ic('globe',19)} Mornye</button>
      </div>
      <button class="aurel-signin-submit" type="button" data-connect-mornye>${ic('shield-check',23)} Connect Mornye session</button>
      <div id="mornyeLoginError" class="aurel-signin-error hidden" role="alert"></div>
      <section class="aurel-mornye-status"><div class="aurel-mornye-header"><strong>Native signed session</strong></div>
        <p>AUREL uses the public Mornye signedSession@3 protocol with the Zarz gateway, verifying catalogue access before connecting. This gateway session is not a personal Qobuz account.</p>
        <p>When the gateway asks for a one-time grant or CAPTCHA, AUREL opens the Zarz verification page inside the app, then exchanges the approved grant securely. Qobuz Web Player is never opened.</p>
        <p>For personal playlists and favourites, connect a separate Qobuz account in Settings.</p>
      </section>
    </div>`;
    return;
  }
  $('#screen').innerHTML=`<div class="auth-shell aurel-signin">
    <div class="aurel-signin-symbol" aria-hidden="true">a<span>.</span></div>
    <div class="eyebrow">AUREL / QOBUZ</div>
    <h1>${secondary?'Connect your Qobuz library.':'Welcome back to music.'}</h1>
    <p class="aurel-signin-subtitle">${secondary?'Sign in to your personal Qobuz library using your password or a matching token and App ID. A successful Qobuz sign-in replaces Mornye; the library remains available even when playback is not confirmed.':'Sign in with your email or username and password, or with a matching account token and App ID. Your personal library loads automatically.'}</p>
    ${rejected?'<div class="aurel-auth-warning" role="alert"><strong>Previous Qobuz authorization was rejected.</strong><span>Try the current web App ID automatically, a fresh token, or email/password sign-in. Your previous account data has not been erased.</span></div>':''}
    ${app.session?.previewBuild?'<p class="auth-preview-note">This Preview is installed separately and cannot read credentials stored by other AUREL installations.</p>':''}
    <div class="aurel-login-methods" role="tablist" aria-label="Sign-in method">
      <button type="button" role="tab" aria-selected="${!passwordMode}" class="${passwordMode?'':'active'}" data-login-mode="token">${ic('key',19)} Session token</button>
      <button type="button" role="tab" aria-selected="${passwordMode}" class="${passwordMode?'active':''}" data-login-mode="password">${ic('user',19)} Password</button>
      ${secondary?'':`<button type="button" role="tab" aria-selected="false" data-login-mode="mornye">${ic('globe',19)} Mornye</button>`}
    </div>
    <form id="loginForm" class="aurel-signin-form">
      ${passwordMode?`
        <label class="aurel-token-label" for="email">Qobuz email or username</label>
        <input id="email" class="aurel-login-textbox" type="text" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Email or Qobuz username" required>
        <label class="aurel-token-label" for="password">Password</label>
        <div class="aurel-token-input">
          <input id="password" type="password" autocomplete="current-password" placeholder="Enter Qobuz password" required>
          <button type="button" data-toggle-password aria-label="Show password">${ic('eye',22)}</button>
        </div>
        <p class="aurel-method-help">${secondary?'Qobuz may reject third-party password login (HTTP 401/403). Use a compatible App ID or a session token if required. Passwords are not saved.':'Qobuz may require CAPTCHA or reject third-party password login. Try a compatible App ID or your own session token. Passwords are not saved.'}</p>`:`
        <label class="aurel-token-label" for="token">Qobuz session token</label>
        <div class="aurel-token-input">
          <input id="token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste X-User-Auth-Token" required>
          <button type="button" data-toggle-token aria-label="Show token">${ic('eye',22)}</button>
        </div>
        <p class="aurel-method-help">A token is accepted only with its compatible App ID. Leave App ID empty to detect the Qobuz web ID, or enter the App ID used to obtain your token.</p>`}
            <details class="aurel-signin-advanced" open>
        <summary>${ic('settings',19)} Advanced · App ID, App Secret &amp; User ID ${ic('chevron',17)}</summary>
        <div class="aurel-advanced-fields">
          <label for="appId">App ID <small>Leave blank for automatic detection from Qobuz's current web player</small></label>
          <input id="appId" type="text" inputmode="numeric" autocomplete="off" value="${html(appId)}" placeholder="Auto-detect from Qobuz website">
          <label for="appSecret">App Secret <small>Optional for token/password login; only needed for compatible signed stream requests</small></label>
          <div class="aurel-token-input"><input id="appSecret" type="password" autocomplete="off" placeholder="${(secondary?app.session?.hasLibrarySecret:app.session?.hasSecret)?'Saved on device · leave blank to keep':'Optional App Secret'}"><button type="button" data-toggle-secret aria-label="Show App Secret">${ic('eye',22)}</button></div>
          <label for="userId">User ID <small>Optional; leave blank unless needed by your Qobuz integration</small></label>
          <input id="userId" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${html(savedUserId||'')}" placeholder="Optional account ID">
        </div>
      </details>
      <div class="aurel-signin-info">${ic('shield-check',18)} <span>${secondary?'Library login uses your own Qobuz credentials. The separate library token is encrypted on this device; the password is not stored.':'Qobuz checks credentials. AUREL encrypts the issued token and never saves your password.'}</span></div>
      <div id="loginError" class="aurel-signin-error hidden" role="alert"></div>
      <div class="aurel-login-footer"><button type="button" class="small-link" data-open-qobuz-web>Open official Qobuz sign-in</button> · <button type="button" class="small-link" data-login-mode="token">Use session token</button></div>
      <button id="loginSubmit" type="submit" class="aurel-signin-submit">${secondary?'Connect library account':'Sign in & load library'} ${ic('chevron',21)}</button>
    </form>
    <div class="aurel-login-footer">${secondary?'<button class="small-link" data-cancel-library>Back to settings</button>':''}</div>
  </div>`;
}
function renderSettings(){if(!hasAuth()&&!app.session?.mornyeConfigured){app.loginTarget='stream';renderLogin();return;}
 let p=app.session.profile||{},lp=app.session.libraryProfile||{};
 const bp=app.session.bitPerfect||{enabled:false,status:'off',detail:'Standard Android playback'};
 const bpLabels={off:'Standard playback',android_version:'Android 14+ required',no_usb:'Waiting for USB DAC',waiting_track:'Waiting for a track',unknown_format:'Track format unknown',unsupported_format:'Format not supported',unsupported:'Not supported',rejected:'Mixer request rejected',requested:'USB mixer requested',usb_mixer_routed:'USB mixer routed'};
 const bpStatus=bpLabels[bp.status]||'Checking USB output';
 // Render concise, truthful device-state explanations; raw native diagnostic
 // strings are still retained in session but need not crowd the settings UI.
 const bpExplanations={
  off:'',
  android_version:'Android 14 or newer required.',
  no_usb:'Connect a compatible USB DAC.',
  waiting_track:'Play a lossless track to check USB output.',
  unknown_format:'Track audio format cannot be verified.',
  unsupported_format:'Android offers no matching bit-perfect USB mixer format.',
  unsupported:'USB mixer controls are unavailable on this device.',
  rejected:'Android rejected the USB mixer request.',
  requested:'USB mixer preference accepted; PCM bit identity unverified.',
  usb_mixer_routed:'USB audio routed; PCM bit identity unverified.'
 };
 const bpDescription=Object.prototype.hasOwnProperty.call(bpExplanations,bp.status)
  ?bpExplanations[bp.status]:(bp.detail||'');
 $('#screen').innerHTML=`<div class="aurel-settings-heading"><button type="button" data-nav="home" aria-label="Back to Discover">${ic('back',25)}</button><h1>Settings <span>/ Audio &amp; Account</span></h1></div><div class="panel"><h3>Streaming account</h3>
 ${app.session.gatewayPlaybackRejected?`<div class="aurel-gateway-warning" role="status"><strong>Streaming verification needed</strong><span>The Zarz gateway rejected audio playback. Catalogue access alone does not confirm streaming authorization.</span><button class="pill secondary" data-reverify-mornye>Verify Mornye session</button></div>`:'' }
<div class="info-row"><span>Connected</span><strong>${app.session.streamConnected?'● Saved':'Not connected'}</strong></div>
 <div class="info-row"><span>Session verification</span><strong>${app.session.mornyeConnected?'Mornye catalogue verified · playback depends on Zarz':app.session.streamValidation==='verified'?'Verified by Qobuz':app.session.streamValidation==='playback'?'Playback confirmed':app.session.streamValidation==='unverified'?'Not verified · test playback':app.session.streamValidation==='rejected'?'Rejected · check token and App ID':'Not checked'}</strong></div>
 <div class="info-row"><span>Profile</span><strong>${html(p.displayName||'—')}</strong></div>
 <div class="info-row"><span>User ID</span><strong>${html(p.userId||'Not verified')}</strong></div>
 <div class="info-row"><span>Subscription</span><strong>${html(p.subscription||'Not verified')}${p.verifiedSubscription?' ✓':''}</strong></div>
 <div class="info-row"><span>Connection type</span><strong>${app.session.mornyeConnected?'Mornye signed gateway':'Qobuz account'}</strong></div>
  <div class="info-row"><span>App ID</span><strong>${html(app.session.mornyeConnected?'Gateway-managed':app.session.appId||'—')}</strong></div>
 <div class="aurel-account-actions"><button class="pill secondary" data-validate-stream>${app.session.mornyeConnected?'Check Mornye gateway':'Check Qobuz connection'}</button>${app.session.mornyeConfigured?'<button class="pill secondary" data-reverify-mornye>Reverify Mornye</button>':''}<button class="pill secondary" data-change-stream>${app.session.streamConnected?'Change streaming account':'Connect streaming account'}</button></div></div>
 ${app.session.libraryConnected&&!app.session.streamConnected?'<div class="auth-status-banner" role="status"><strong>Account connected but streaming was not verified. You can browse your library; connect a compatible playback account to listen.</strong></div>':''}
 <div class="panel"><h3>Personal Qobuz library</h3>
 <div class="info-row"><span>Library account</span><strong>${app.session.libraryConnected?html(lp.displayName||lp.userId||'Connected'):'Uses streaming account'}</strong></div>
 <button class="pill secondary" data-add-library>${app.session.libraryConnected?'Change library account':'Connect separate library'}</button>
 ${app.session.libraryConnected?'<button class="small-link" data-logout-library style="margin-left:18px">Disconnect library</button>':''}</div>
 <div class="panel"><h3>Streaming quality</h3>
 <div class="selectrow" role="group" aria-label="Streaming quality">${[5,6,7,27].map(q=>`<button type="button" class="quality ${app.session.quality===q?'selected':''}" data-quality="${q}" aria-pressed="${app.session.quality===q}"><strong>${q===5?'MP3':q===6?'CD Lossless':q===7?'Hi-Res':'Max Hi-Res'}</strong><small>${q===5?'320 kbps':q===6?'16 / 44.1':q===7?'24 / 96':'24 / 192'}</small></button>`).join('')}</div>
 <section class="aurel-bp-panel" aria-label="USB bit-perfect playback setting">
   <div class="aurel-bp-heading"><div><h3>Bit-perfect USB</h3><p>Android 14+ · USB DAC required</p></div>
     <button type="button" data-bit-perfect-toggle class="aurel-bp-switch ${bp.enabled?'is-on':''}" role="switch" aria-checked="${bp.enabled?'true':'false'}" aria-label="Enable bit-perfect USB output" title="Toggle bit-perfect USB output"><span aria-hidden="true"></span></button>
   </div>
   <div class="aurel-bp-status" role="status"><span class="aurel-bp-dot ${bp.status==='usb_mixer_routed'?'is-routed':bp.status==='requested'?'is-requested':''}" aria-hidden="true"></span><strong>${html(bpStatus)}</strong></div>
   ${bpDescription?`<p class="aurel-bp-detail">${html(bpDescription)}</p>`:''}
   
 </section>
 <div style="margin-top:20px"><label class="field">App Secret (stream authorization)
 <input id="newSecret" type="password" placeholder="${app.session.hasSecret?'Saved · enter to replace':'Required for signed stream URLs'}" autocomplete="off"></label>
 <button class="pill secondary" style="margin-top:12px" data-save-secret>Save secret</button></div></div>
 <div class="panel"><h3>About AUREL</h3><div class="info-row"><span>Developer</span><strong>famous37</strong></div><div class="info-row"><span>Version</span><strong>1.1.37</strong></div></div>
 <div class="panel"><button class="pill secondary" data-logout>Sign out of all accounts</button></div>`;
}
function updateMini(){
 let p=app.player,m=$('#mini');if(!p?.track?.id){m.classList.add('hidden');return}
 m.classList.remove('hidden');let t=p.track;
 m.innerHTML=`${art(t)||'<div class="track-art"></div>'}<div class="meta"><div class="title">${html(trackTitle(t))}</div><div class="artist">${html(artistLabel(t))}</div></div><span class="mini-quality">${p.bits?p.bits+'-bit / '+(p.sampleRate>1000?p.sampleRate/1000:p.sampleRate)+' kHz':qualityText(p.quality)}</span><button class="icon-btn" data-mini-next title="Next">⏭</button><button class="mini-play" data-mini-toggle>${p.playing?'Ⅱ':'▶'}</button>`;
}
function updateOverlayState(){let p=app.player;if(!p||!app.overlay)return;
 const progress=$('#progress');if(progress&&!app.dragging){progress.max=p.duration||100;progress.value=p.position||0}
 if($('#elapsed'))$('#elapsed').textContent=duration((p.position||0)/1000);
 if($('#remaining'))$('#remaining').textContent='-'+duration(Math.max(0,(p.duration||0)-(p.position||0))/1000);
 if($('#full-toggle'))$('#full-toggle').innerHTML=ic(p.playing?'pause':'play',33);
 if($('#full-shuffle'))$('#full-shuffle').classList.toggle('active',!!p.shuffle);
 if($('#full-repeat')){ $('#full-repeat').classList.toggle('active',p.repeat!==0);$('#full-repeat').innerHTML=ic('repeat',23)+(p.repeat===2?'<span class="repeat-one">1</span>':'');}
 if($('#playingStatus'))$('#playingStatus').textContent=p.buffering?'BUFFERING':p.error?'UNAVAILABLE':p.playing?'PLAYING':'PAUSED';
}
function drawOverlay(){const overlay=$('#overlay');if(!app.overlay){overlay.classList.add('hidden');overlay.innerHTML='';return;}
 let p=app.player||{},t=p.track||{},src=image(t);overlay.classList.remove('hidden');
 overlay.style.setProperty('--cover-image',src?`url("${src}")`:'none');
 overlay.innerHTML=`<div class="overlay-inner"><button class="back" data-close-overlay>⌄ <span>Now playing</span></button>
 <div class="art-stage">${src?`<img class="now-cover" src="${html(src)}" alt="Album cover">`:'<div class="now-cover empty-art">♫</div>'}</div>
 <div class="now-info"><span>${p.bits?(p.bits+'-bit / '+(p.sampleRate>1000?(p.sampleRate/1000):p.sampleRate)+' kHz'):'AUDIO QUALITY PENDING'}</span><span>${p.formatId===5?'MP3':p.formatId?'FLAC':''}</span></div>
 <div class="now-track-row"><div class="now-title">${html(t.title||'Choose a track')}</div><div class="now-artist">${html(artistLabel(t))}</div></div>
 <input id="progress" class="progress" type="range" min="0" max="${p.duration||100}" value="${p.position||0}" step="500"><div class="timebar"><span id="elapsed">${duration((p.position||0)/1000)}</span><span id="remaining">-${duration(Math.max(0,(p.duration||0)-(p.position||0))/1000)}</span></div>
 <div class="controls"><button id="full-shuffle" class="ctrl ${p.shuffle?'active':''}" data-shuffle>⤨</button><button class="ctrl" data-prev>❚◀</button><button id="full-toggle" class="main-play" data-full-toggle>${p.playing?'Ⅱ':'▶'}</button><button class="ctrl" data-next>▶❚</button><button id="full-repeat" class="ctrl ${p.repeat?'active':''}" data-repeat>${p.repeat===2?'↺¹':'↺'}</button></div>
 <div class="playing-foot"><span id="playingStatus">${p.buffering?'BUFFERING':p.error?'UNAVAILABLE':p.playing?'PLAYING':'PAUSED'}</span><span>QUEUE ${p.count?`${p.index+1} / ${p.count}`:'—'}</span></div>
 ${p.error?`<div class="playback-error">${html(p.error)}</div>`:''}</div>`;
}
async function navigate(page){
 // Android WebView can retain horizontal panning after a keyboard/input is
 // focused. Reset it on navigation so fixed tabs are not painted offscreen.
 const focus=document.activeElement;
 if(focus&&typeof focus.blur==='function')focus.blur();
 app.selected=null;app.selectedTracks=[];app.nav=page;
 render();
 // Restore saved vertical position after switching to this route.
 if(document.documentElement)document.documentElement.scrollLeft=0;
 if(document.body)document.body.scrollLeft=0;
 try{
 if(page==='home'&&!app.albums.length&&hasAuth())await loadHome();
 else if(page==='library')await (app.libType==='playlists'?loadPlaylists():loadLibrary());
 else if(page==='playlists')await loadPlaylists();
 }catch(e){showToast(e.message)}
}
async function loadHome(){try{let d=await api('discover',{},true);app.albums=sliceItems(d,'albums').length?sliceItems(d,'albums'):sliceItems(d);if(app.nav==='home')render();}
 catch(e){if(app.nav==='home')render();showToast('Qobuz discovery unavailable: '+e.message,5000)}}
async function search(){let i=$('#searchInput');app.searchQuery=i?.value?.trim()||app.searchQuery;if(!app.searchQuery)return;
 if(window.AurelSearchHistory)window.AurelSearchHistory(app.searchQuery);
 const buffered=window.AurelPageCache?.peek('search',{query:app.searchQuery,type:app.searchType});
 if(buffered){app.results=sliceItems(buffered,app.searchType);if(!app.results.length)app.results=sliceItems(buffered);app.searchBusy=false;renderSearch();return;}
 app.searchBusy=true;renderSearch();try{let d=await api('search',{query:app.searchQuery,type:app.searchType},true);app.results=sliceItems(d,app.searchType);if(!app.results.length)app.results=sliceItems(d);}
 catch(e){app.results=[];showToast(e.message,6000)}finally{app.searchBusy=false;if(app.nav==='search')renderSearch();}}
async function loadLibrary(force=false){
 const type=app.libType;
 app.libraryCache=app.libraryCache||Object.create(null);
 const cached=app.libraryCache[type];
 if(cached){
  app.libraryItems=cached.items;app.libraryLoading=false;
  if(app.nav==='library'&&app.libType===type)render();
  if(!force&&Date.now()-cached.time<120000)return;
 }else{
  app.libraryItems=[];app.libraryLoading=true;
  if(app.nav==='library'&&app.libType===type)render();
 }
 try{
  const data=await api('favorites',{type},true);
  const items=sliceItems(data,type);
  app.libraryCache[type]={items,time:Date.now()};
  if(app.libType===type)app.libraryItems=items;
 }catch(e){
  if(!cached&&app.libType===type)app.libraryItems=[];
  showToast(e.message);
 }finally{
  if(app.libType===type){
   app.libraryLoading=false;
   if(app.nav==='library')render();
  }
 }
}
async function loadPlaylists(force=false){
 if(app.playlistsCache&&Date.now()-app.playlistsCache.time<120000&&!force){
  app.playlists=app.playlistsCache.items;app.playlistsLoading=false;
  if(app.nav==='playlists'||app.nav==='library')render();return;
 }
 app.playlistsLoading=!app.playlistsCache;
 if(app.playlistsCache)app.playlists=app.playlistsCache.items;
 if(app.nav==='playlists'||app.nav==='library')render();
 try{
  const d=await api('playlists',{},true);
  app.playlists=sliceItems(d,'playlists');
  app.playlistsCache={items:app.playlists,time:Date.now()};
 }catch(e){
  if(!app.playlistsCache)app.playlists=[];
  showToast(e.message);
 }finally{app.playlistsLoading=false;
  if(app.nav==='playlists'||(app.nav==='library'&&app.libType==='playlists'))render();
 }
}
async function openArtist(id){if(!id)return;window.AurelBeforeOpenEntity?.();const buffered=window.AurelPageCache?.peek('artist',{id});if(buffered){app.selected=buffered;app.selectedKind='artist';app.selectedTracks=[];render();return;}$('#screen').innerHTML='<div class="loading">Opening artist…</div>';try{let d=await api('artist',{id});app.selected=d;app.selectedKind='artist';app.selectedTracks=[];render()}catch(e){app.selected=null;render()}}
async function openArtistFor(entity){
 if(!entity){showToast('No artist metadata for this track');return}
 app.overlay=false;drawOverlay();
 let id=artistId(entity),label=artist(entity);
 if(!id){
  try{
   const found=await api('resolveArtist',{trackId:String(entity.id||''),albumId:String(entity.album?.id||''),name:label},true);
   id=String(found?.id||'');
  }catch(e){showToast('Could not identify the artist: '+e.message,5000);return}
 }
 if(!id){showToast('Qobuz did not return a matching artist');return}
 await openArtist(id);
}
async function loadMoreArtistAlbums(){
 if(app.selectedKind!=='artist'||!app.selected?.id)return;
 const selected=app.selected;
 const offset=sliceItems(selected,'albums').length;
 try{
  const next=await api('artistAlbums',{id:String(selected.id),offset,limit:100});
  const more=sliceItems(next,'albums');
  const seen=new Set(sliceItems(selected,'albums').map(x=>String(x.id)));
  const fresh=more.filter(x=>x?.id&&!seen.has(String(x.id)));
  selected.albums.items.push(...fresh);
  selected.albums.limit=Number(selected.albums.limit)||100;
  selected.albums.total=Math.max(Number(selected.albums.total)||0,Number(next?.albums?.total)||0);
  renderArtist();
  if(!fresh.length)showToast('No further releases returned by Qobuz');
 }catch(e){showToast('Unable to load more releases: '+e.message)}
}
async function openAlbum(id){if(!id)return;window.AurelBeforeOpenEntity?.();const buffered=window.AurelPageCache?.peek('album',{id});if(buffered){app.selected=buffered;app.selectedKind='album';app.selectedTracks=withAlbum(sliceItems(buffered,'tracks'),buffered);render();return;}$('#screen').innerHTML='<div class="loading"><div class="pulse"></div>Opening album…</div>';
 try{let d=await api('album',{id});app.selected=d;app.selectedKind='album';app.selectedTracks=withAlbum(sliceItems(d,'tracks'),d);render();}catch(e){app.selected=null;render()}}
async function openPlaylist(id){window.AurelBeforeOpenEntity?.();const buffered=window.AurelPageCache?.peek('playlist',{id});if(buffered){app.selected=buffered;app.selectedKind='playlist';app.selectedTracks=withAlbum(sliceItems(buffered,'tracks'),buffered);render();return;}$('#screen').innerHTML='<div class="loading"><div class="pulse"></div>Opening playlist…</div>';
 try{let d=await api('playlist',{id});app.selected=d;app.selectedKind='playlist';app.selectedTracks=withAlbum(sliceItems(d,'tracks'),d);render();}catch(e){app.selected=null;render()}}
async function playFromTracks(items,index=0){
 if(!Array.isArray(items)||!items.length){showToast('No tracks available for streaming');return false;}
 const check=window.AurelTrackAccess?.status||(()=>({playable:true,reason:''}));
 const selected=items[index];
 if(!selected){showToast('Track information unavailable');return false;}
 const state=check(selected);
 if(!state.playable){showToast(state.reason,5000);return false;}
 const playable=[];let mapped=-1;
 items.forEach((track,i)=>{
   if(check(track).playable){
     if(i===index)mapped=playable.length;
     playable.push(track);
   }
 });
 if(mapped<0||!playable.length){showToast('No released tracks available for streaming');return false;}
 try{
   await api('play',{tracks:playable,index:mapped});
   app.overlay=true;drawOverlay();return true;
 }catch(e){return false;}
}
async function like(type,id){try{await api('favoriteAdd',{type,id});showToast('Added to your Qobuz favourites ♡')}catch(e){}}
async function login(form){
 const button=$('#loginSubmit');
 const secondary=app.loginTarget==='library';
 const passwordMode=app.loginMode==='password';
 const data={
  appId:$('#appId')?.value?.trim()||'',
  appSecret:$('#appSecret')?.value?.trim()||'',
  userId:$('#userId')?.value?.trim()||'',
  libraryOnly:secondary
 };
 if(passwordMode){
  data.email=$('#email')?.value?.trim()||'';
  const input=$('#password');
  data.password=input?.value||'';
  if(input)input.value=''; // passwords are not retained in the WebView
 }else{
  data.token=$('#token')?.value?.trim()||'';
 }
 if(button){button.disabled=true;button.textContent=passwordMode?'Signing in securely…':'Verifying token…'}
 try{
  app.session=await nativeCall(passwordMode?'loginPassword':'loginToken',data);
  // Account-specific collections cannot survive authentication changes.
  app.results=[];app.albums=[];app.libraryItems=[];app.playlists=[];
  app.libraryCache=Object.create(null);app.playlistsCache=null;
  window.AurelPageCache?.clear();
  app.loginTarget='stream';app.libType='albums';
  showToast(secondary?'Qobuz library connected · loading your collection':'Qobuz connected · loading your library',4200);
  navigate('library');
 }catch(e){
  const error=$('#loginError');
  const msg=e?.message||'Qobuz refused the login. Check credentials and try again.';
  if(error){
   error.textContent=msg;error.classList.remove('hidden');
   // Keep the actionable server error and reconnect button in view after
   // the keyboard is dismissed; do not overlay the mini player.
   if(typeof document.activeElement?.blur==='function')document.activeElement.blur();
   if(typeof error.scrollIntoView==='function')
      error.scrollIntoView({block:'nearest',behavior:'smooth'});
 }else showToast(msg,6500);
  const advanced=document.querySelector('.aurel-signin-advanced');
  if(advanced&&/App ID|X-App-Id|web app|401|403/i.test(msg))advanced.open=true;
  if(button){button.disabled=false;button.innerHTML=(secondary?'Connect library account':'Sign in & load library')+' '+ic('chevron',21)}
 }finally{
  if(data.password)data.password='';
 }
}
function setQuality(q){
  if(![5,6,7,27].includes(q))return;
  if(q===Number(app.session?.quality))return;
  const sync=window.AurelPreferenceSync;
  const operation=sync?sync.change('quality',q,value=>nativeCall('saveSettings',{quality:value})):
    nativeCall('saveSettings',{quality:q}).then(d=>{app.session=d;return {result:d}});
  operation.then(out=>{
    if(!sync&&app.nav==='settings')renderSettings();
    if(!out?.superseded)showToast('Quality preference saved');
  }).catch(e=>showToast(e?.message||'Could not save quality'));
}
function setSecret(){
 const field=$('#newSecret'),value=field?.value||'';
 if(!value){showToast('Enter a new secret');return}
 if(field)field.disabled=true;
 // Secret changes must not resend a potentially stale streaming-quality value.
 nativeCall('saveSettings',{appSecret:value}).then(d=>{
   app.session=window.AurelPreferenceSync?.reconcileSession(d)||d;
   if(field?.isConnected){field.value='';field.placeholder='Saved · enter to replace';}
   if(app.nav==='settings')window.AurelPreferenceSync?.refreshControls();
   showToast('Secret encrypted and saved');
 }).catch(e=>showToast(e?.message||'Could not save secret'))
 .finally(()=>{if(field?.isConnected)field.disabled=false;});
}
function togglePlayback(){if(!app.player)return;nativeCall(app.player.playing?'pause':'resume').catch(e=>showToast(e.message))}
// Delegated action handlers: all API-derived content is HTML-escaped before rendering.
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('button,[data-open-album],[data-open-artist],[data-play-index],[data-playlist-id]');if(!b)return;
 if(b.dataset.nav){if(app.overlay){app.overlay=false;app.playerSheet='';drawOverlay();}navigate(b.dataset.nav);return}
 if(b.dataset.loginMode){
   app.loginMode=['token','password','mornye'].includes(b.dataset.loginMode)?b.dataset.loginMode:'token';
   renderLogin();return;
 }
 if(b.hasAttribute('data-reverify-mornye')){
    ev.preventDefault();
    if(b.disabled)return;
    b.disabled=true;
    try{
      await nativeCall('reverifyMornye');
      showToast('Requesting a fresh Zarz session grant…',4200);
    }catch(e){showToast(e?.message||'Mornye verification could not start',6500)}
    finally{b.disabled=false;}
    return;
 }
 if(b.hasAttribute('data-connect-mornye')){
   ev.preventDefault();
   const error=$('#mornyeLoginError');
   if(error){error.textContent='';error.classList.add('hidden');}
   b.disabled=true;b.textContent='Connecting to Mornye gateway…';
   try{
     const result=await nativeCall('connectMornye');
     if(result?.verificationStarted){
       if(error){error.textContent='Complete the Zarz verification in the app window to continue.';error.classList.remove('hidden');}
       return;
     }
     if(!result?.mornyeConnected)throw new Error(result?.reason||'Mornye signed session was not authorized.');
     app.session=result;app.results=[];app.albums=[];app.loginTarget='stream';
     showToast('Mornye signed session verified',4000);
     navigate('home');
   }catch(ex){
     const message=ex?.message||'Mornye signed session failed';
     if(error){error.textContent=message;error.classList.remove('hidden');}
     else showToast(message,7000);
   }finally{
     b.disabled=false;b.innerHTML=ic('shield-check',23)+' Connect Mornye session';
   }
   return;
 }
 if(b.hasAttribute('data-toggle-token')||b.hasAttribute('data-toggle-secret')||b.hasAttribute('data-toggle-password')){
    ev.preventDefault();
    const secret=b.hasAttribute('data-toggle-secret');
    const password=b.hasAttribute('data-toggle-password');
    const field=$(secret?'#appSecret':password?'#password':'#token');
    if(field){
      field.type=field.type==='password'?'text':'password';
      b.setAttribute('aria-label',field.type==='password'?(secret?'Show App Secret':password?'Show password':'Show token'):(secret?'Hide App Secret':password?'Hide password':'Hide token'));
      b.innerHTML=ic(field.type==='password'?'eye':'eye-off',22);
    }
    return;
  }
 if(b.dataset.searchType){app.searchType=b.dataset.searchType;app.results=[];renderSearch();if(app.searchQuery)search();return}
 if(b.dataset.libType){app.libType=b.dataset.libType;if(app.libType==='playlists')loadPlaylists();else loadLibrary();return}
 if(b.hasAttribute('data-refresh')){loadHome();return}
 if(b.dataset.openAlbum){openAlbum(b.dataset.openAlbum);return}
 if(b.dataset.openArtist){openArtist(b.dataset.openArtist);return}
 if(b.hasAttribute('data-artist-from-album')){openArtistFor(app.selected);return}
 if(b.hasAttribute('data-load-more-artist')){loadMoreArtistAlbums();return}
 if(b.dataset.playlistId){openPlaylist(b.dataset.playlistId);return}
 if(b.hasAttribute('data-back')){app.selected=null;app.selectedTracks=[];render();return}
 if(b.hasAttribute('data-play-all')){
   const tracks=app.selectedTracks||[];
   const first=tracks.findIndex(t=>window.AurelTrackAccess?.canPlay(t)!==false);
   if(first<0)showToast('No released tracks available for streaming',5000);
   else void playFromTracks(tracks,first);
   return;
  }
 if(b.hasAttribute('data-play-index')){
  const source=app.selected?app.selectedTracks:app.nav==='library'?app.libraryItems:app.results;
  playFromTracks(source||[],Number(b.dataset.playIndex));return;
 }
 if(b.dataset.likeTrack){like('tracks',b.dataset.likeTrack);return}
 if(b.dataset.likeAlbum){like('albums',b.dataset.likeAlbum);return}
 if(b.hasAttribute('data-bit-perfect-toggle')){
   if(b.disabled)return;
   const wanted=!app.session?.bitPerfect?.enabled;
   b.disabled=true;
   try{
     const sync=window.AurelPreferenceSync;
     const result=sync?await sync.change('bitPerfect',wanted,
       value=>nativeCall('setBitPerfect',{enabled:value})):
       await nativeCall('setBitPerfect',{enabled:wanted});
     if(!result?.superseded)showToast(wanted?
       'USB bit-perfect preference enabled. Check device status below.':
       'Standard Android output restored.',4200);
   }catch(e){showToast(e.message||'Could not change USB output mode',5200);}
   finally{if(b.isConnected)b.disabled=false;}
   return;
 }
 if(b.dataset.quality){setQuality(Number(b.dataset.quality));return}
 if(b.hasAttribute('data-save-secret')){setSecret();return}
 if(b.hasAttribute('data-add-library')){app.loginTarget='library';app.loginMode='password';renderLogin();return}
 if(b.hasAttribute('data-validate-stream')){
   try{
     app.session=await nativeCall('validateSession');render();
     showToast(app.session.mornyeConfigured
       ?(app.session.gatewayPlaybackRejected?'Catalogue may be available, but the audio grant was rejected. Tap Reverify Mornye.':app.session.authError||'Mornye catalogue checked; playback rights are verified separately.')
       :(app.session.authRejected?'Qobuz rejected this token/App ID':app.session.authError?'Connection check unavailable: '+app.session.authError:'Qobuz verified'),6500);
   }catch(e){showToast(e.message||'Qobuz connection check failed',6500)}
   return;
 }
 if(b.hasAttribute('data-open-qobuz-web')){ev.preventDefault();nativeCall('openQobuzWeb').catch(e=>showToast(e.message||'Could not open official Qobuz login',5000));return}
 if(b.hasAttribute('data-change-stream')){app.loginTarget='stream';app.loginMode='password';renderLogin();return}
 if(b.hasAttribute('data-cancel-library')){app.loginTarget='stream';renderSettings();return}
 if(b.hasAttribute('data-logout-library')){try{window.AurelPageCache?.clear();
   window.AurelPreferenceSync?.reset();
   app.session=await api('logoutLibrary');app.libraryCache=Object.create(null);
   app.playlistsCache=null;app.libraryItems=[];app.playlists=[];
   showToast('Using primary library');navigate('library');
  }catch(e){showToast(e.message)}return}
 if(b.hasAttribute('data-logout')){try{window.AurelPageCache?.clear();
   window.AurelPreferenceSync?.reset();
   app.session=await api('logout');app.albums=[];app.results=[];
   app.libraryCache=Object.create(null);app.playlistsCache=null;
   app.libraryItems=[];app.playlists=[];navigate('home');
  }catch(e){showToast(e.message)}return}
 if(b.hasAttribute('data-mini-toggle')||b.hasAttribute('data-full-toggle')){ev.stopPropagation();togglePlayback();return}
 if(b.hasAttribute('data-mini-next')||b.hasAttribute('data-next')){ev.stopPropagation();nativeCall('next').catch(()=>{});return}
 if(b.hasAttribute('data-prev')){nativeCall('previous').catch(()=>{});return}
 if(b.hasAttribute('data-shuffle')){nativeCall('playbackSettings',{repeat:app.player?.repeat||0,shuffle:!app.player?.shuffle}).catch(()=>{});return}
 if(b.hasAttribute('data-repeat')){nativeCall('playbackSettings',{repeat:((app.player?.repeat||0)+1)%3,shuffle:app.player?.shuffle||false}).catch(()=>{});return}
 if(b.hasAttribute('data-close-overlay')){app.overlay=false;drawOverlay();return}
});
document.addEventListener('submit',e=>{
 if(e.target.id==='loginForm'){e.preventDefault();login(e.target)}
 if(e.target.id==='searchForm'){e.preventDefault();search()}
});
document.addEventListener('input',e=>{
 if(e.target.id==='progress'){app.dragging=true;$('#elapsed').textContent=duration(Number(e.target.value)/1000)}
});
document.addEventListener('change',e=>{
 if(e.target.id==='progress'){app.dragging=false;nativeCall('seek',{ms:Number(e.target.value)}).catch(()=>{})}
});
$('#mini').addEventListener('click',e=>{if(e.target.closest('button'))return;app.overlay=true;drawOverlay()});
// Startup: no injected credentials or assumed subscription status.
(async()=>{
 try{
   app.session=await api('session',{},true);
   if(app.session?.streamConnected){
     try{app.session=await nativeCall('validateSession')}catch(_){}
   }
   if(app.session?.libraryConnected&&!app.session?.streamConnected)app.nav='library';
   render();
   if(hasAuth()){
     nativeCall('playerState').catch(()=>{});
     if(app.nav==='home')loadHome();
     else if(app.nav==='library')loadLibrary();
   }
 }
 catch(e){app.session={loggedIn:false,profile:{}};renderLogin();if(!window.AurelNative)showToast('Visual preview only — Qobuz requests require the Android application',7000)}
})();
