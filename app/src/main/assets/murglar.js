(function installMurglarPlayer(){
  'use strict';
  const navigationIcon=(key)=>{
    const paths={
      library:'<path d="M4 5h14v14H4zM8 9h6M8 13h6"/><path d="M20 8v13H7"/>',
      search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
      playing:'<path d="M4 7h16M4 12h12M4 17h8"/><path d="m17 16 4 2.5-4 2.5z"/>',
      settings:'<path d="M12 2.5 14 4l2.4-.3 1 2.3 2.3 1 .1 2.5 1.7 1.8-1.7 1.9-.1 2.5-2.3.9-1 2.3-2.4-.3-2 1.5-2-1.5-2.4.3-1-2.3-2.3-.9-.1-2.5-1.7-1.9 1.7-1.8.1-2.5 2.3-1 1-2.3 2.4.3z"/><circle cx="12" cy="12" r="3.1"/>'
    };
    return `<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${paths[key]||''}</svg>`;
  };
  const stateCaption=p=>p?.error?'UNAVAILABLE':p?.buffering?'BUFFERING':p?.playing?'PLAYING':'PAUSED';
  const sourceCaption=p=>p?.sourceVerified?'Qobuz metadata':p?.decoderSampleRateHz?'Android parsed track':'Unverified format';
  drawOverlay=function(){
    const overlay=$('#overlay');
    if(!app.overlay){overlay.classList.add('hidden');overlay.innerHTML='';return}
    const p=app.player||{},t=p.track||{},src=image(t),active=app.playerSheet||'';
    const total=Math.max(0,Number(p.duration)||0),position=Math.min(total,Math.max(0,Number(p.position)||0));
    const played=total?Math.min(100,Math.round(position/total*100)):0;
    const artwork=src?`<img src="${html(src)}" class="murglar-cover" alt="Cover art for ${html(t.album?.title||t.title||'the current track')}" loading="eager">`:'<div class="murglar-cover murglar-art-placeholder" aria-label="No cover art available">♫</div>';
    const source=actualSource(p);
    const navItems=[['library','Library'],['search','Search'],['playing','Now playing'],['settings','Settings']];
    overlay.classList.remove('hidden');
    overlay.style.setProperty('--cover-image','none');
    overlay.innerHTML=`<div class="aurel-listening-screen murglar-view">
      <div class="aurel-art-backdrop" aria-hidden="true"></div>
      <header class="murglar-header aurel-listening-nav">
        <button data-close-overlay class="murglar-header-button" aria-label="Minimize player">${ic('down',26)}</button>
        <strong>Now Playing</strong>
        <button data-player-sheet="audio" class="murglar-header-button" aria-label="Audio information">${ic('more',27)}</button>
      </header>
      <div class="murglar-player-content">
        <div class="murglar-art-wrap">${artwork}</div>
        <section class="murglar-track-data aurel-track-title-row">
          <h1>${html(t.title||'Choose a track')}</h1>
          ${artistButton(t)}
          ${t.album?.title?`<button class="murglar-album-link" data-open-playing-album aria-label="Open ${html(t.album.title)} album">${html(t.album.title)} ${ic('chevron',16)}</button>`:''}
        </section>
        <div class="murglar-quick-actions" aria-label="Track actions">
          <button data-player-sheet="upnext" class="${active==='upnext'?'active':''}" aria-label="Play queue" title="Queue">${ic('queue',25)}<span>Queue</span></button>
          <button data-player-sheet="credits" class="${active==='credits'?'active':''}" aria-label="Track details" title="Credits">${ic('info',25)}<span>Info</span></button>
          <button data-player-sheet="audio" class="${active==='audio'?'active':''}" aria-label="Source quality details" title="Audio">${ic('audio',25)}<span>Audio</span></button>
          <button data-download-current aria-label="Download purchased track" title="Download options" data-player-sheet="downloads">${ic('download',25)}<span>Download</span></button>
          <button data-like-track="${html(t.id||'')}" ${t.id?'':'disabled'} aria-label="Add to favourites" title="Favourite">${ic('heart',26)}<span>Favourite</span></button>
        </div>
        <section class="murglar-progress-row aurel-timeline" aria-label="Playback position">
          <span id="elapsed">${duration(position/1000)}</span>
          <input id="progress" class="progress" type="range" min="0" max="${total||100}" step="500" value="${position}" style="--played:${played}%" aria-label="Seek within track">
          <span id="remaining">${duration(total/1000)}</span>
        </section>
        <section class="murglar-transport aurel-main-actions" aria-label="Playback controls">
          <button id="full-shuffle" data-shuffle class="murglar-control peripheral ${p.shuffle?'active':''}" aria-label="Shuffle">${ic('shuffle',25)}</button>
          <button data-prev class="murglar-control aurel-transport side" aria-label="Previous track">${ic('prev',32)}</button>
          <button id="full-toggle" data-full-toggle class="murglar-control aurel-transport middle" aria-label="${p.playing?'Pause':'Play'}">${ic(p.playing?'pause':'play',41)}</button>
          <button data-next class="murglar-control aurel-transport side" aria-label="Next track">${ic('next',32)}</button>
          <button id="full-repeat" data-repeat class="murglar-control peripheral ${p.repeat?'active':''}" aria-label="Repeat">${ic('repeat',25)}${p.repeat===2?'<sup>1</sup>':''}</button>
        </section>
        <button class="murglar-source-line aurel-source-pill" data-player-sheet="audio" aria-label="See audio source details">
          ${ic('audio',18)}<span>${html(source)}</span><small>· ${html(sourceCaption(p))}</small>
        </button>
        ${p.error?`<div class="playback-error" role="status">${html(p.error)}</div>`:''}
        ${active?`<div class="aurel-detail-sheet murglar-detail-sheet">${active==='downloads'?
          `<div class="aurel-player-download-sheet">
              <h3>Save music</h3>
              <p>Select music from Murglar's Android file library, or add a separately authorized Qobuz file.</p>
              <div class="aurel-download-choice">
                <button data-saf-import="files">${ic('library',20)} Import track</button>
                <button data-saf-import="folder">${ic('download',20)} Import album folder</button>
                <button data-download-current>${ic('download',20)} Qobuz purchased file</button>
              </div>
            </div>`:
          active==='upnext'?queuePanel(p):active==='credits'?creditsPanel(p):audioPanel(p)}</div>`:''}
        <span class="murglar-state" id="playingStatus" aria-live="polite">${stateCaption(p)}</span>
      </div>
      <nav class="murglar-footer" aria-label="Player navigation">
        ${navItems.map(([key,label])=>`<button data-player-nav="${key}" class="${key==='playing'?'active':''}" aria-label="${label}" ${key==='playing'?'aria-current="page"':''}>${navigationIcon(key)}<span>${label}</span></button>`).join('')}
      </nav>
    </div>`;
  };
  updateOverlayState=function(){
    const p=app.player;
    if(!p||!app.overlay)return;
    const progress=$('#progress');
    if(progress&&!app.dragging){
      progress.max=p.duration||100;
      progress.value=p.position||0;
      const total=Number(p.duration)||0;
      progress.style.setProperty('--played',total?Math.min(100,Math.round((Number(p.position)||0)/total*100))+'%':'0%');
    }
    if($('#elapsed'))$('#elapsed').textContent=duration((p.position||0)/1000);
    if($('#remaining'))$('#remaining').textContent=duration((p.duration||0)/1000);
    if($('#full-toggle')){
      $('#full-toggle').innerHTML=ic(p.playing?'pause':'play',41);
      $('#full-toggle').setAttribute('aria-label',p.playing?'Pause':'Play');
    }
    if($('#full-shuffle'))$('#full-shuffle').classList.toggle('active',!!p.shuffle);
    if($('#full-repeat')){
      $('#full-repeat').classList.toggle('active',!!p.repeat);
      $('#full-repeat').innerHTML=ic('repeat',25)+(p.repeat===2?'<sup>1</sup>':'');
    }
    if($('#playingStatus'))$('#playingStatus').textContent=stateCaption(p);
  };
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-player-nav]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const destination=button.dataset.playerNav;
    if(destination==='playing'){
      app.playerSheet=app.playerSheet==='upnext'?'':'upnext';
      drawOverlay();
    }else{
      app.playerSheet='';
      app.overlay=false;
      drawOverlay();
      navigate(destination);
    }
  },true);
})();
