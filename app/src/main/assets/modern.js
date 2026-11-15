'use strict';
/* Original AUREL interface. Inspired by familiar contemporary music-app patterns;
   no proprietary application code, logos or bundled artwork. */
app.discoverTab='new';
app.libSort='recent';
app.libLayout='grid';
app.playerSheet='';
app.lastQueueFingerprint='';
const trackSource=()=>app.selected?app.selectedTracks:(app.nav==='library'?app.libraryItems:app.results)||[];
function remembered(){try{const v=JSON.parse(localStorage.getItem('aurel_recent_searches')||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,10):[]}catch(_){return []}}
window.AurelSearchHistory=(query)=>{if(!query||query.length>120)return;const next=[query,...remembered().filter(s=>s.toLowerCase()!==query.toLowerCase())].slice(0,10);try{localStorage.setItem('aurel_recent_searches',JSON.stringify(next))}catch(_){}};
const fmtTrack=(t,i)=>`<button class="queue-item ${i===app.player?.index?'current':''}" data-queue-play="${i}"><span class="queue-cover">${art(t,'queue-image')||'<span>♪</span>'}</span><span class="queue-text"><strong>${html(t.title||'Untitled')}</strong><small>${html(artistLabel(t))}</small></span>${i===app.player?.index?'<span class="playing-indicator">♫</span>':''}</button>`;
function albumShelf(items){if(!items.length)return '<div class="empty">No releases have been returned by the connected account.</div>';return `<div class="album-shelf">${items.slice(0,30).map(o=>`<button class="shelf-card" data-open-album="${html(o.id)}"><span class="shelf-image">${art(o,'shelf-cover')||'<span class="shelf-placeholder">♪</span>'}</span><strong>${html(o.title||o.name||'Untitled')}</strong><span>${html(artistLabel(o))}</span>${Number(o.maximum_bit_depth)>16?'<em class="hires-tag">Hi-Res</em>':''}</button>`).join('')}</div>`}
renderHome=function(){
 const name=app.session?.profile?.displayName||'Listener';
 $('#screen').innerHTML=`<div class="page-heading"><h1>Discover</h1><button class="subtle-icon" data-nav="settings" aria-label="Settings">⚙</button></div>
 <div class="home-chips"><button class="chip ${app.discoverTab==='new'?'selected':''}" data-discover-tab="new">Home</button><button class="chip ${app.discoverTab==='albums'?'selected':''}" data-discover-tab="albums">New releases</button><button class="chip ${app.discoverTab==='collection'?'selected':''}" data-discover-tab="collection">Your library</button></div>
 ${app.discoverTab==='collection'?`<section class="welcome-panel"><span class="kicker">YOUR COLLECTION</span><h2>Everything you love,<br>in one place.</h2><p>Explore saved music from your library account.</p><button class="action-pill" data-nav="library">Open library ↗</button></section>`:
 `<section class="spotlight"><div class="spotlight-copy"><span class="kicker">AUREL / LOSSLESS LISTENING</span><h2>Listen deeper.</h2><p>Albums, artists and music worth your time.</p><button class="action-pill" data-nav="search">Explore music ↗</button></div><div class="spotlight-stack">${app.albums.slice(0,3).map(a=>art(a,'spotlight-cover')).join('')}</div></section>
 <div class="sectionhead new-section"><div><h2>${app.discoverTab==='albums'?'New releases':'Fresh on Qobuz'}</h2><p>Recently released albums available in the catalogue</p></div><button class="plain-action" data-refresh aria-label="Refresh releases">↻</button></div>${albumShelf(app.albums)}
 <div class="sectionhead"><div><h2>Go your own way</h2><p>Quick access to music that matters</p></div></div>
 <div class="quicklinks"><button data-nav="library">▦ <strong>Your favourites</strong><small>Releases, artists, playlists</small></button><button data-nav="search">⌕ <strong>Search catalogue</strong><small>Tracks, artists and albums</small></button></div>`}
 <p class="disclaimer">AUREL is an independent client. Catalogue and streaming depend on Qobuz authorization.</p>`;
};
function renderMagazine(){
 $('#screen').innerHTML=`<div class="page-heading"><h1>Magazine</h1></div><div class="magazine-hero"><span class="kicker">MUSIC / STORIES / ARTISTS</span><h2>Go beyond<br>the recording.</h2><p>Reviews, interviews and listening guides from Qobuz's editorial magazine.</p><button class="action-pill" data-open-magazine>Read Qobuz Magazine ↗</button></div>
 <div class="sectionhead"><div><h2>Music has a story</h2><p>Editorial articles open on Qobuz's official site</p></div></div>
 <div class="magazine-features"><div class="magazine-tile">✎<strong>Interviews</strong><small>The people behind the music</small></div><div class="magazine-tile">◎<strong>Album stories</strong><small>Context for deeper listening</small></div><div class="magazine-tile">♬<strong>Discoveries</strong><small>Genres, labels and recordings</small></div></div>
 <p class="disclaimer">Articles are not mirrored or redistributed inside AUREL.</p>`;
};
renderSearch=function(){
 const recent=remembered();
 $('#screen').innerHTML=`<div class="page-heading"><h1>Search</h1></div>
 <form id="searchForm" class="searchbox qsearch"><span aria-hidden="true">⌕</span><input id="searchInput" type="search" enterkeyhint="search" placeholder="Artists, albums, tracks…" autocomplete="off" value="${html(app.searchQuery)}"><button class="search-submit" type="submit" aria-label="Search">→</button></form>
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
function creditsPanel(p){const t=p.track||{},album=t.album||{};
 const value=(key,val)=>val?`<div class="credit"><span>${key}</span><strong>${html(val)}</strong></div>`:'';
 return `<div class="sheet-title">Recording details</div><div class="credits">${value('Track',t.title)}${value('Artist',artist(t))}${value('Album',album.title)}${value('Label',album.label?.name||album.label||t.label?.name)}${value('Released',album.release_date_original||album.release_date||album.releaseDate)}${value('Duration',t.duration?duration(t.duration):'')}${value('Copyright',album.copyright||album.copyright_label)}<p>Credits are displayed only when provided by Qobuz metadata.</p></div>`}
// Truthful format display: Qobuz reports source specifications; Android reports a
// parsed media track if MediaPlayer exposes one. Neither proves DAC bit-perfect output.
const kHzLabel=hz=>{const n=Number(hz);if(!Number.isFinite(n)||n<8000)return '';const k=n/1000;return `${Number(k.toFixed(3))} kHz`};
function actualSource(p){
 if(!p)return 'Format unavailable';
 const bits=Number(p.bits)||0,rate=kHzLabel(p.sampleRateHz);
 const mediaRate=kHzLabel(p.decoderSampleRateHz);
 const codec=p.codec||((p.decoderMime||'').toLowerCase().includes('flac')?'FLAC':'');
 if(p.sourceVerified && bits && rate)return `${codec?codec+' · ':''}${bits}-bit / ${rate}`;
 if(mediaRate)return `${p.decoderMime?.includes('flac')?'FLAC · ':''}${mediaRate} · parsed track`;
 if(p.buffering)return 'Checking audio source…';
 return 'Audio quality unavailable';
}
const bytesText=n=>Number(n)>0?`${(Number(n)/1048576).toFixed(1)} MB`:'Not reported';
function audioPanel(p){
 const source=p?.sourceVerified?'Qobuz API (reported, not independently decoded)':'Not supplied by Qobuz API';
 const decoderHz=kHzLabel(p?.decoderSampleRateHz);
 const fields=[
  ['Qobuz source',p?.sourceVerified?`${p.bits}-bit / ${kHzLabel(p.sampleRateHz)}`:'Unknown'],
  ['Source provenance',source],
  ['Source codec',p?.codec||'Not reported'],
  ['MediaPlayer parsed format',p?.decoderMime||'Not reported'],
  ['MediaPlayer track rate',decoderHz||'Not exposed by Android'],
  ['MediaPlayer channels',p?.decoderChannels||'Not reported'],
  ['Android default output property',p?.androidMixerHz?`${p.androidMixerHz} Hz (not DAC measurement)`:'Not reported'],
  ['Qobuz file size',bytesText(p?.fileSize)],
  ['Selected quality ceiling',qualityText(p?.quality)]
 ];
 return `<div class="sheet-title">Audio signal information</div><div class="credits">${fields.map(([key,val])=>`<div class="credit"><span>${html(key)}</span><strong>${html(val)}</strong></div>`).join('')}
 <p>Bit depth is displayed only when returned by Qobuz. MediaPlayer can sometimes expose a parsed track sample rate and MIME type; this does not guarantee the physical DAC's output format or bit-perfect playback. Android may resample audio.</p></div>`;
}

