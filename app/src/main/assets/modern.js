
'use strict';
// AUREL original interface module. Qobuz-inspired layout, not copied source.
app.discoverTab='home';app.libSort='recent';app.libLayout='grid';app.playerSheet='upnext';
function remembered(){try{const v=JSON.parse(localStorage.getItem('aurel_searches')||'[]');return Array.isArray(v)?v.slice(0,9):[]}catch(e){return []}}
window.AurelSearchHistory=q=>{if(!q)return;try{localStorage.setItem('aurel_searches',JSON.stringify([q,...remembered().filter(x=>x!==q)].slice(0,9)))}catch(e){}};
function shelf(items){return '<div class="a-shelf">'+(items||[]).map(o=>'<button class="a-card" data-open-album="'+html(o.id)+'"><div class="a-art">'+(art(o)||'♪')+'</div><b>'+html(o.title||o.name)+'</b><small>'+html(artist(o))+'</small>'+(Number(o.maximum_bit_depth)>16?'<em>HI-RES</em>':'')+'</button>').join('')+'</div>'}
renderHome=function(){
const items=app.albums||[];
$('#screen').innerHTML='<div class="a-heading"><h1>Discover</h1><button data-nav="settings">⚙</button></div>'+
'<div class="a-tabs"><button class="'+(app.discoverTab==='home'?'active':'')+'" data-discover-tab="home">Home</button><button class="'+(app.discoverTab==='releases'?'active':'')+'" data-discover-tab="releases">New releases</button><button data-nav="library">Your library</button></div>'+
'<div class="a-hero"><small>AUREL · LOSSLESS MUSIC</small><h2>Listen deeper.</h2><p>The albums, artists and recordings you love.</p><button data-nav="search">Explore music ↗</button></div>'+
'<div class="a-section"><h2>'+ (app.discoverTab==='releases'?'New releases':'Fresh on Qobuz')+'</h2><button data-refresh>↻</button></div>'+
(items.length?shelf(items):'<div class="empty">No catalogue releases returned. Check your account connection.<button class="pill secondary" data-refresh>Refresh</button></div>')+
'<div class="a-section"><h2>My music</h2></div><div class="a-actions"><button data-nav="library">▦ <b>Your collection</b><small>Saved albums, artists and playlists</small></button><button data-nav="search">⌕ <b>Find music</b><small>Search the complete catalogue</small></button></div><p class="disclaimer">Independent client. Streaming availability depends on Qobuz authorization.</p>';
};
renderMagazine=function(){$('#screen').innerHTML='<div class="a-heading"><h1>Magazine</h1></div><div class="a-hero"><small>STORIES BEHIND THE SOUND</small><h2>Listen with context.</h2><p>Artist stories, interviews and album guides from the official Qobuz Magazine.</p><button data-open-magazine>Read Qobuz Magazine ↗</button></div><p class="disclaimer">Editorial stories open on the official publisher’s website. No articles are reproduced.</p>'};
renderSearch=function(){
const rec=remembered();
$('#screen').innerHTML='<div class="a-heading"><h1>Search</h1></div><form id="searchForm" class="searchbox"><span>⌕</span><input type="search" id="searchInput" enterkeyhint="search" placeholder="Artists, albums, tracks…" value="'+html(app.searchQuery)+'"><button type="submit">↗</button></form>'+
'<div class="tabs">'+['tracks','albums','artists'].map(t=>'<button class="tab '+(t===app.searchType?'active':'')+'" data-search-type="'+t+'">'+t[0].toUpperCase()+t.slice(1)+'</button>').join('')+'</div>'+
(!app.searchQuery&&rec.length?'<div class="a-section"><h2>Recent searches</h2><button data-clear-searches>Clear</button></div><div class="a-recents">'+rec.map(q=>'<button data-pick-search="'+html(q)+'">↗　'+html(q)+' <span>›</span></button>').join('')+'</div>':'')+
'<div id="searchResults">'+(app.searchBusy?'<div class="loading">Searching Qobuz…</div>':searchResults())+'</div>';
};
renderLibrary=function(){
const kind=app.libType,arr=kind==='playlists'?(app.playlists||[]):(app.libraryItems||[]);
const sorted=[...arr];if(app.libSort==='alpha')sorted.sort((a,b)=>String(a.title||a.name||'').localeCompare(String(b.title||b.name||'')));if(app.libSort==='artist')sorted.sort((a,b)=>artist(a).localeCompare(artist(b)));
const tabs=[['playlists','Playlists'],['albums','Releases'],['tracks','Tracks'],['artists','Artists']];
let content='';
if((kind==='playlists'&&app.playlistsLoading)||(kind!=='playlists'&&app.libraryLoading))content='<div class="loading">Loading collection…</div>';
else if(kind==='playlists')content=sorted.length?'<div class="a-list">'+sorted.map(o=>'<button data-playlist-id="'+html(o.id)+'">▤　<b>'+html(o.name)+'</b><small>'+Number(o.tracks_count||0)+' tracks</small> ›</button>').join('')+'</div>':'<div class="empty">No playlists available.</div>';
else if(kind==='albums'&&app.libLayout==='list')content='<div class="a-list">'+sorted.map(o=>'<button data-open-album="'+html(o.id)+'">'+(art(o,'a-thumb')||'♪')+' <b>'+html(o.title)+'</b><small>'+html(artist(o))+'</small> ›</button>').join('')+'</div>';
else if(kind==='albums')content=albumCards(sorted);
else if(kind==='tracks')content=listTracks(sorted);
else content=artistRows(sorted);
$('#screen').innerHTML='<div class="a-heading"><h1>Library</h1><button data-nav="settings">＋</button></div><p class="subline">'+(app.session?.libraryConnected?'Separate collection account':'Saved music from your streaming account')+'</p>'+
'<div class="tabs a-tabs">'+tabs.map(x=>'<button class="tab '+(kind===x[0]?'active':'')+'" data-lib-type="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+
'<div class="a-sort">Sort <select id="libSort"><option value="recent">Recently added</option><option value="alpha" '+(app.libSort==='alpha'?'selected':'')+'>Title</option><option value="artist" '+(app.libSort==='artist'?'selected':'')+'>Artist</option></select>'+(kind==='albums'?'<button data-lib-layout="grid">▦</button><button data-lib-layout="list">☷</button>':'')+'</div><div id="libraryContent">'+content+'</div>';
};
updateMini=function(){const p=app.player,m=$('#mini');if(!p?.track?.id){m.classList.add('hidden');return}const t=p.track;m.classList.remove('hidden');m.innerHTML=(art(t,'a-thumb')||'<span class="a-thumb">♪</span>')+'<div class="meta"><div class="title">'+html(t.title||'')+'</div><div class="artist">'+html(artist(t))+'</div></div><button class="mini-play" data-mini-toggle>'+(p.playing?'Ⅱ':'▶')+'</button><div class="a-miniprogress" style="width:'+(p.duration?Math.min(100,100*(p.position||0)/p.duration):0)+'%"></div>'};
function queueContent(p){const q=p.queue||[];return '<h3>Play queue <small>'+q.length+' tracks</small></h3>'+q.map((t,i)=>'<div class="a-queue-row"><button class="a-queue-track" data-queue-play="'+i+'">'+(art(t,'a-thumb')||'♪')+'<span><b>'+html(t.title)+'</b><small>'+html(artist(t))+'</small></span>'+(i===p.index?'♫':'')+'</button><button data-queue-move="'+i+'" data-queue-dir="-1" '+(i===0?'disabled':'')+'>↑</button><button data-queue-move="'+i+'" data-queue-dir="1" '+(i===q.length-1?'disabled':'')+'>↓</button><button data-queue-remove="'+i+'">×</button></div>').join('')}
function creditContent(p){const t=p.track||{},album=t.album||{},rows=[['Track',t.title],['Artist',artist(t)],['Album',album.title],['Label',album.label?.name||album.label],['Release date',album.release_date],['Copyright',album.copyright]];return '<h3>Recording credits</h3>'+rows.filter(x=>x[1]).map(x=>'<div class="a-credit"><span>'+html(x[0])+'</span><b>'+html(x[1])+'</b></div>').join('')+'<p class="disclaimer">Only metadata supplied by Qobuz is shown.</p>'}
function audioContent(p){return '<h3>Audio signal</h3><div class="a-credit"><span>Source</span><b>'+(p.bits?html(p.bits+'-bit / '+p.sampleRate+' kHz'):'Unverified')+'</b></div><div class="a-credit"><span>Android output</span><b>'+html(p.androidMixerHz||'Unknown')+' Hz</b></div><div class="a-credit"><span>Decoder</span><b>Android MediaPlayer</b></div><p class="disclaimer">Source format does not guarantee bit-perfect hardware output.</p>'}
drawOverlay=function(){const e=$('#overlay');if(!app.overlay){e.classList.add('hidden');e.innerHTML='';return}const p=app.player||{},t=p.track||{},src=image(t);e.classList.remove('hidden');e.style.setProperty('--cover-image',src?'url("'+src+'")':'none');
e.innerHTML='<div class="a-player"><div class="a-player-head"><button data-close-overlay>⌄</button><b>Listening</b><button data-player-sheet="upnext">☷</button></div><div class="a-player-art">'+(src?'<img src="'+html(src)+'" alt="Album cover">':'<span>♪</span>')+'</div>'+
'<div class="a-player-meta"><div><h2>'+html(t.title||'No track selected')+'</h2><p>'+html(artist(t))+'</p></div><button data-like-track="'+html(t.id||'')+'">♡</button></div>'+
'<div class="a-format">'+(p.bits?html(p.bits+'-bit / '+p.sampleRate+' kHz'):'Audio format pending')+'</div>'+
'<input id="progress" class="progress" type="range" min="0" max="'+(p.duration||100)+'" value="'+(p.position||0)+'" step="500"><div class="timebar"><span id="elapsed">'+duration((p.position||0)/1000)+'</span><span id="remaining">-'+duration(Math.max(0,(p.duration||0)-(p.position||0))/1000)+'</span></div>'+
'<div class="controls"><button id="full-shuffle" data-shuffle class="ctrl '+(p.shuffle?'active':'')+'">⤨</button><button class="ctrl" data-prev>◀❚</button><button class="main-play" id="full-toggle" data-full-toggle>'+(p.playing?'Ⅱ':'▶')+'</button><button class="ctrl" data-next>❚▶</button><button id="full-repeat" class="ctrl '+(p.repeat?'active':'')+'" data-repeat>↻</button></div>'+
'<div class="a-player-tabs">'+[['upnext','Up next'],['credits','Credits'],['audio','Audio']].map(x=>'<button class="'+(app.playerSheet===x[0]?'active':'')+'" data-player-sheet="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><div class="a-player-sheet">'+(app.playerSheet==='upnext'?queueContent(p):app.playerSheet==='credits'?creditContent(p):audioContent(p))+'</div>'+(p.error?'<div class="playback-error">'+html(p.error)+'</div>':'')+'<span id="playingStatus" hidden></span></div>';
};
const existingPlayerEvent=window.AurelEvent;let oldQueue='';
window.AurelEvent=(kind,data)=>{existingPlayerEvent(kind,data);if(kind==='player'){const value=JSON.stringify([data?.index,(data?.queue||[]).map(t=>t.id)]);if(value!==oldQueue){oldQueue=value;if(app.overlay)drawOverlay()}}};
document.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;
if(b.dataset.discoverTab){ev.stopImmediatePropagation();app.discoverTab=b.dataset.discoverTab;renderHome()}
else if(b.dataset.pickSearch){ev.stopImmediatePropagation();app.searchQuery=b.dataset.pickSearch;renderSearch();search()}
else if(b.hasAttribute('data-clear-searches')){ev.stopImmediatePropagation();localStorage.removeItem('aurel_searches');renderSearch()}
else if(b.dataset.libLayout){ev.stopImmediatePropagation();app.libLayout=b.dataset.libLayout;renderLibrary()}
else if(b.hasAttribute('data-open-magazine')){ev.stopImmediatePropagation();nativeCall('openMagazine').catch(e=>showToast(e.message))}
else if(b.dataset.playerSheet){ev.stopImmediatePropagation();app.playerSheet=b.dataset.playerSheet;drawOverlay()}
else if(b.dataset.queuePlay!==undefined){ev.stopImmediatePropagation();nativeCall('queuePlay',{index:Number(b.dataset.queuePlay)}).catch(e=>showToast(e.message))}
else if(b.dataset.queueMove!==undefined){ev.stopImmediatePropagation();const from=Number(b.dataset.queueMove);nativeCall('queueMove',{from,to:from+Number(b.dataset.queueDir)}).catch(e=>showToast(e.message))}
else if(b.dataset.queueRemove!==undefined){ev.stopImmediatePropagation();nativeCall('queueRemove',{index:Number(b.dataset.queueRemove)}).catch(e=>showToast(e.message))}
else if(b.dataset.playNext!==undefined){ev.stopImmediatePropagation();const items=app.selected?app.selectedTracks:app.nav==='library'?app.libraryItems:app.results,track=(items||[])[Number(b.dataset.playNext)];if(track)nativeCall('queueAdd',{tracks:[track],next:true}).then(()=>showToast('Added to queue')).catch(e=>showToast(e.message))}
},true);
document.addEventListener('change',ev=>{if(ev.target.id==='libSort'){app.libSort=ev.target.value;renderLibrary()}});
