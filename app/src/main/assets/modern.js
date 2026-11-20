'use strict';
/* Original AUREL interface. Inspired by familiar contemporary music-app patterns;
   no proprietary application code, logos or bundled artwork. */
app.discoverTab='new';
app.discoverStatus='';
app.libSort='recent';
app.libLayout='grid';
app.playerSheet='';
app.lastQueueFingerprint='';
const trackSource=()=>app.selected?app.selectedTracks:(app.nav==='library'?app.libraryItems:app.results)||[];
function remembered(){try{const v=JSON.parse(localStorage.getItem('aurel_recent_searches')||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,10):[]}catch(_){return []}}
window.AurelSearchHistory=(query)=>{if(!query||query.length>120)return;const next=[query,...remembered().filter(s=>s.toLowerCase()!==query.toLowerCase())].slice(0,10);try{localStorage.setItem('aurel_recent_searches',JSON.stringify(next))}catch(_){}};
const fmtTrack=(t,i)=>{
 const state=window.AurelTrackAccess?.status(t)||{playable:true};
 return `<button class="queue-item ${i===app.player?.index?'current':''}" data-queue-play="${i}" ${state.playable?'':'disabled'}><span class="queue-cover">${art(t,'queue-image')||'<span>♪</span>'}</span><span class="queue-text"><strong>${html(t.title||'Untitled')}</strong><small>${html(state.playable?artistLabel(t):'Unavailable for streaming')}</small></span>${i===app.player?.index?'<span class="playing-indicator">♫</span>':''}</button>`;
};
function albumShelf(items){if(!items.length){
 const status=app.discoverStatus||'empty';
 const message=status==='loading'?'Loading the latest Qobuz releases…':
   status==='authorization'
  ?'Fresh releases require Qobuz catalogue authorization. Search and your library may still work.'
  :status==='network'
  ?'Fresh releases could not be loaded. Check your connection and retry.'
  :'No releases have been returned by the connected account.';
 const fallback=status==='authorization'
   ?'<div class="aurel-discovery-links"><button type="button" data-nav="search">Search music</button>'+
     '<button type="button" data-nav="library">Your library</button>'+
     '<button type="button" data-refresh>Retry</button></div>'
   :status==='loading'?'<span class="aurel-discovery-wait" aria-hidden="true"></span>':
   '<button type="button" data-refresh class="aurel-discovery-retry">Retry</button>';
 return '<div class="empty aurel-discovery-fallback" role="status" data-aurel-discovery-state="'+html(status)+'">'+
   '<p>'+html(message)+'</p>'+fallback+'</div>';
}return `<div class="album-shelf">${items.slice(0,30).map(o=>`<button class="shelf-card" data-open-album="${html(o.id)}"><span class="shelf-image">${art(o,'shelf-cover')||'<span class="shelf-placeholder">♪</span>'}</span><strong>${html(o.title||o.name||'Untitled')}</strong><span>${html(artistLabel(o))}</span>${Number(o.maximum_bit_depth)>16?'<em class="hires-tag">Hi-Res</em>':''}</button>`).join('')}</div>`}
renderHome=function(){
 const name=app.session?.profile?.displayName||'Listener';
 $('#screen').innerHTML=`<div class="page-heading"><h1>Discover</h1><button class="subtle-icon" data-nav="settings" aria-label="Settings">${ic('settings',26)}</button></div>
 ${app.session?.streamValidation==='unverified'?
 '<div class="auth-status-banner" role="status">'+ic('info',21)+'<div><strong>Session saved, not verified</strong><span>The Qobuz API did not confirm this token. Try playing a track to check streaming access.</span></div></div>':''}
 <div class="home-chips"><button class="chip ${app.discoverTab==='new'?'selected':''}" data-discover-tab="new">Home</button><button class="chip ${app.discoverTab==='albums'?'selected':''}" data-discover-tab="albums">New releases</button><button class="chip ${app.discoverTab==='collection'?'selected':''}" data-discover-tab="collection">Your library</button></div>
 ${app.discoverTab==='collection'?`<section class="welcome-panel"><span class="kicker">YOUR COLLECTION</span><h2>Everything you love,<br>in one place.</h2><p>Explore saved music from your library account.</p><button class="action-pill" data-nav="library">Open library ↗</button></section>`:
 `<section class="spotlight"><div class="spotlight-copy"><span class="kicker">AUREL / LOSSLESS LISTENING</span><h2>Listen deeper.</h2><p>Albums, artists and music worth your time.</p><button class="action-pill" data-nav="search">Explore music ↗</button></div><div class="spotlight-stack">${app.albums.slice(0,3).map(a=>art(a,'spotlight-cover')).join('')}</div></section>
 <div class="sectionhead new-section"><div><h2>${app.discoverSource==='curated'?'Qobuz New Releases playlist':app.discoverTab==='albums'?'New releases':'Fresh on Qobuz'}</h2><p>${app.discoverSource==='curated'?'Albums from the official Qobuz weekly playlist':'Recently released albums available in the catalogue'}</p></div><button class="plain-action" data-refresh aria-label="Refresh releases">${ic('refresh',25)}</button></div>${app.discoverStatus==='stale'?
  '<p class="aurel-discovery-stale" role="status">Showing the last available Qobuz releases. Refresh to try again.</p>':''}${albumShelf(app.albums)}
 <div class="sectionhead"><div><h2>Go your own way</h2><p>Quick access to music that matters</p></div></div>
 <div class="quicklinks"><button data-nav="library"><span class="quicklink-icon" aria-hidden="true">${ic('library',27)}</span><strong>Your favourites</strong><small>Releases, artists, playlists</small></button><button data-nav="search"><span class="quicklink-icon" aria-hidden="true">${ic('search',27)}</span><strong>Search catalogue</strong><small>Tracks, artists and albums</small></button></div>`}
 <p class="disclaimer">AUREL is an independent client. Catalogue and streaming depend on Qobuz authorization.</p>`;
};
function renderMagazine(){
 $('#screen').innerHTML=`<div class="page-heading"><h1>Magazine</h1></div><div class="magazine-hero"><span class="kicker">MUSIC / STORIES / ARTISTS</span><h2>Go beyond<br>the recording.</h2><p>Reviews, interviews and listening guides from Qobuz's editorial magazine.</p><button class="action-pill" data-open-magazine>Read Qobuz Magazine ↗</button></div>
 <div class="sectionhead"><div><h2>Music has a story</h2><p>Editorial articles open on Qobuz's official site</p></div></div>
 <div class="magazine-features"><div class="magazine-tile">${ic('info',27)}<strong>Interviews</strong><small>The people behind the music</small></div><div class="magazine-tile">${ic('album',27)}<strong>Album stories</strong><small>Context for deeper listening</small></div><div class="magazine-tile">${ic('audio',27)}<strong>Discoveries</strong><small>Genres, labels and recordings</small></div></div>
 <p class="disclaimer">Articles are not mirrored or redistributed inside AUREL.</p>`;
};
renderSearch=function(){
 const recent=remembered();
 $('#screen').innerHTML=`<div class="page-heading"><h1>Search</h1></div>
 <form id="searchForm" class="searchbox qsearch"><span class="aurel-search-leading" aria-hidden="true">${ic('search',24)}</span><input id="searchInput" type="search" enterkeyhint="search" placeholder="Artists, albums, tracks…" autocomplete="off" value="${html(app.searchQuery)}"><button class="search-submit" type="submit" aria-label="Search">${ic('arrow-right',27)}</button></form>
 <div class="tabs search-tabs">${['tracks','albums','artists'].map(t=>`<button class="tab ${app.searchType===t?'active':''}" data-search-type="${t}">${({tracks:'Tracks',albums:'Albums',artists:'Artists'})[t]}</button>`).join('')}</div>
 ${!app.searchQuery&&recent.length?`<div class="recent-head"><h2>Recent searches</h2><button data-clear-recent aria-label="Clear recent searches">Clear</button></div><div class="recents">${recent.map(q=>`<button data-search-recent="${html(q)}"><span>↗</span>${html(q)}<b>›</b></button>`).join('')}</div>`:''}
 <div id="searchResults">${app.searchBusy?'<div class="loading"><div class="pulse"></div>Searching catalogue…</div>':searchResults()}</div>`;
};
function displaySort(items){const list=items.slice();if(app.libSort==='alpha')list.sort((a,b)=>String(a.title||a.name||'').localeCompare(String(b.title||b.name||'')));else if(app.libSort==='artist')list.sort((a,b)=>artist(a).localeCompare(artist(b)));return list}
renderLibrary=function(){
 const kind=app.libType;
 const items=kind==='playlists'?app.playlists||[]:app.libraryItems||[];
 const isLoading=kind==='playlists'?app.playlistsLoading:app.libraryLoading;
 const tabs=[['playlists','Playlists'],['albums','Releases'],['tracks','Tracks'],['artists','Artists']];
 let contents='';
 if(isLoading)contents='<div class="loading"><div class="pulse"></div>Loading your collection…</div>';
 else if(kind==='playlists')contents=items.length?`<div class="playlist-list">${items.map(o=>`<button class="playlist-entry" data-playlist-id="${html(o.id)}"><span class="playlist-art">▤</span><span><strong>${html(o.name||'Playlist')}</strong><small>${Number(o.tracks_count)||0} tracks</small></span><b>›</b></button>`).join('')}</div>`:'<div class="empty">No playlists have been returned for this account.</div>';
 else if(kind==='albums')contents=app.libLayout==='list'?`<div class="library-album-list">${displaySort(items).map(o=>`<button class="library-album-row" data-open-album="${html(o.id)}">${art(o,'library-row-image')||'<span class="library-row-image placeholder">♪</span>'}<span><strong>${html(o.title||'Untitled')}</strong><small>${html(artistLabel(o))}</small></span><b>›</b></button>`).join('')}</div>`:albumCards(displaySort(items));
 else if(kind==='tracks')contents=listTracks(displaySort(items));
 else contents=artistRows(displaySort(items));
 $('#screen').innerHTML=`<div class="page-heading"><h1>Library</h1><button class="subtle-icon" data-nav="settings" aria-label="Library account">＋</button></div>
 <div class="collection-note">${app.session?.libraryConnected?'Showing your separate library account':'Showing favourites from your streaming account'}</div>
 <div class="tabs library-tabs">${tabs.map(([key,label])=>`<button class="tab ${kind===key?'active':''}" data-lib-type="${key}">${label}</button>`).join('')}</div>
 <div class="library-controls"><label>Sort <select id="libSort" aria-label="Library sort order"><option value="recent" ${app.libSort==='recent'?'selected':''}>Recently added</option><option value="alpha" ${app.libSort==='alpha'?'selected':''}>Title</option><option value="artist" ${app.libSort==='artist'?'selected':''}>Artist</option></select></label>${kind==='albums'?`<div class="view-switch"><button data-library-layout="grid" class="${app.libLayout==='grid'?'active':''}" aria-label="Grid view">▦</button><button data-library-layout="list" class="${app.libLayout==='list'?'active':''}" aria-label="List view">☷</button></div>`:''}</div>
 <div id="libraryContent">${contents}</div>`;
};
function queuePanel(p){const q=Array.isArray(p.queue)?p.queue:[];if(!q.length)return '<div class="empty">Your queue is empty.</div>';
 return `<div class="sheet-title">Play queue <span>${q.length} tracks</span></div><div class="queue-list">${q.map((t,i)=>`<div class="editable-queue">${fmtTrack(t,i)}<div class="queue-ops"><button data-queue-move="${i}" data-queue-dir="-1" aria-label="Move up" ${i===0?'disabled':''}>↑</button><button data-queue-move="${i}" data-queue-dir="1" aria-label="Move down" ${i===q.length-1?'disabled':''}>↓</button><button data-queue-remove="${i}" aria-label="Remove track">×</button></div></div>`).join('')}</div>`}
