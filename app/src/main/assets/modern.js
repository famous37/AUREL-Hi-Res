'use strict';
/* Original AUREL interface. Inspired by familiar contemporary music-app patterns;
   no proprietary application code, logos or bundled artwork. */
app.discoverTab='new';
app.libSort='recent';
app.libLayout='grid';
app.playerSheet='upnext';
app.lastQueueFingerprint='';
const trackSource=()=>app.selected?app.selectedTracks:(app.nav==='library'?app.libraryItems:app.results)||[];
function remembered(){try{const v=JSON.parse(localStorage.getItem('aurel_recent_searches')||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,10):[]}catch(_){return []}}
window.AurelSearchHistory=(query)=>{if(!query||query.length>120)return;const next=[query,...remembered().filter(s=>s.toLowerCase()!==query.toLowerCase())].slice(0,10);try{localStorage.setItem('aurel_recent_searches',JSON.stringify(next))}catch(_){}};
const fmtTrack=(t,i)=>`<button class="queue-item ${i===app.player?.index?'current':''}" data-queue-play="${i}"><span class="queue-cover">${art(t,'queue-image')||'<span>♪</span>'}</span><span class="queue-text"><strong>${html(t.title||'Untitled')}</strong><small>${html(artist(t))}</small></span>${i===app.player?.index?'<span class="playing-indicator">♫</span>':''}</button>`;
function albumShelf(items){if(!items.length)return '<div class="empty">No releases have been returned by the connected account.</div>';return `<div class="album-shelf">${items.slice(0,30).map(o=>`<button class="shelf-card" data-open-album="${html(o.id)}"><span class="shelf-image">${art(o,'shelf-cover')||'<span class="shelf-placeholder">♪</span>'}</span><strong>${html(o.title||o.name||'Untitled')}</strong><span>${html(artist(o))}</span>${Number(o.maximum_bit_depth)>16?'<em class="hires-tag">Hi-Res</em>':''}</button>`).join('')}</div>`}
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
renderMagazine=function(){
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
 else if(kind==='albums')contents=app.libLayout==='list'?`<div class="library-album-list">${displaySort(items).map(o=>`<button class="library-album-row" data-open-album="${html(o.id)}">${art(o,'library-row-image')||'<span class="library-row-image placeholder">♪</span>'}<span><strong>${html(o.title||'Untitled')}</strong><small>${html(artist(o))}</small></span><b>›</b></button>`).join('')}</div>`:albumCards(displaySort(items));
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
function actualSource(p){
 const bits=Number(p?.bits)||0, hz=Number(p?.sampleRateHz)||0;
 const kHz=hz>=1000?hz/1000:0;
 if(p?.sourceVerified && bits && kHz){
   const rate=Number.isInteger(kHz)?String(kHz):String(Number(kHz.toFixed(3)));
   return `${html(p.codec||'Lossless')} · ${bits}-bit / ${rate} kHz`;
 }
 return p?.sourceLabel==='Local file (verified)'?'Local audio · format not confirmed':'Source quality not verified';
}
const bytesText=n=>Number(n)>0?`${(Number(n)/1048576).toFixed(1)} MB`:'Not reported';
function audioPanel(p){
 const fields=[['Source',actualSource(p)],['Verification',p.sourceVerified?(p.sourceLabel||'Qobuz API'):'Not verified by Qobuz API'],
 ['Codec / container',p.mimeType||p.codec||'Not reported'],['Channels',p.channels||'Not reported'],
 ['File size',bytesText(p.fileSize)],['Android mixer',p.androidMixerHz?`${p.androidMixerHz} Hz`:'Not reported'],
 ['Requested ceiling',qualityText(p.quality)]];
 return `<div class="sheet-title">Audio information</div><div class="credits">${fields.map(([key,val])=>`<div class="credit"><span>${html(key)}</span><strong>${html(val)}</strong></div>`).join('')}
 <p>The API-reported source format is not a measurement of the DAC output. Android may resample. No software EQ or DSP is applied by AUREL.</p></div>`;
}
updateMini=function(){const p=app.player,m=$('#mini');if(!p?.track?.id){m.classList.add('hidden');return}const t=p.track;m.classList.remove('hidden');m.innerHTML=`${art(t,'minicover')||'<span class="minicover placeholder">♪</span>'}<div class="meta"><div class="title">${html(t.title||'Untitled')}</div><div class="artist">${html(artist(t))}</div></div><button class="mini-love" data-mini-fav="${html(t.id)}" aria-label="Add to favourites">♡</button><button class="mini-play" data-mini-toggle aria-label="${p.playing?'Pause':'Play'}">${p.playing?'Ⅱ':'▶'}</button><div class="mini-progress" style="--played:${p.duration?Math.round(100*(p.position||0)/p.duration):0}%"></div>`;};
drawOverlay=function(){
 const overlay=$('#overlay');if(!app.overlay){overlay.classList.add('hidden');overlay.innerHTML='';return}
 const p=app.player||{},t=p.track||{},src=image(t);
 overlay.classList.remove('hidden');overlay.style.setProperty('--cover-image',src?`url("${src}")`:'none');
 overlay.innerHTML=`<div class="modern-player"><div class="player-nav">
  <button class="player-back" data-close-overlay aria-label="Close player">⌄</button><span>Now playing</span>
  <button class="player-options" data-player-sheet="audio" aria-label="Audio information">⋮</button></div>
 <div class="player-art-wrap">${src?`<img src="${html(src)}" alt="Cover of the playing album" class="large-art">`:'<div class="large-art art-placeholder">♫</div>'}</div>
 <div class="now-quality"><span class="quality-chip">◎ &nbsp; ${actualSource(p)}</span><span class="device-chip">♧ &nbsp; ${p.androidMixerHz?`${p.androidMixerHz} Hz mixer`:'Android audio'}</span></div>
 <div class="player-track"><div><h1>${html(t.title||'Choose a track')}</h1><p>${html(artist(t))}${t.album?.title?' · '+html(t.album.title):''}</p></div>
 <button class="love-now" data-like-track="${html(t.id||'')}" aria-label="Add to favourites">♡</button><button class="more-now" data-download-playing aria-label="Download purchased track">↓</button></div>
 <div class="player-progress"><input id="progress" class="progress" type="range" min="0" max="${Number(p.duration)||100}" step="500" value="${Number(p.position)||0}" aria-label="Playback position"><div class="timebar"><span id="elapsed">${duration((p.position||0)/1000)}</span><span id="remaining">-${duration(Math.max(0,(p.duration||0)-(p.position||0))/1000)}</span></div></div>
 <div class="controls"><button class="ctrl ${p.shuffle?'active':''}" data-shuffle title="Shuffle" id="full-shuffle">⤨</button><button class="ctrl previous" data-prev aria-label="Previous">|◀</button><button id="full-toggle" class="main-play" data-full-toggle aria-label="Play or pause">${p.playing?'Ⅱ':'▶'}</button><button class="ctrl next" data-next aria-label="Next">▶|</button><button id="full-repeat" class="ctrl ${p.repeat?'active':''}" data-repeat title="Repeat">${p.repeat===2?'↻¹':'↻'}</button></div>
 <div class="player-tools"><button class="${app.playerSheet==='upnext'?'active':''}" data-player-sheet="upnext"><span class="tool-symbol">☷</span><span>Queue</span></button><button class="${app.playerSheet==='credits'?'active':''}" data-player-sheet="credits"><span class="tool-symbol">ⓘ</span><span>Credits</span></button><button class="${app.playerSheet==='audio'?'active':''}" data-player-sheet="audio"><span class="tool-symbol">◎</span><span>Audio</span></button><button data-open-downloads><span class="tool-symbol">⇩</span><span>Downloads</span></button></div>
 <div class="player-sheet">${app.playerSheet==='upnext'?queuePanel(p):app.playerSheet==='credits'?creditsPanel(p):audioPanel(p)}</div>
 ${p.error?`<div class="playback-error">${html(p.error)}</div>`:''}<div id="playingStatus" class="assistive-state">${p.buffering?'BUFFERING':p.playing?'PLAYING':'PAUSED'}</div></div>`;
};
const formerEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 if(kind==='download'){
    app.downloadProgress=data;
    if(data?.message){showToast(data.message,4400)}
    if(app.nav==='downloads')loadDownloads();
    return;
 }
 const old=app.lastQueueFingerprint;formerEvent(kind,data);if(kind==='player'){
 const q=data?.queue||[];const fingerprint=JSON.stringify([q.map(x=>x?.id),data?.index]);app.lastQueueFingerprint=fingerprint;
 if(app.overlay&&(old!==fingerprint||app.lastSourceSignature!==JSON.stringify([data?.sourceVerified,data?.bits,data?.sampleRateHz,data?.codec,data?.sourceLabel]))){
    app.lastSourceSignature=JSON.stringify([data?.sourceVerified,data?.bits,data?.sampleRateHz,data?.codec,data?.sourceLabel]);drawOverlay();
 }
 }};
