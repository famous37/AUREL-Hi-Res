(function installResponsive(){
  'use strict';
  app.downloads={items:[],total:0,queued:0,done:0,failed:0,running:0,planning:false,planMessage:''};
  app.downloadQuality=27;
  app.visibleDownloadTracks=[];
  const mobile=document.querySelector('.bottom-nav');
  if(mobile)mobile.innerHTML=`
    <button data-nav="home"><span aria-hidden="true">⌂</span>Home</button>
    <button data-nav="search"><span aria-hidden="true">⌕</span>Search</button>
    <button data-nav="library"><span aria-hidden="true">▦</span>Library</button>
    <button data-nav="downloads"><span aria-hidden="true">⇩</span>Downloads</button>
    <button data-nav="settings"><span aria-hidden="true">⚙</span>Settings</button>`;
  const side=document.querySelector('.sidebar .side-foot');
  if(side&&typeof side.insertAdjacentHTML==='function')side.insertAdjacentHTML('beforebegin',
    '<button class="nav" data-nav="downloads"><b>⇩</b> Downloads</button>');

  const priorListTracks=listTracks;
  listTracks=function(items){
    app.visibleDownloadTracks=items||[];
    const original=priorListTracks(items);
    return original.replace(/(<button class="icon-btn" data-play-index="(\d+)" title="Play">)/g,
      '<button class="icon-btn download-track-button" data-download-track="$2" title="Download if purchased" aria-label="Download purchased track">⇩</button>$1');
  };
  const priorRenderAlbum=renderAlbum;
  renderAlbum=function(){
    priorRenderAlbum();
    if(app.selectedKind!=='album'||!app.selected?.id)return;
    const screen=$('#screen');
    screen.innerHTML=screen.innerHTML.replace(
      /(<button class="pill secondary" data-like-album=[^>]*>♡ Save<\/button>)/,
      '$1<button class="pill secondary aurel-download-album" data-download-album title="Download purchased album">⇩ Download album</button>');
  };
  const priorRenderArtist=renderArtist;
  renderArtist=function(){
    priorRenderArtist();
    if(!app.selected?.id)return;
    const screen=$('#screen');
    screen.innerHTML=screen.innerHTML.replace(
      '<div class="sectionhead"><h2>Discography',
      '<div class="discography-actions"><button class="pill secondary" data-download-discography="all">⇩ Download discography</button><button class="chip" data-download-discography="albums">Albums only</button><button class="chip" data-download-discography="singles">Singles only</button></div><div class="sectionhead"><h2>Discography');
  };
  const priorRender=render;
  render=function(){
    if(app.nav==='downloads'&&!app.selected){
      $$('.nav,.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav==='downloads'));
      renderDownloads();
    }else priorRender();
  };
  const humanBytes=n=>{
    n=Number(n)||0;
    return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(0)+' KB':n+' B';
  };
  function badgeText(item){
    if(item.status==='done')return 'Saved';
    if(item.status==='running')return item.percent>0?item.percent+'%':'Downloading';
    if(item.status==='queued')return 'Queued';
    if(item.status==='cancelled')return 'Cancelled';
    return 'Failed';
  }
  function renderDownloads(){
    const sc=$('#screen'),previous=sc.scrollTop;
    const dl=app.downloads||{};
    const items=Array.isArray(dl.items)?dl.items:[];
    sc.innerHTML=`<div class="page-heading"><h1>Downloads</h1></div>
      <p class="subline">Music files you own or are separately authorized to download. Streaming-only access does not permit permanent exports.</p>
      <div class="download-summary">
        <div><strong>${Number(dl.total)||0}</strong><span>Tracks</span></div>
        <div><strong>${Number(dl.done)||0}</strong><span>Saved</span></div>
        <div><strong>${(Number(dl.queued)||0)+(Number(dl.running)||0)}</strong><span>Pending</span></div>
        <div><strong>${Number(dl.failed)||0}</strong><span>Failed</span></div>
      </div>
      ${dl.planning?`<div class="download-plan" role="status"><span class="loading-dot"></span>${html(dl.planMessage||'Preparing downloads…')}</div>`:
        dl.planMessage?`<div class="download-plan">${html(dl.planMessage)}</div>`:''}
      <div class="download-settings-row">
        <label for="downloadQuality">Purchased download quality</label>
        <select id="downloadQuality" aria-label="Maximum requested download quality">
          ${[[27,'Best available · up to 24 / 192'],[7,'Hi-Res · up to 24 / 96'],[6,'CD · 16 / 44.1'],[5,'MP3 · 320']].map(([q,label])=>`<option value="${q}" ${Number(app.downloadQuality)===q?'selected':''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="sectionhead download-history-heading"><h2>Download queue</h2><button class="plain-action" data-download-refresh title="Refresh">↻</button></div>
      <div id="downloadsList" class="downloads-list">
        ${items.length?items.map(item=>`<article class="download-entry" data-status="${html(item.status)}">
          <div class="download-entry-main"><span class="download-entry-icon" aria-hidden="true">${item.status==='done'?'✓':item.status==='failed'?'!':'♫'}</span>
            <div class="download-entry-meta"><strong>${html(item.title||'Track')}</strong>
              <span>${html(item.artist||'Artist')}${item.album?' · '+html(item.album):''}</span>
            </div><span class="download-entry-status">${html(badgeText(item))}</span>
          </div>
          ${item.status==='running'?`<div class="download-progress" role="progressbar" aria-label="Download ${html(item.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.max(0,Number(item.percent)||0)}"><span style="width:${Math.max(0,Number(item.percent)||0)}%"></span></div>
          <small class="download-transfer">${humanBytes(item.bytes)}${Number(item.total)>0?' / '+humanBytes(item.total):''}</small>`:''}
          ${item.error?`<p class="download-error">${html(item.error)}</p>`:''}
          <div class="download-entry-actions">
            ${item.status==='running'||item.status==='queued'?`<button data-download-cancel="${html(item.id)}">Cancel</button>`:''}
            ${item.status==='failed'||item.status==='cancelled'?`<button data-download-retry="${html(item.id)}">Retry</button>`:''}
            ${item.status==='done'?`<button data-download-open="${html(item.id)}">Open audio</button>`:''}
          </div>
        </article>`).join(''):
          '<div class="empty"><strong>No downloads yet</strong>Open an album, artist or track to add a purchased file to the queue.</div>'}
      </div>
      ${items.some(x=>x.status==='done'||x.status==='failed'||x.status==='cancelled')?'<button class="aurel-clear-downloads" data-download-clear>Clear finished history</button>':''}
      <p class="download-disclaimer">Downloads require a Qobuz integration with separate purchased-file authorization. Unavailable endpoints or streaming-only titles will report a clear error. Android 10+ files go to Music/AUREL; Android 8–9 use the app music folder.</p>`;
    sc.scrollTop=previous;
  }
  let scheduledRender=false;
  function updateDownloads(state){
    app.downloads=state||app.downloads;
    if(app.nav!=='downloads'||app.selected||scheduledRender)return;
    scheduledRender=true;
    requestAnimationFrame(()=>{scheduledRender=false;if(app.nav==='downloads'&&!app.selected)renderDownloads();});
  }
  function refreshDownloads(){
    nativeCall('downloadState').then(updateDownloads).catch(()=>{});
  }
  const priorEvent=window.AurelEvent;
  window.AurelEvent=function(kind,data){
    if(kind==='downloads'){updateDownloads(data);return}
    if(kind==='downloadError'){showToast(data?.message||'Unable to open audio');return}
    priorEvent(kind,data);
  };
  updateMini=function(){
    const p=app.player,m=$('#mini');
    if(!p?.track?.id){m.classList.add('hidden');return}
    const t=p.track,played=p.duration?Math.max(0,Math.min(100,Math.round((p.position||0)/p.duration*100))):0;
    m.classList.remove('hidden');
    m.innerHTML=`<span class="mini-drag" aria-hidden="true"></span>
      ${art(t,'minicover')||'<span class="minicover placeholder">♫</span>'}
      <button class="mini-track-open" data-open-mini-player aria-label="Open Now Playing">
        <strong>${html(t.title||'Untitled')}</strong><small>${html(artistLabel(t))}</small>
      </button>
      <div class="mini-buttons">
        <button data-mini-prev aria-label="Previous track">${ic('prev',23)}</button>
        <button data-mini-toggle aria-label="${p.playing?'Pause':'Play'}" class="mini-play">${ic(p.playing?'pause':'play',27)}</button>
        <button data-mini-next aria-label="Next track">${ic('next',23)}</button>
      </div>
      <div class="mini-progress" style="--played:${played}%"></div>`;
  };
  const openPlayer=()=>{app.overlay=true;drawOverlay();};
  const oldOverlay=drawOverlay;
  drawOverlay=function(){
    oldOverlay();
    const overlay=$('#overlay');
    if(app.overlay)overlay.classList.add('aurel-overlay-ready');
    else overlay.classList.remove('aurel-overlay-ready');
  };
  let touchStart=null;
  const mini=$('#mini');
  mini.addEventListener('touchstart',e=>{
    if(e.touches?.length!==1)return;
    touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  mini.addEventListener('touchend',e=>{
    if(!touchStart||!e.changedTouches?.length)return;
    const dx=e.changedTouches[0].clientX-touchStart.x;
    const dy=e.changedTouches[0].clientY-touchStart.y;
    touchStart=null;
    if(dy< -35&&Math.abs(dy)>Math.abs(dx))openPlayer();
  },{passive:true});
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
    const handle=(action,payload,success)=>{
      ev.preventDefault();ev.stopImmediatePropagation();
      nativeCall(action,payload).then(()=>{
        if(success)showToast(success);
        if(app.nav==='downloads')refreshDownloads();
      }).catch(e=>showToast(e.message||'Action failed',6000));
    };
    if(b.hasAttribute('data-open-mini-player')){ev.preventDefault();ev.stopImmediatePropagation();openPlayer();return}
    if(b.hasAttribute('data-mini-prev')){handle('previous',{});return}
    if(b.hasAttribute('data-download-track')){
      const i=Number(b.dataset.downloadTrack);
      const t=app.visibleDownloadTracks?.[i];if(!t)return;
      handle('downloadTrack',{track:{
        id:String(t.id||''),title:t.title||'Track',artist:artistLabel(t),
        album:t.album?.title||'',albumId:t.album?.id?String(t.album.id):''
      }},'Added to download queue');return;
    }
    if(b.hasAttribute('data-download-album')){
      if(!app.selected?.id)return;
      handle('downloadAlbum',{id:String(app.selected.id)},'Preparing album downloads');return;
    }
    if(b.hasAttribute('data-download-discography')){
      if(!app.selected?.id)return;
      handle('downloadDiscography',{id:String(app.selected.id),mode:b.dataset.downloadDiscography||'all'},'Preparing discography downloads');return;
    }
    if(b.hasAttribute('data-download-cancel')){handle('downloadCancel',{id:b.dataset.downloadCancel});return}
    if(b.hasAttribute('data-download-retry')){handle('downloadRetry',{id:b.dataset.downloadRetry},'Queued for retry');return}
    if(b.hasAttribute('data-download-clear')){handle('downloadClear',{},'History cleared — saved files kept');return}
    if(b.hasAttribute('data-download-open')){handle('openDownloaded',{id:b.dataset.downloadOpen});return}
    if(b.hasAttribute('data-download-refresh')){ev.preventDefault();ev.stopImmediatePropagation();refreshDownloads();return}
  },true);
  document.addEventListener('change',ev=>{
    if(ev.target.id!=='downloadQuality')return;
    ev.stopImmediatePropagation();
    const q=Number(ev.target.value);
    nativeCall('downloadQuality',{quality:q}).then(()=>{app.downloadQuality=q;showToast('Download quality saved')})
      .catch(e=>showToast(e.message));
  },true);
  if(window.AurelNative){
    refreshDownloads();
    nativeCall('downloadSettings').then(d=>{app.downloadQuality=d.quality||27;if(app.nav==='downloads')renderDownloads()}).catch(()=>{});
  }
})();