function creditsPanel(p){
 const t=p.track||{}, album=t.album||{};
 const show=(key,val)=>{
   if(val==null||val==='')return '';
   if(Array.isArray(val))val=val.map(x=>typeof x==='string'?x:nameOf(x)).filter(Boolean).join(', ');
   if(typeof val==='object')val=nameOf(val)||val.name||'';
   return val?`<div class="credit"><span>${html(key)}</span><strong>${html(val)}</strong></div>`:'';
 };
 const credits=t.performers||t.composers||t.composer||album.performers;
 return `<div class="sheet-title">Qobuz recording information</div>
 <div class="credits">
 ${show('Track',t.title)}
 ${show('Artist',artist(t))}
 ${show('Album',album.title)}
 ${show('Composer',t.composer||t.composers)}
 ${show('Performers / Credits',credits)}
 ${show('Label',album.label?.name||album.label||t.label?.name||t.label)}
 ${show('ISRC',t.isrc)}
 ${show('Disc',t.media_number||t.disc_number)}
 ${show('Track number',t.track_number)}
 ${show('Original release',album.release_date_original||album.release_date||album.releaseDate)}
 ${show('Release',album.release_date_stream||t.release_date)}
 ${show('Duration',t.duration?duration(t.duration):'')}
 ${show('Copyright',album.copyright||album.copyright_label||t.copyright)}
 <p>Fields come from Qobuz catalogue metadata when available. The catalogue's maximum audio quality is not proof of the currently decoded stream.</p>
 </div>`;
}
// Source bit depth and sample rate are not DAC measurements.
// Qobuz catalogue maximum is kept separate from stream truth.
const kHzLabel=hz=>{const n=Number(hz);if(!Number.isFinite(n)||n<8000)return '';const k=n/1000;return `${Number(k.toFixed(3))} kHz`};
function catalogueMaxText(p){
 const bits=Number(p?.catalogMaxBits)||0,rate=kHzLabel(p?.catalogMaxSampleRateHz);
 if(bits&&rate)return `${bits}-bit / ${rate}${p?.catalogMaxFromAlbum?' (album)':''}`;
 return 'Not reported';
}
function bitrateDisplay(p){
 const value=Number(p?.sourceBitrateKbps)||0;
 if(value>=8&&value<=50000)return `${Math.round(value)} kbps · provider`;
 const decoder=Number(p?.decoderBitrateKbps)||0;
 if(decoder>=8&&decoder<=50000)return `${Math.round(decoder)} kbps · Android`;
 const estimate=Number(p?.estimatedAvgBitrateKbps)||0;
 if(estimate>=8&&estimate<=50000)return `≈ ${Math.round(estimate)} kbps · estimated average`;
 return '';
}
function actualSource(p){
 if(!p)return 'Format not available';
 const bits=Number(p.bits)||0,rate=kHzLabel(p.sampleRateHz);
 const androidRate=kHzLabel(p.decoderSampleRateHz);
 const mime=(p.decoderMime||p.mimeType||'').toLowerCase();
 const codec=p.codec||(mime.includes('flac')?'FLAC':mime.includes('mpeg')?'MP3':'');
 const provider=Number(p.sourceBitrateKbps)||0,estimated=Number(p.estimatedAvgBitrateKbps)||0;
 const androidBitrate=Number(p.decoderBitrateKbps)||0,frame=Number(p.frameBitrateKbps)||0;
 const bitrate=provider>=8&&provider<=50000?Math.round(provider)+' kbps':
   estimated>=8&&estimated<=50000?'≈ '+Math.round(estimated)+' kbps':
   androidBitrate>=8&&androidBitrate<=50000?Math.round(androidBitrate)+' kbps':
   frame>=8&&frame<=50000?'frame '+Math.round(frame)+' kbps':'';
 const suffix=bitrate?' · '+bitrate:'';
 if(p.sourceVerified&&bits&&rate)return `${codec?codec+' · ':''}${bits}-bit / ${rate}${suffix}`;
 if(p.streamHeaderVerified&&rate)return `${codec?codec+' · ':''}${rate}${suffix}`;
 if(androidRate)return `${codec?codec+' · ':''}${androidRate} · Android${suffix}`;
 if(p.qualityProbePending)return 'Checking actual stream quality…';
 if(p.buffering)return 'Connecting to audio…';
 if(p.playing&&bitrate)return bitrate+' · source format unverified';
 // The selected provider tier is a request, not a measurement of delivered PCM.
 const tier={5:'MP3',6:'CD',7:'Hi-Res',27:'Hi-Res Max'}[Number(p.formatId)||0];
 if(tier)return tier+' requested · format unverified';
 return p.playing?'Playing · exact stream format not reported':'Format unverified · tap Audio';
}
const bytesText=n=>Number(n)>0?`${(Number(n)/1048576).toFixed(1)} MB`:'Not reported';
function audioPanel(p){
 const source=p?.streamHeaderVerified?(p?.sourceEvidence||'Direct media header'):
  p?.sourceVerified?'Streaming provider metadata':
  p?.qualityProbePending?'Checking stream header…':
  p?.qualityProbeAttempted?'Stream header not accessible; only known data shown':
  'Stream metadata not reported';
 const decoderHz=kHzLabel(p?.decoderSampleRateHz);
 const fields=[
  ['Requested stream tier',({5:'MP3',6:'CD',7:'Hi-Res',27:'Hi-Res Max'}[Number(p?.formatId)||0]||'Not reported')+' (not verified)'],
  ['Current stream',p?.sourceVerified?`${p.bits}-bit / ${kHzLabel(p.sampleRateHz)}`:
      p?.streamHeaderVerified&&kHzLabel(p.sampleRateHz)?`${p.codec||'Audio'} · ${kHzLabel(p.sampleRateHz)} (bit depth unknown / not applicable)`:'Exact bit depth / rate not verified'],
  ['Quality verified by',source],
  ['Qobuz catalogue maximum',catalogueMaxText(p)],
  ['Provider bitrate',p?.sourceBitrateKbps?Math.round(p.sourceBitrateKbps)+' kbps':'Not reported'],
  ['Android track bitrate',p?.decoderBitrateKbps?Math.round(p.decoderBitrateKbps)+' kbps':'Not reported'],
  ['MP3 sampled frame bitrate',p?.frameBitrateKbps?Math.round(p.frameBitrateKbps)+' kbps (not whole-track average)':'Not reported'],
  ['Estimated average bitrate',p?.estimatedAvgBitrateKbps?'≈ '+Math.round(p.estimatedAvgBitrateKbps)+' kbps (from file size / duration)':'Unavailable'],
  ['Provider',p?.sourceLabel||'Not reported'],
  ['Source provenance',source],
  ['Source codec',p?.codec||'Not reported'],
  ['Android parsed codec',p?.decoderMime||'Not exposed'],
  ['Android parsed sample rate',decoderHz||'Not exposed'],
  ['MediaPlayer channels',p?.decoderChannels||'Not reported'],
  ['Android mixer property',p?.androidMixerHz?`${p.androidMixerHz} Hz (not DAC format)`:'Not reported'],
  ['USB bit-perfect preference',p?.bitPerfect?.enabled?(p.bitPerfect.directUsbSelected?'Userspace USB driver selected':p.bitPerfect.mixerPreferenceAccepted?'Requested by Android':'Enabled · not engaged'):'Off'],
  ['USB output routing',p?.bitPerfect?.usbRouted?'Routed to selected USB DAC':'Not confirmed'],
  ['USB mixer status',p?.bitPerfect?.detail||'No bit-perfect status'],
  ['End-to-end bit identity','Not yet independently verified on the attached USB DAC'],
  ['Media size',bytesText(p?.fileSize)],
  ['Requested maximum',qualityText(p?.quality)]
 ];
 return `<div class="sheet-title">Audio details · source vs catalogue</div>
 <div class="credits">${fields.map(([key,val])=>`<div class="credit"><span>${html(key)}</span><strong>${html(val)}</strong></div>`).join('')}
 <p>The requested tier is not proof of delivered bit depth or sample rate. A short STREAMINFO read can verify FLAC only when the URL supports safe range access; AUREL does not retry single-use signed URLs. MP3 bitrate may vary. Android mixer / DAC output is a different measurement.</p></div>`;
}