// The native action bridge is the sole route to Qobuz. No extra account tokens are shared.
document.addEventListener('click',function(ev){const b=ev.target.closest('button');if(!b)return;
 const action=(name)=>b.hasAttribute(name);
 if(b.hasAttribute('data-download-index')){
    ev.stopImmediatePropagation();const i=Number(b.dataset.downloadIndex),t=trackSource()[i];
    if(t)nativeCall('downloadTrack',{track:t}).then(()=>showToast('Checking Qobuz purchase rights…')).catch(e=>showToast(e.message));return;
 }
 if(b.hasAttribute('data-download-album')){
    ev.stopImmediatePropagation();nativeCall('downloadAlbum',{tracks:app.selectedTracks}).then(()=>showToast('Checking purchased album tracks…')).catch(e=>showToast(e.message));return;
 }
 if(b.dataset.downloadArtist){ev.stopImmediatePropagation();nativeCall('downloadArtist',{id:b.dataset.downloadArtist}).then(()=>showToast('Checking purchased artist albums…')).catch(e=>showToast(e.message));return;}
 if(b.hasAttribute('data-download-playing')){ev.stopImmediatePropagation();const track=app.player?.track;if(track)nativeCall('downloadTrack',{track}).then(()=>showToast('Checking purchase rights…')).catch(e=>showToast(e.message));return;}
 if(b.hasAttribute('data-open-downloads')){ev.stopImmediatePropagation();app.overlay=false;drawOverlay();app.selected=null;app.nav='downloads';loadDownloads();return;}
 if(b.dataset.localPlay){ev.stopImmediatePropagation();nativeCall('playDownloaded',{file:b.dataset.localPlay}).then(()=>{app.overlay=true;drawOverlay()}).catch(e=>showToast(e.message));return;}
 if(b.dataset.discoverTab){ev.stopImmediatePropagation();app.discoverTab=b.dataset.discoverTab;renderHome();return}
 if(b.dataset.searchRecent){ev.stopImmediatePropagation();app.searchQuery=b.dataset.searchRecent;renderSearch();search();return}
 if(action('data-clear-recent')){ev.stopImmediatePropagation();try{localStorage.removeItem('aurel_recent_searches')}catch(_){}renderSearch();return}
 if(b.dataset.libraryLayout){ev.stopImmediatePropagation();app.libLayout=b.dataset.libraryLayout;renderLibrary();return}
 if(action('data-open-magazine')){ev.stopImmediatePropagation();nativeCall('openMagazine').catch(e=>showToast(e.message));return}
 if(b.dataset.playerSheet){ev.stopImmediatePropagation();app.playerSheet=b.dataset.playerSheet;drawOverlay();return}
 if(b.dataset.queuePlay!==undefined){ev.stopImmediatePropagation();nativeCall('queuePlay',{index:Number(b.dataset.queuePlay)}).catch(e=>showToast(e.message));return}
 if(b.dataset.queueMove!==undefined){ev.stopImmediatePropagation();const from=Number(b.dataset.queueMove),to=from+Number(b.dataset.queueDir);nativeCall('queueMove',{from,to}).catch(e=>showToast(e.message));return}
 if(b.dataset.queueRemove!==undefined){ev.stopImmediatePropagation();nativeCall('queueRemove',{index:Number(b.dataset.queueRemove)}).catch(e=>showToast(e.message));return}
 if(b.dataset.miniFav){ev.stopImmediatePropagation();like('tracks',b.dataset.miniFav);return}
 if(action('data-add-to-queue')||action('data-play-next')){ev.stopImmediatePropagation();const items=trackSource(),i=Number(b.dataset.addToQueue??b.dataset.playNext);const chosen=items[i];if(chosen)nativeCall('queueAdd',{tracks:[chosen],next:action('data-play-next')}).then(()=>showToast('Added to play queue')).catch(e=>showToast(e.message));return}
},true);
document.addEventListener('change',e=>{if(e.target.id==='libSort'){app.libSort=e.target.value;renderLibrary();}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.style.display='none';const parent=e.target.parentElement;if(parent&&parent.classList.contains('shelf-image'))parent.textContent='♪';}},true);

async function loadDownloads(){try{app.downloaded=await api('downloadedFiles',{},true);if(app.nav==='downloads')renderDownloads()}catch(e){showToast(e.message)}}
function renderDownloads(){const items=app.downloaded?.items||[];
 $('#screen').innerHTML=`<div class="page-heading"><h1>Downloads</h1><button class="subtle-icon" data-nav="settings">⚙</button></div>
 <p class="subline">Purchased recordings downloaded with Qobuz authorization. Tap a file to play it locally.</p>
 <div class="download-progress">${html(app.downloadProgress?.message||'Only purchased tracks are downloadable. Subscription-only audio remains in the official Qobuz app for offline listening.')}</div>
 <div class="downloaded-list">${items.length?items.map(f=>`<button class="downloaded-item" data-local-play="${html(f.name)}"><span>♪</span><strong>${html(f.name)}</strong><small>${bytesText(f.bytes)}</small><b>▶</b></button>`).join(''):'<div class="empty">No purchased tracks downloaded yet.</div>'}</div>
 <p class="disclaimer">Files are stored in private AUREL application storage and are removed when the app is uninstalled. Developer: famous37</p>`;
}