const ic=(key,size=24)=>{
 const path={
  down:'<path d="m6 9 6 6 6-6"/>',more:'<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.7 7.7L12 21l8.8-8.7a5.5 5.5 0 0 0 0-7.7Z"/>',
  shuffle:'<path d="m18 14 4 4-4 4m0-20 4 4-4 4M2 18h2.5c6 0 9-12 15-12H22M2 6h2.5c2 0 3.5 1.6 5 4M14 16c1.6 1.5 3.4 2 6 2h2"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  prev:'<path d="M6 5v14M19 6 9 12l10 6V6Z"/>',next:'<path d="M18 5v14M5 6l10 6-10 6V6Z"/>',
  play:'<path d="m8 5 12 7-12 7V5Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',
  queue:'<path d="M4 6h16M4 12h16M4 18h9"/><path d="m17 16 4 2-4 2z"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
  audio:'<path d="M5 9v6M9 6v12M13 3v18M17 7v10M21 10v4"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  library:'<rect x="3" y="3" width="15" height="18" rx="2"/><path d="M7 7h7M7 11h7M7 15h6M21 7v14"/>',
  search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m10 2 1 2h2l1-2 3 2-.3 2.1 1.8 1 2-.8 1.1 3.4-1.7 1.4v2l1.7 1.4-1.1 3.4-2-.8-1.8 1L17 20l-3 2-1-2h-2l-1 2-3-2 .3-2.1-1.8-1-2 .8-1.1-3.4 1.7-1.4v-2l-1.7-1.4 1.1-3.4 2 .8 1.8-1L7 4z"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 5M20 4v7h-7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  close:'<path d="m18 9-6 6-6-6"/>',
  album:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>',
 }[key]||'';
 return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};
