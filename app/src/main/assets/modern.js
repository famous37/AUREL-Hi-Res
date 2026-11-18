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
const fmtTrack=(t,i)=>{
 const state=window.AurelTrackAccess?.status(t)||{playable:true};
 return `<button class="queue-item ${i===app.player?.index?'current':''}" data-queue-play="${i}" ${state.playable?'':'disabled'}><span class="queue-cover">${art(t,'queue-image')||'<span>♪</span>'}</span><span class="queue-text"><strong>${html(t.title||'Untitled')}</strong><small>${html(state.playable?artistLabel(t):'Unavailable for streaming')}</small></span>${i===app.player?.index?'<span class="playing-indicator">♫</span>':''}</button>`;
};
function albumShelf(items){if(!items.length)return '<div class="empty">No releases have been returned by the connected account.</div>';return `<div class="album-shelf">${items.slice(0,30).map(o=>`<button class="shelf-card" data-open-album="${html(o.id)}"><span class="shelf-image">${art(o,'shelf-cover')||'<span class="shelf-placeholder">♪</span>'}</span><strong>${html(o.title||o.name||'Untitled')}</strong><span>${html(artistLabel(o))}</span>${Number(o.maximum_bit_depth)>16?'<em class="hires-tag">Hi-Res</em>':''}</button>`).join('')}</div>`}
renderHome=function(){
 const name=app.session?.profile?.displayName||'Listener';
 $('#screen').innerHTML=`<div class="page-heading"><h1>Discover</h1><button class="subtle-icon" data-nav="settings" aria-label="Settings">${ic('settings',26)}</button></div>
 ${app.session?.streamValidation==='unverified'?
 '<div class="auth-status-banner" role="status">'+ic('info',21)+'<div><strong>Session saved, not verified</strong><span>The Qobuz API did not confirm this token. Try playing a track to check streaming access.</span></div></div>':''}
 <div class="home-chips"><button class="chip ${app.discoverTab==='new'?'selected':''}" data-discover-tab="new">Home</button><button class="chip ${app.discoverTab==='albums'?'selected':''}" data-discover-tab="albums">New releases</button><button class="chip ${app.discoverTab==='collection'?'selected':''}" data-discover-tab="collection">Your library</button></div>
 ${app.discoverTab==='collection'?`<section class="welcome-panel"><span class="kicker">YOUR COLLECTION</span><h2>Everything you love,<br>in one place.</h2><p>Explore saved music from your library account.</p><button class="action-pill" data-nav="library">Open library ↗</button></section>`:
 `<section class="spotlight"><div class="spotlight-copy"><span class="kicker">AUREL / LOSSLESS LISTENING</span><h2>Listen deeper.</h2><p>Albums, artists and music worth your time.</p><button class="action-pill" data-nav="search">Explore music ↗</button></div><div class="spotlight-stack">${app.albums.slice(0,3).map(a=>art(a,'spotlight-cover')).join('')}</div></section>
 <div class="sectionhead new-section"><div><h2>${app.discoverTab==='albums'?'New releases':'Fresh on Qobuz'}</h2><p>Recently released albums available in the catalogue</p></div><button class="plain-action" data-refresh aria-label="Refresh releases">${ic('refresh',25)}</button></div>${albumShelf(app.albums)}
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
 if(p.playing)return bitrate||'Playing · exact stream format not reported';
 return 'Stream quality unavailable · tap Audio';
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
 <p>FLAC bit depth and sample rate can be verified from STREAMINFO using a short ranged read of the existing media URL. MP3 frame bitrate may vary. Qobuz catalogue maximum and Android mixer / DAC output are different measurements.</p></div>`;
}

const ic=(key,size=24)=>{
 const path={
  down:'<path d="m6 9 6 6 6-6"/>',more:'<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.7 7.7L12 21l8.8-8.7a5.5 5.5 0 0 0 0-7.7Z"/>',
  shuffle:'<path d="m18 14 4 4-4 4M2 18h2.5c6 0 9-12 15-12H22M18 2l4 4-4 4M2 6h2.5c2 0 3.5 1.6 5 4M14 16c1.6 1.5 3.4 2 6 2"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  prev:'<path d="M6 5v14M19 6 9 12l10 6V6Z"/>',next:'<path d="M18 5v14M5 6l10 6-10 6V6Z"/>',
  play:'<path d="m8 5 12 7-12 7V5Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',
  queue:'<path d="M4 6h16M4 12h16M4 18h9"/><path d="m17 16 4 2-4 2z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  audio:'<path d="M5 9v6M9 6v12M13 3v18M17 7v10M21 10v4"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  eye:'<path d="M2 12s3.6-6.7 10-6.7S22 12 22 12s-3.6 6.7-10 6.7S2 12 2 12z"/><circle cx="12" cy="12" r="3.4"/>',
  key:'<circle cx="8" cy="15" r="4.5"/><path d="M11.5 11.5 21 2l1 4-4 1-1 4-4 1"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  'shield-check':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  'external-link':'<path d="M13 5h6v6m0-6-9 9"/><path d="M20 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/>',
  'eye-off':'<path d="M4 4l16 16M10 5.6a10.7 10.7 0 0 1 2-.2c6.4 0 10 6.6 10 6.6a16 16 0 0 1-3.1 3.8M6.1 6.3C3.4 8.2 2 12 2 12s3.6 6.7 10 6.7c1.1 0 2.2-.2 3.2-.6"/><path d="M9.5 9.5a3.4 3.4 0 0 0 5 5"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  library:'<rect x="3" y="3" width="15" height="18" rx="2"/><path d="M7 7h7M7 11h7M7 15h6M21 7v14"/>',
  search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  'arrow-right':'<path d="M4 12h16m-7-7 7 7-7 7"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m10 2 1 2h2l1-2 3 2-.3 2.1 1.8 1 2-.8 1.1 3.4-1.7 1.4v2l1.7 1.4-1.1 3.4-2-.8-1.8 1L17 20l-3 2-1-2h-2l-1 2-3-2 .3-2.1-1.8-1-2 .8-1.1-3.4 1.7-1.4v-2l-1.7-1.4 1.1-3.4 2 .8 1.8-1L7 4z"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 5M20 4v7h-7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  close:'<path d="m18 9-6 6-6-6"/>',
  album:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>',
  share:'<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m7.9 11 8.2-4.9M7.9 13l8.2 4.9"/>',
 }[key]||'';
 return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};
/** Shared vector family and playback-state glyph selection. */
const aurelPlaybackMode=p=>p?.buffering&&!p?.error?'loading':p?.playing?'pause':'play';
const aurelSpinner=(size=28)=>`<svg class="aurel-spinner" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="aurel-spinner-track" cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2.6" opacity=".20"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`;
const aurelPlaybackIcon=(p,size=28)=>aurelPlaybackMode(p)==='loading'?aurelSpinner(size):ic(aurelPlaybackMode(p),size);
const aurelPlaybackLabel=p=>aurelPlaybackMode(p)==='loading'?'Loading audio':p?.playing?'Pause':'Play';
const artistButton=(t)=>`<button class="player-artist-link" data-open-playing-artist aria-label="Open ${html(artistLabel(t))} discography"><span>${html(artistLabel(t))}</span>${ic('chevron',19)}</button>`;
let aurelMiniAnimating=false;
let aurelLastMiniFrame=0;
function wakeAurelMiniAnimation(){
 if(aurelMiniAnimating||!app.player?.playing||typeof requestAnimationFrame!=='function')return;
 aurelMiniAnimating=true;
 requestAnimationFrame(aurelMiniFrame);
}
function aurelMiniFrame(time){
 if(!app.player?.playing || document.hidden){
   aurelMiniAnimating=false;
   return;
 }
 if(time-aurelLastMiniFrame>=110){
   aurelLastMiniFrame=time;
   const p=app.player,clock=window.AurelProgressClock;
   const durationMs=Number(p.duration)||0;
   if(durationMs>0 && clock){
     const position=clock.read(p);
     const ratio=Math.max(0,Math.min(1,position/durationMs));
     const fill=document.querySelector('#mini .mini-progress-fill');
     if(fill)fill.style.transform='scaleX('+ratio.toFixed(6)+')';
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
 requestAnimationFrame(aurelMiniFrame);
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
 if(m.dataset.miniTrack!==id||!m.querySelector('.mini-track-open')){
  m.innerHTML=`${cover?'<img class="minicover" src="'+html(cover)+'" alt="Album art" loading="eager">':'<span class="minicover placeholder">♪</span>'}
   <div class="meta mini-track-open"><strong class="title"></strong><small class="artist"></small></div>
   <div class="mini-buttons"><button class="mini-love" data-mini-fav="${html(id)}" aria-label="Add to favourites">${ic('heart',24)}</button>
   <button class="mini-play" data-mini-toggle aria-label="Play">${ic('play',26)}</button></div>
   <div class="mini-progress" aria-hidden="true"><span class="mini-progress-fill"></span></div>`;
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
 const position=window.AurelProgressClock?.accept(p)??(Number(p.position)||0);
 const bar=m.querySelector('.mini-progress');
 const percent=p.duration?Math.min(100,Math.max(0,100*position/Number(p.duration))):0;
 if(bar){
   bar.style.setProperty('--played',percent.toFixed(2)+'%');
   const fill=bar.querySelector('.mini-progress-fill');
   if(fill)fill.style.transform='scaleX('+(percent/100).toFixed(6)+')';
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
     const badge=document.querySelector('#overlay .murglar-source-line span');
     const text=actualSource(data);
     if(badge&&badge.textContent!==text)badge.textContent=text;
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
