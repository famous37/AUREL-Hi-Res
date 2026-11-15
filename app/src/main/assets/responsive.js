(function installResponsive(){
  'use strict';
  app.downloads={items:[],total:0,queued:0,done:0,failed:0,running:0,planning:false,planMessage:''};
  app.downloadQuality=27;
  app.downloadFilter='all';
  app.downloadAdvancedOpen=false;
  app.downloadEndpoint='';
  app.downloadHasKey=false;
  app.downloadProviderOpen=false;
  app.visibleDownloadTracks=[];
  const mobile=document.querySelector('.bottom-nav');
  if(mobile)mobile.innerHTML=`
    <button data-nav="home"><span aria-hidden="true">${ic('home',24)}</span>Home</button>
    <button data-nav="search"><span aria-hidden="true">${ic('search',24)}</span>Search</button>
    <button data-nav="library"><span aria-hidden="true">${ic('library',24)}</span>Library</button>
    <button data-nav="downloads"><span aria-hidden="true">${ic('download',24)}</span>Downloads</button>
    <button data-nav="settings"><span aria-hidden="true">${ic('settings',24)}</span>Settings</button>`;
  const side=document.querySelector('.sidebar .side-foot');
  if(side&&typeof side.insertAdjacentHTML==='function')side.insertAdjacentHTML('beforebegin',
    '<button class="nav" data-nav="downloads"><b>'+ic('download',24)+'</b> Downloads</button>');

  // One vector icon language for navigation in both desktop and Android layouts.
  document.querySelectorAll('.sidebar .nav').forEach(b=>{
    const glyph=b.querySelector('b');
    if(glyph){
      const name=b.dataset.nav==='magazine'?'info':b.dataset.nav==='downloads'?'download':b.dataset.nav;
      if(['home','search','library','settings','info','download'].includes(name))glyph.innerHTML=ic(name,24);
    }
  });
  const priorListTracks=listTracks;
  listTracks=function(items){
    app.visibleDownloadTracks=items||[];
    const original=priorListTracks(items);
    return original.replace(/(<button class="icon-btn" data-play-index="(\d+)" title="Play">)/g,
      '<button class="icon-btn download-track-button" data-download-track="$2" title="Download if purchased" aria-label="Download purchased track">'+ic('download',22)+'</button>$1')
      .replaceAll('>♡</button>','>'+ic('heart',22)+'</button>')
      .replaceAll('>＋</button>','>'+ic('plus',22)+'</button>')
      .replaceAll('>▶</button>','>'+ic('play',24)+'</button>');
  };
  const priorRenderAlbum=renderAlbum;
  renderAlbum=function(){
    priorRenderAlbum();
    if(app.selectedKind!=='album'||!app.selected?.id)return;
    const screen=$('#screen');
    screen.innerHTML=screen.innerHTML.replace(
      /(<button class="pill secondary" data-like-album=[^>]*>♡ Save<\/button>)/,
      '$1<button class="pill secondary aurel-download-album" data-download-album title="Queue authorized Qobuz album">'+ic('download',20)+' Qobuz files</button><button class="pill secondary" data-saf-import="folder" title="Import album folder from Murglar">'+ic('library',20)+' Import album</button>');
  };
  const priorRenderArtist=renderArtist;
  renderArtist=function(){
    priorRenderArtist();
    if(!app.selected?.id)return;
    const screen=$('#screen');
    screen.innerHTML=screen.innerHTML.replace(
      '<div class="sectionhead"><h2>Discography',
      '<div class="discography-actions"><button class="pill secondary" data-saf-import="folder">'+ic('library',19)+' Import collection</button><button class="pill secondary" data-download-discography="all">'+ic('download',19)+' Qobuz discography</button><button class="chip" data-download-discography="albums">Albums only</button><button class="chip" data-download-discography="singles">Singles only</button></div><div class="sectionhead"><h2>Discography');
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
  function friendlyDownloadError(value){
    const s=String(value||'');
    if(/Invalid Request Signature|refused the purchase-download signature/i.test(s))
      return 'The Qobuz API did not authorize a downloadable file. You can import music through Murglar’s Android document library, or use a separately authorized download provider.';
    if(s.length>380)return s.slice(0,377)+'…';
    return s;
  }
  function errorSummary(value){
    const s=String(value||'');
    if(/Invalid Request Signature|refused the purchase-download signature/i.test(s))return 'Qobuz file unavailable';
    if(/expired|permission|denied/i.test(s))return 'Re-select the source file';
    return s.length>95?s.slice(0,92)+'…':s;
  }
  function badgeText(item){
    if(item.status==='done')return 'Saved';
    if(item.status==='running')return item.percent>0?item.percent+'%':'Downloading';
    if(item.status==='queued')return 'Queued';
    if(item.status==='cancelled')return 'Cancelled';
    return 'Failed';
  }
  function downloadStructureKey(dl){
    const items=Array.isArray(dl?.items)?dl.items:[];
    return [dl?.total,dl?.queued,dl?.done,dl?.failed,dl?.running,
      String(!!dl?.planning),dl?.planMessage||'',
      ...items.map(i=>[i.id,i.status,i.error||''].join(':'))].join('|');
  }
  function renderDownloads(){
    const sc=$('#screen'),previous=sc.scrollTop;
    const dl=app.downloads||{};
    const items=Array.isArray(dl.items)?dl.items:[];
    const shown=items.filter(i=>app.downloadFilter==='all'||
      app.downloadFilter==='active'&&(i.status==='running'||i.status==='queued')||
      app.downloadFilter==='saved'&&i.status==='done'||
      app.downloadFilter==='failed'&&(i.status==='failed'||i.status==='cancelled'));
    sc.innerHTML=`<div class="page-heading"><h1>Downloads</h1></div>
      <p class="subline downloads-intro">Your offline music, organized in one place.</p>
      <section class="aurel-import-hero" aria-label="Import music from Murglar">
        <div class="aurel-import-heading">
          <div class="aurel-import-mark">${ic('library',27)}</div>
          <div><div class="aurel-import-kicker">MURGLAR &amp; DEVICE FILES</div>
            <h2>Import your music</h2></div>
        </div>
        <p>Choose audio tracks or a complete album/artist folder from Murglar in Android Files. AUREL copies the selected files into your offline library.</p>
        <div class="aurel-import-buttons">
          <button data-saf-import="files" class="aurel-import-primary">${ic('download',20)} Select tracks</button>
          <button data-saf-import="folder" class="aurel-import-secondary">${ic('library',20)} Select folder</button>
        </div>
      </section>
      <div class="download-summary">
        <div><strong>${Number(dl.total)||0}</strong><span>Tracks</span></div>
        <div><strong>${Number(dl.done)||0}</strong><span>Saved</span></div>
        <div><strong>${(Number(dl.queued)||0)+(Number(dl.running)||0)}</strong><span>Pending</span></div>
        <div><strong>${Number(dl.failed)||0}</strong><span>Failed</span></div>
      </div>
      ${dl.planning?`<div class="download-plan" role="status"><span class="loading-dot"></span>${html(dl.planMessage||'Preparing downloads…')}</div>`:
        dl.planMessage?`<div class="download-plan">${html(dl.planMessage)}</div>`:''}
      <details class="aurel-download-advanced" id="aurelAdvanced" ${app.downloadAdvancedOpen?'open':''}>
        <summary>${ic('settings',20)} Download quality &amp; advanced settings</summary>
        <div class="aurel-download-advanced-inner">
      <div class="download-settings-row">
        <label for="downloadQuality">Purchased download quality</label>
        <select id="downloadQuality" aria-label="Maximum requested download quality">
          ${[[27,'Best available · up to 24 / 192'],[7,'Hi-Res · up to 24 / 96'],[6,'CD · 16 / 44.1'],[5,'MP3 · 320']].map(([q,label])=>`<option value="${q}" ${Number(app.downloadQuality)===q?'selected':''}>${label}</option>`).join('')}
        </select>
      </div>
      <details class="aurel-provider-settings" id="downloadProviderSettings" ${app.downloadProviderOpen?'open':''}>
        <summary>Authorized download provider ${app.downloadEndpoint?'· Connected':'· Not configured'}</summary>
        <div class="aurel-provider-body">
          <p>Qobuz streaming credentials do not necessarily authorize permanent downloads. Mornye supports independent providers; AUREL can connect to your own licensed HTTPS provider using the /download-url/{id}?quality=… interface. An endpoint is not supplied with the app.</p>
          <form id="downloadProviderForm">
            <label>HTTPS provider URL
              <input id="providerEndpoint" type="url" inputmode="url" autocomplete="off" placeholder="https://your-authorized-provider.example" value="${html(app.downloadEndpoint||'')}">
            </label>
            <label>Provider API key (optional)
              <input id="providerApiKey" type="password" autocomplete="off" placeholder="${app.downloadHasKey?'Key saved — leave blank to retain':'Optional X-API-Key'}">
            </label>
            <div class="aurel-provider-buttons">
              <label class="aurel-key-reset"><input id="providerClearKey" type="checkbox"> Clear saved key</label>
              <button type="submit" class="pill">Save provider</button>
            </div>
          </form>
          <p class="hint">Only configure services you own or are authorized to use. No Qobuz account token is sent to this endpoint.</p>
        </div>
      </details>
        </div>
      </details>
      <div class="sectionhead download-history-heading"><h2>Download queue</h2><button class="plain-action" data-download-refresh aria-label="Refresh downloads" title="Refresh">${ic('refresh',23)}</button></div>
      <div class="aurel-download-filter" role="group" aria-label="Filter downloads">
        ${[['all','All'],['active','Active'],['saved','Saved'],['failed','Issues']].map(([key,label])=>`<button data-download-filter="${key}" class="${app.downloadFilter===key?'selected':''}" aria-pressed="${app.downloadFilter===key}">${label}</button>`).join('')}
      </div>
      <div id="downloadsList" class="downloads-list">
        ${shown.length?shown.map(item=>`<article class="download-entry" data-track-id="${html(item.id)}" data-status="${html(item.status)}">
          <div class="download-entry-main"><span class="download-entry-icon" aria-hidden="true">${ic(item.status==='done'?'check':item.status==='failed'?'info':'audio',22)}</span>
            <div class="download-entry-meta"><strong>${html(item.title||'Track')}</strong>
              <span>${html(item.artist||'Artist')}${item.album?' · '+html(item.album):''}</span>
              <small class="aurel-download-origin">${item.sourceKind==='saf'?'Imported file':'Qobuz file'}</small>
            </div><span class="download-entry-status">${html(badgeText(item))}</span>
          </div>
          ${item.status==='running'?`<div class="download-progress" role="progressbar" aria-label="Download ${html(item.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.max(0,Number(item.percent)||0)}"><span style="width:${Math.max(0,Number(item.percent)||0)}%"></span></div>
          <small class="download-transfer">${humanBytes(item.bytes)}${Number(item.total)>0?' / '+humanBytes(item.total):''}</small>`:''}
          ${item.error?`<details class="aurel-download-error"><summary>${html(errorSummary(item.error))}</summary><p>${html(friendlyDownloadError(item.error))}</p></details>`:''}
          <div class="download-entry-actions">
            ${item.status==='running'||item.status==='queued'?`<button data-download-cancel="${html(item.id)}">Cancel</button>`:''}
            ${item.status==='failed'&&/Invalid Request Signature|refused the purchase-download signature/i.test(item.error||'')&&!app.downloadEndpoint?
              `<button data-saf-import="files">${ic('library',18)} Import from Murglar</button>`:
              item.status==='failed'||item.status==='cancelled'?
              `<button data-download-retry="${html(item.id)}">${ic('refresh',18)} Retry</button>`:''}
            ${item.status==='done'?`<button data-download-play="${html(item.id)}">${ic('play',17)} Play offline</button><button data-download-open="${html(item.id)}">Open audio</button>`:''}
          </div>
        </article>`).join(''):
          '<div class="aurel-download-empty">'+ic('download',27)+'<strong>No items in this view</strong><span>Choose tracks, import a folder, or change the filter.</span></div>'}
      </div>
      ${items.some(x=>x.status==='done'||x.status==='failed'||x.status==='cancelled')?'<button class="aurel-clear-downloads" data-download-clear>Clear finished history</button>':''}
      <p class="download-disclaimer">Saved on Android 10+: <strong>Music/AUREL</strong>. Imports use Android’s file permissions; Qobuz downloads require separate file authorization.</p>`;
    sc.scrollTop=previous;
    app.downloadStructureKey=downloadStructureKey(dl);
  }
  let scheduledRender=false;
  function updateDownloads(state){
    app.downloads=state||app.downloads;
    if(app.nav!=='downloads'||app.selected)return;
    const dl=app.downloads;
    if(downloadStructureKey(dl)===app.downloadStructureKey){
      for(const item of (dl.items||[])){
        if(item.status!=='running')continue;
        const node=document.querySelector('#downloadsList .download-entry[data-track-id="'+item.id+'"]');
        if(!node)continue;
        const bar=node.querySelector('.download-progress');
        if(bar){
          const percent=Math.max(0,Math.min(100,Number(item.percent)||0));
          bar.setAttribute('aria-valuenow',String(percent));
          const fill=bar.querySelector('span');
          if(fill)fill.style.width=percent+'%';
        }
        const status=node.querySelector('.download-entry-status');
        if(status)status.textContent=badgeText(item);
        const amount=node.querySelector('.download-transfer');
        if(amount)amount.textContent=humanBytes(item.bytes)+(Number(item.total)>0?' / '+humanBytes(item.total):'');
      }
      return;
    }
    if(scheduledRender)return;
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
    if(kind==='downloadNotice'){showToast(data?.message||'Import updated',data?.error?6500:3600);return}
    priorEvent(kind,data);
  };
  updateMini=function(){
    const p=app.player,m=$('#mini');
    if(!p?.track?.id){m.classList.add('hidden');return}
    const t=p.track,played=p.duration?Math.max(0,Math.min(100,Math.round((p.position||0)/p.duration*100))):0;
    m.classList.remove('hidden');
    const metaKey=[String(t.id),String(t.title||''),artistLabel(t),image(t),String(!!p.playing)].join('|');
    if(m.dataset.metaKey===metaKey){
      const bar=m.querySelector('.mini-progress');
      if(bar)bar.style.setProperty('--played',played+'%');
      return;
    }
    m.dataset.metaKey=metaKey;
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
    if(b.hasAttribute('data-download-current')){
      const t=app.player?.track;if(!t?.id)return;
      handle('downloadTrack',{track:{
        id:String(t.id),title:t.title||'Track',artist:artistLabel(t),
        album:t.album?.title||'',albumId:t.album?.id?String(t.album.id):''
      }},'Added to download queue');return;
    }
    if(b.hasAttribute('data-saf-import')){
      ev.preventDefault();ev.stopImmediatePropagation();
      nativeCall('openSafImport',{mode:b.dataset.safImport||'files'})
        .catch(e=>showToast(e.message||'Android file picker unavailable',6000));
      return;
    }
    if(b.hasAttribute('data-download-filter')){
      ev.preventDefault();ev.stopImmediatePropagation();
      app.downloadFilter=b.dataset.downloadFilter;renderDownloads();return;
    }
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
    if(b.hasAttribute('data-download-configure')){
      ev.preventDefault();ev.stopImmediatePropagation();
      app.downloadProviderOpen=true;app.downloadAdvancedOpen=true;renderDownloads();
      const details=document.querySelector('#downloadProviderSettings');
      if(details&&typeof details.scrollIntoView==='function')details.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    if(b.hasAttribute('data-download-retry')){handle('downloadRetry',{id:b.dataset.downloadRetry},'Queued for retry');return}
    if(b.hasAttribute('data-download-clear')){handle('downloadClear',{},'History cleared — saved files kept');return}
    if(b.hasAttribute('data-download-play')){handle('playDownloaded',{id:b.dataset.downloadPlay});return}
    if(b.hasAttribute('data-download-open')){handle('openDownloaded',{id:b.dataset.downloadOpen});return}
    if(b.hasAttribute('data-download-refresh')){ev.preventDefault();ev.stopImmediatePropagation();refreshDownloads();return}
  },true);
  document.addEventListener('submit',ev=>{
    if(ev.target.id!=='downloadProviderForm')return;
    ev.preventDefault();ev.stopImmediatePropagation();
    const endpoint=document.querySelector('#providerEndpoint')?.value?.trim()||'';
    const apiKey=document.querySelector('#providerApiKey')?.value||'';
    const clearKey=!!document.querySelector('#providerClearKey')?.checked;
    nativeCall('saveDownloadProvider',{endpoint,apiKey,clearKey}).then(d=>{
      app.downloadEndpoint=d.endpoint||'';
      app.downloadHasKey=!!d.hasApiKey;
      showToast(app.downloadEndpoint?'Authorized provider saved':'Custom provider removed');
      renderDownloads();
    }).catch(e=>showToast(e.message||'Unable to save provider',6500));
  },true);
  document.addEventListener('toggle',ev=>{
    if(ev.target?.id==='aurelAdvanced')app.downloadAdvancedOpen=!!ev.target.open;
    if(ev.target?.id==='downloadProviderSettings')app.downloadProviderOpen=!!ev.target.open;
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
    nativeCall('downloadSettings').then(d=>{
      app.downloadQuality=d.quality||27;
      app.downloadEndpoint=d.endpoint||'';
      app.downloadHasKey=!!d.hasApiKey;
      if(app.nav==='downloads')renderDownloads();
    }).catch(()=>{});
  }
})();