const artistButton=(t)=>`<button class="player-artist-link" data-open-playing-artist aria-label="Open ${html(artistLabel(t))} discography"><span>${html(artistLabel(t))}</span>${ic('chevron',19)}</button>`;
updateMini=function(){const p=app.player,m=$('#mini');if(!p?.track?.id){m.classList.add('hidden');return}const t=p.track;m.classList.remove('hidden');m.innerHTML=`${art(t,'minicover')||'<span class="minicover placeholder">♪</span>'}<div class="meta"><div class="title">${html(t.title||'Untitled')}</div><div class="artist">${html(artistLabel(t))}</div></div><button class="mini-love" data-mini-fav="${html(t.id)}" aria-label="Add to favourites">${ic('heart',23)}</button><button class="mini-play" data-mini-toggle aria-label="${p.playing?'Pause':'Play'}">${ic(p.playing?'pause':'play',25)}</button><div class="mini-progress" style="--played:${p.duration?Math.round(100*(p.position||0)/p.duration):0}%"></div>`;};
drawOverlay=function(){
 const overlay=$('#overlay');
 if(!app.overlay){overlay.classList.add('hidden');overlay.innerHTML='';return}
 const p=app.player||{},t=p.track||{},src=image(t),active=app.playerSheet||'';
 const progressTotal=Math.max(0,Number(p.duration)||0),position=Math.min(progressTotal,Math.max(0,Number(p.position)||0));
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
    <input id="progress" class="progress" type="range" min="0" max="${progressTotal||100}" step="500" value="${position}" aria-label="Playback position">
    <div class="aurel-timeline-labels"><span id="elapsed">${duration(position/1000)}</span><button class="aurel-source-pill" data-player-sheet="audio" aria-label="Show audio source information">${ic('audio',17)}<span>${html(format)}</span></button><span id="remaining">${duration(progressTotal/1000)}</span></div>
   </section>
   <section class="aurel-main-actions" aria-label="Playback controls">
    <button data-prev aria-label="Previous track" class="aurel-transport side">${ic('prev',33)}</button>
    <button id="full-toggle" data-full-toggle aria-label="${p.playing?'Pause':'Play'}" class="aurel-transport middle">${ic(p.playing?'pause':'play',40)}</button>
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
 const q=data?.queue||[];const fingerprint=JSON.stringify([q.map(x=>x?.id),data?.index]);app.lastQueueFingerprint=fingerprint;
 const sourceSignature=JSON.stringify([data?.sourceVerified,data?.bits,data?.sampleRateHz,data?.codec,data?.sourceLabel,data?.decoderSampleRateHz,data?.decoderMime]);
 const trackSignature=JSON.stringify([data?.track?.id,data?.track?.title,artistLabel(data?.track||{}),data?.track?.album?.title,image(data?.track||{})]);
 if(app.overlay&&(old!==fingerprint||app.lastSourceSignature!==sourceSignature||app.lastVisualSignature!==trackSignature)){
    app.lastSourceSignature=sourceSignature;app.lastVisualSignature=trackSignature;drawOverlay();
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
 if(action('data-add-to-queue')||action('data-play-next')){ev.stopImmediatePropagation();const items=trackSource(),i=Number(b.dataset.addToQueue??b.dataset.playNext);const chosen=items[i];if(chosen)nativeCall('queueAdd',{tracks:[chosen],next:action('data-play-next')}).then(()=>showToast('Added to play queue')).catch(e=>showToast(e.message));return}
},true);
document.addEventListener('change',e=>{if(e.target.id==='libSort'){app.libSort=e.target.value;renderLibrary();}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.style.display='none';const parent=e.target.parentElement;if(parent&&parent.classList.contains('shelf-image'))parent.textContent='♪';}},true);