/* Early icon and playback helpers now live in app.js, before native events. */
/* WebView may disable CSS animations via older motion/theme rules.
 * Use compositor rotation so the Play control remains a live loading gauge. */
const aurelEnsureLoadingAnimation=(root)=>{
 if(!root?.querySelectorAll)return;
 const reduced=typeof window.matchMedia==='function' &&
   window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const svg of root.querySelectorAll('svg.aurel-spinner')){
  if(svg.dataset.aurelAnimated==='1')continue;
  svg.dataset.aurelAnimated='1';
  if(typeof svg.animate!=='function')continue; // CSS remains fallback
  try{
   const animation=svg.animate(
    [{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],
    {duration:reduced?2400:860,iterations:Infinity,easing:'linear'});
   svg.style.setProperty('animation','none','important');
   svg._aurelSpinnerAnimation=animation;
  }catch(_){svg.style.removeProperty('animation');}
 }
};
const aurelStopLoadingAnimation=(root)=>{
 if(!root?.querySelectorAll)return;
 for(const svg of root.querySelectorAll('svg.aurel-spinner')){
  try{svg._aurelSpinnerAnimation?.cancel();}catch(_){}
 }
};
const artistButton=(t)=>`<button class="player-artist-link" data-open-playing-artist aria-label="Open ${html(artistLabel(t))} discography"><span>${html(artistLabel(t))}</span>${ic('chevron',19)}</button>`;
let aurelMiniAnimating=false;
let aurelLastMiniFrame=0;
let aurelMiniFrameTimer=0;
/* Schedule one compositor progress paint every ~100ms instead of polling
 * requestAnimationFrame on all 60 frames each second. */
function queueAurelMiniFrame(){
 if(!aurelMiniAnimating||aurelMiniFrameTimer||document.hidden)return;
 aurelMiniFrameTimer=setTimeout(()=>{
  aurelMiniFrameTimer=0;
  if(aurelMiniAnimating&&app.player?.playing&&!document.hidden)
   requestAnimationFrame(aurelMiniFrame);
  else aurelMiniAnimating=false;
 },100);
}
function wakeAurelMiniAnimation(){
 if(aurelMiniAnimating||!app.player?.playing||document.hidden||
    typeof requestAnimationFrame!=='function')return;
 aurelMiniAnimating=true;
 aurelLastMiniFrame=0;
 requestAnimationFrame(aurelMiniFrame);
}
function aurelMiniFrame(time){
 if(!app.player?.playing || document.hidden){
   aurelMiniAnimating=false;
   return;
 }
 if(time-aurelLastMiniFrame>=95){
   aurelLastMiniFrame=time;
   const p=app.player,clock=window.AurelProgressClock;
   const durationMs=Math.max(0,Number(p.duration)||Math.max(0,Number(p.track?.duration)||0)*1000);
   if(durationMs>0 && clock){
     const position=clock.read(p);
     const ratio=Math.max(0,Math.min(1,position/durationMs));
     const fill=document.querySelector('#mini .mini-progress-fill');
     if(fill){
       const next='scaleX('+ratio.toFixed(6)+')';
       if(fill.style.transform!==next)fill.style.transform=next;
     }
     const bar=document.querySelector('#mini .mini-progress');
     if(bar){
       const cssValue=(ratio*100).toFixed(2)+'%';
       if(bar.style.getPropertyValue('--played')!==cssValue)
         bar.style.setProperty('--played',cssValue);
       const value=String(Math.round(ratio*100));
       if(bar.getAttribute('aria-valuenow')!==value)bar.setAttribute('aria-valuenow',value);
       const label=duration(position/1000)+' of '+duration(durationMs/1000);
       if(bar.getAttribute('aria-valuetext')!==label)bar.setAttribute('aria-valuetext',label);
     }
     const slider=document.querySelector('#overlay #progress');
     if(slider&&!app.dragging)slider.value=String(Math.round(position));
     const elapsed=document.querySelector('#overlay #elapsed');
     if(elapsed&&!app.dragging){
       const timeLabel=duration(position/1000);
       if(elapsed.textContent!==timeLabel)elapsed.textContent=timeLabel;
     }
     const remaining=document.querySelector('#overlay #remaining');
     if(remaining&&!app.dragging){
       const timeLabel='-'+duration(Math.max(0,(durationMs-position)/1000));
       if(remaining.textContent!==timeLabel)remaining.textContent=timeLabel;
     }
   }
 }
 queueAurelMiniFrame();
}
document.addEventListener('visibilitychange',wakeAurelMiniAnimation);
// Stable mini-player: do not recreate artwork, buttons or metadata on each
// 250 ms native position event. Preserve favourites state and scroll positions.
updateMini=function(){
 const p=app.player,m=$('#mini');
 if(!m)return;
 if(!p?.track?.id){m.classList.add('hidden');m.removeAttribute('data-mini-track');return;}
 const t=p.track,id=String(t.id),title=trackTitle(t),performer=artistLabel(t);
 const cover=image(t,'thumb');
 m.classList.remove('hidden');
 const miniRebuilt=m.dataset.miniTrack!==id||!m.querySelector('.mini-track-open');
 if(miniRebuilt){
  m.innerHTML=`${cover?'<img class="minicover" src="'+html(cover)+'" alt="Album art" loading="eager">':'<span class="minicover placeholder">♪</span>'}
   <div class="meta mini-track-open"><strong class="title"></strong><small class="artist"></small></div>
   <div class="mini-buttons"><button class="mini-love" data-mini-fav="${html(id)}" aria-label="Add to favourites">${ic('heart',24)}</button>
   <button class="mini-play" data-mini-toggle aria-label="Play">${ic('play',26)}</button></div>
   <div class="mini-progress" role="progressbar" aria-label="Track progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="mini-progress-fill" aria-hidden="true"></span></div>`;
  m.dataset.miniTrack=id;
  m.dataset.miniPlaying='';
  m.dataset.miniArtwork=cover||'';
 }
 const titleNode=m.querySelector('.mini-track-open .title'),
       artistNode=m.querySelector('.mini-track-open .artist');
 if(titleNode&&titleNode.textContent!==title)titleNode.textContent=title;
 if(artistNode&&artistNode.textContent!==performer)artistNode.textContent=performer;
 if((m.dataset.miniArtwork||'')!==cover){
  const old=m.querySelector('.minicover');
  if(old){
   const replacement=document.createElement(cover?'img':'span');
   replacement.className=cover?'minicover':'minicover placeholder';
   if(cover){replacement.src=cover;replacement.alt='Album art';}
   else replacement.textContent='♪';
   old.replaceWith(replacement);
  }
  m.dataset.miniArtwork=cover||'';
 }
 const play=m.querySelector('[data-mini-toggle]');
 const miniMode=aurelPlaybackMode(p);
 if(play&&m.dataset.miniPlaying!==miniMode){
  play.innerHTML=aurelPlaybackIcon(p,26);
  play.setAttribute('aria-label',aurelPlaybackLabel(p));
  play.setAttribute('aria-busy',String(miniMode==='loading'));
  play.classList.toggle('is-loading',miniMode==='loading');
  m.dataset.miniPlaying=miniMode;
 }
 if(miniMode==='loading')aurelEnsureLoadingAnimation(m);
 const position=window.AurelProgressClock?.accept(p)??(Number(p.position)||0);
 const bar=m.querySelector('.mini-progress');
 const total=Math.max(0,Number(p.duration)||Math.max(0,Number(t.duration)||0)*1000);
 const percent=total?Math.min(100,Math.max(0,100*position/total)):0;
 if(bar&&(!p.playing||miniRebuilt)){
   // The compositor clock owns progress while music plays; ~250ms
   // native state updates must not restart every transform transition.
   bar.dataset.durationKnown=total>0?'true':'false';
   const next=percent.toFixed(2)+'%';
   if(bar.style.getPropertyValue('--played')!==next)bar.style.setProperty('--played',next);
   const fill=bar.querySelector('.mini-progress-fill');
   if(fill){
     const target='scaleX('+(percent/100).toFixed(6)+')';
     if(fill.style.transform!==target)fill.style.transform=target;
   }
   const value=String(Math.round(percent));
   if(bar.getAttribute('aria-valuenow')!==value)bar.setAttribute('aria-valuenow',value);
   const readable=total>0?duration(position/1000)+' of '+duration(total/1000):
       'Track duration unavailable';
   if(bar.getAttribute('aria-valuetext')!==readable)bar.setAttribute('aria-valuetext',readable);
 }
 wakeAurelMiniAnimation();
};
drawOverlay=function(){
 const overlay=$('#overlay');
 if(!app.overlay){overlay.classList.add('hidden');overlay.innerHTML='';return}
 const p=app.player||{},t=p.track||{},src=image(t),active=app.playerSheet||'';
 const progressTotal=Math.max(0,Number(p.duration)||0),position=Math.min(progressTotal,Math.max(0,(window.AurelProgressClock?.read(p) ?? Number(p.position) ?? 0)));
 const loading=p.buffering&&!p.error;
 const format=actualSource(p);
 const subtitle=p.error?'Playback unavailable':loading?'Connecting to audio…':p.sourceVerified?'Source format · Qobuz metadata':p.decoderSampleRateHz?'Media track format · Android':'Source format not confirmed';
 const safeBackground=src?`url("${src.replaceAll('"','%22')}")`:'none';
 overlay.classList.remove('hidden');overlay.style.setProperty('--cover-image',safeBackground);
 overlay.innerHTML=`<div class="aurel-listening-screen">
  <div class="aurel-art-backdrop" aria-hidden="true"></div>
  <header class="aurel-listening-nav">
   <button class="aurel-round-icon" data-close-overlay aria-label="Minimize player">${ic('down',29)}</button>
   <strong>Now Playing</strong>
   <div class="aurel-nav-right"><button class="aurel-round-icon" data-player-sheet="upnext" aria-label="Play queue">${ic('queue',27)}</button><button class="aurel-round-icon" data-player-sheet="audio" aria-label="Audio details">${ic('more',25)}</button></div>
  </header>
  <div class="aurel-art-space" aria-hidden="true"></div>
  <div class="aurel-listening-bottom">
   <section class="aurel-track-title-row"><div class="aurel-song-details"><h1>${html(t.title||'Choose a track')}</h1>
    <div class="aurel-source-caption">${html(subtitle)}</div>
    ${artistButton(t)}
    ${t.album?.title?`<button class="aurel-album-link" data-open-playing-album aria-label="Open album">${html(t.album.title)} ${ic('chevron',15)}</button>`:''}
    </div>
    <button class="aurel-fav-button" data-like-track="${html(t.id||'')}" aria-label="Add to favourites">${ic('heart',27)}</button></section>
   <section class="aurel-timeline" aria-label="Track progress">
    <input id="progress" class="progress" type="range" min="0" max="${progressTotal||100}" step="any" value="${position}" aria-label="Playback position">
    <div class="aurel-timeline-labels"><span id="elapsed">${duration(position/1000)}</span><button class="aurel-source-pill" data-player-sheet="audio" aria-label="Show audio source information">${ic('audio',17)}<span>${html(format)}</span></button><span id="remaining">${duration(progressTotal/1000)}</span></div>
   </section>
   <section class="aurel-main-actions" aria-label="Playback controls">
    <button data-prev aria-label="Previous track" class="aurel-transport side">${ic('prev',33)}</button>
    <button id="full-toggle" data-full-toggle aria-label="${aurelPlaybackLabel(p)}" aria-busy="${loading}" class="aurel-transport middle ${loading?'is-loading':''}">${aurelPlaybackIcon(p,40)}</button>
    <button data-next aria-label="Next track" class="aurel-transport side">${ic('next',33)}</button>
   </section>
   <section class="aurel-extra-actions" aria-label="Playback options">
    <button data-player-sheet="upnext" aria-label="Queue" class="${active==='upnext'?'active':''}">${ic('queue',25)}<span>Queue</span></button>
    <button id="full-shuffle" data-shuffle aria-label="Shuffle" class="${p.shuffle?'active':''}">${ic('shuffle',23)}<span>Shuffle</span></button>
    <button id="full-repeat" data-repeat aria-label="Repeat" class="${p.repeat?'active':''}">${ic('repeat',24)}${p.repeat===2?'<sup>1</sup>':''}<span>Repeat</span></button>
    <button data-player-sheet="credits" aria-label="Credits" class="${active==='credits'?'active':''}">${ic('info',24)}<span>Info</span></button>
   </section>
   ${active?`<div class="aurel-detail-sheet">${active==='upnext'?queuePanel(p):active==='credits'?creditsPanel(p):audioPanel(p)}</div>`:''}
   ${p.error?`<div class="playback-error" role="status">${html(p.error)}</div>`:''}
   <div class="aurel-playback-state" id="playingStatus" aria-live="polite">${p.error?'UNAVAILABLE':loading?'BUFFERING':p.playing?'PLAYING':'PAUSED'}</div>
  </div>
 </div>`;
};

const formerEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 const old=app.lastQueueFingerprint;formerEvent(kind,data);if(kind==='player'){
 const slider=document.querySelector('[data-aurel-usb-volume]');
 if(slider&&document.activeElement!==slider&&Number.isFinite(Number(data?.usbOutputVolumePercent))){
   const percent=Math.min(100,Math.max(0,Number(data.usbOutputVolumePercent)));
   slider.value=String(percent);
   const label=document.querySelector('[data-aurel-usb-volume-label]');
   if(label)label.textContent=percent+'%';
 }
 const mode=document.querySelector('[data-aurel-usb-volume-mode]');
 if(mode){
   const route=data?.bitPerfect?.usbVolumeMode;
   const status=route==='hardware'?'DAC hardware volume · PCM unchanged':
     route==='digital'?'Digital attenuation · not bit-perfect':
     route==='unity'?'Unchanged PCM · no hardware control':
     'USB control not active';
   if(mode.textContent!==status)mode.textContent=status;
 }
 const q=data?.queue||[];const fingerprint=JSON.stringify([q.map(x=>x?.id),data?.index]);app.lastQueueFingerprint=fingerprint;
 const sourceSignature=JSON.stringify([data?.sourceVerified,data?.bits,data?.sampleRateHz,data?.codec,data?.sourceLabel,data?.decoderSampleRateHz,data?.decoderMime,data?.catalogMaxBits,data?.catalogMaxSampleRateHz,data?.sourceBitrateKbps,data?.decoderBitrateKbps,data?.estimatedAvgBitrateKbps,data?.qualityProbePending,data?.qualityProbeAttempted,data?.streamHeaderVerified,data?.sourceEvidence,data?.frameBitrateKbps,data?.fileSize,data?.quality,data?.androidMixerHz,data?.bitPerfect?.enabled,data?.bitPerfect?.usbRouted,data?.bitPerfect?.mixerPreferenceAccepted,data?.bitPerfect?.detail]);
 const trackSignature=JSON.stringify([data?.track?.id,data?.track?.title,artistLabel(data?.track||{}),data?.track?.album?.title,image(data?.track||{}),data?.track?.isrc,data?.track?.composers,data?.track?.performers,data?.track?.album?.label,data?.track?.album?.release_date_original]);
 if(app.overlay){
   const viewChanged=old!==fingerprint||app.lastVisualSignature!==trackSignature;
   const audioChanged=app.lastSourceSignature!==sourceSignature;
   app.lastSourceSignature=sourceSignature;
   app.lastVisualSignature=trackSignature;
   if(viewChanged)drawOverlay();
   else if(audioChanged){
     // Avoid destroying artwork, focus and scroll for every late decoder fact.
     const badge=document.querySelector('#overlay .aurel-source-pill span, #overlay .murglar-source-line span');
     const text=actualSource(data);
     if(badge&&badge.textContent!==text)badge.textContent=text;
     // Late metadata should update the current screen without rebuilding art.
     const caption=document.querySelector('#overlay .aurel-source-caption');
     const description=data?.error?'Playback unavailable':
       data?.buffering?'Connecting to audio…':
       data?.sourceVerified?'Source format · Qobuz metadata':
       data?.decoderSampleRateHz?'Media track format · Android':
       'Source format not confirmed';
     if(caption&&caption.textContent!==description)caption.textContent=description;
     if(app.playerSheet==='audio'){
       const details=document.querySelector('#overlay .aurel-detail-sheet');
       if(details)details.innerHTML=audioPanel(data);
     }
   }
 }
 }};
// The native action bridge is the sole route to Qobuz. No extra account tokens are shared.
document.addEventListener('click',function(ev){const b=ev.target.closest('button');if(!b)return;
 const action=(name)=>b.hasAttribute(name);
 if(b.dataset.discoverTab){ev.stopImmediatePropagation();app.discoverTab=b.dataset.discoverTab;renderHome();return}
 if(b.dataset.searchRecent){ev.stopImmediatePropagation();app.searchQuery=b.dataset.searchRecent;renderSearch();search();return}
 if(action('data-clear-recent')){ev.stopImmediatePropagation();try{localStorage.removeItem('aurel_recent_searches')}catch(_){}renderSearch();return}
 if(b.dataset.libraryLayout){ev.stopImmediatePropagation();app.libLayout=b.dataset.libraryLayout;renderLibrary();return}
 if(action('data-open-magazine')){ev.stopImmediatePropagation();nativeCall('openMagazine').catch(e=>showToast(e.message));return}
 if(b.hasAttribute('data-open-playing-artist')){ev.stopImmediatePropagation();openArtistFor(app.player?.track);return}
 if(b.hasAttribute('data-open-playing-album')){ev.stopImmediatePropagation();const id=app.player?.track?.album?.id;if(!id){showToast('No album ID in Qobuz metadata');return}app.overlay=false;drawOverlay();openAlbum(String(id));return}
 if(b.dataset.playerSheet){ev.stopImmediatePropagation();app.playerSheet=app.playerSheet===b.dataset.playerSheet?'':b.dataset.playerSheet;drawOverlay();return}
 if(b.dataset.queuePlay!==undefined){ev.stopImmediatePropagation();nativeCall('queuePlay',{index:Number(b.dataset.queuePlay)}).catch(e=>showToast(e.message));return}
 if(b.dataset.queueMove!==undefined){ev.stopImmediatePropagation();const from=Number(b.dataset.queueMove),to=from+Number(b.dataset.queueDir);nativeCall('queueMove',{from,to}).catch(e=>showToast(e.message));return}
 if(b.dataset.queueRemove!==undefined){ev.stopImmediatePropagation();nativeCall('queueRemove',{index:Number(b.dataset.queueRemove)}).catch(e=>showToast(e.message));return}
 if(b.dataset.miniFav){ev.stopImmediatePropagation();like('tracks',b.dataset.miniFav);return}
 if(action('data-add-to-queue')||action('data-play-next')){ev.stopImmediatePropagation();const items=trackSource(),i=Number(b.dataset.addToQueue??b.dataset.playNext);const chosen=items[i];if(chosen){
   const access=window.AurelTrackAccess?.status(chosen)||{playable:true};
   if(!access.playable){showToast(access.reason,5000);return;}
   nativeCall('queueAdd',{tracks:[chosen],next:action('data-play-next')})
     .then(()=>showToast('Added to play queue')).catch(e=>showToast(e.message));
 }return}
},true);
document.addEventListener('change',e=>{if(e.target.id==='libSort'){app.libSort=e.target.value;renderLibrary();}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.style.display='none';const parent=e.target.parentElement;if(parent&&parent.classList.contains('shelf-image'))parent.textContent='♪';}},true);
