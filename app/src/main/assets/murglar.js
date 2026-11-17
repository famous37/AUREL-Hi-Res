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
  const repeatCaption=p=>Number(p?.repeat)===2?'Repeat one':Number(p?.repeat)===1?'Repeat all':'Repeat off';
  drawOverlay=function(){
    const overlay=$('#overlay');
    if(!app.overlay){app.dragging=false;overlay.classList.add('hidden');overlay.innerHTML='';overlay.dataset.openSheet='';return}
    const priorScroll=overlay.querySelector('.murglar-player-content')?.scrollTop||0;
    const priorDetailScroll=overlay.querySelector('.aurel-detail-scroll')?.scrollTop||0;
    const priorSheet=overlay.dataset.openSheet||'';
    const priorTrack=overlay.dataset.openTrack||'';
    const p=app.player||{},t=p.track||{},src=image(t),active=app.playerSheet||'';
    const total=Math.max(0,Number(p.duration)||0),position=Math.min(total,Math.max(0,Number(p.position)||0));
    const played=total?Math.min(100,Math.round(position/total*100)):0;
    const artwork=src?`<img src="${html(src)}" class="murglar-cover" alt="Cover art for ${html(t.album?.title||t.title||'the current track')}" loading="eager">`:'<div class="murglar-cover murglar-art-placeholder" aria-label="No cover art available">♫</div>';
    const source=actualSource(p);
    // Persistent app bottom navigation remains mounted outside this overlay.
    overlay.classList.remove('hidden');
    overlay.style.setProperty('--cover-image','none');
    overlay.innerHTML=`<div class="aurel-listening-screen murglar-view ${active?'murglar-sheet-open':''}">
      <div class="aurel-art-backdrop" aria-hidden="true"></div>
      <header class="murglar-header aurel-listening-nav">
        <button data-close-overlay class="murglar-header-button" aria-label="Minimize player">${ic('down',26)}</button>
        <strong class="murglar-now-heading">${src?`<img class="murglar-heading-cover" src="${html(src)}" alt="Album cover" loading="eager">`:`<span class="murglar-heading-cover placeholder">♪</span>`}<span>Now Playing</span></strong>
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
          <button data-player-sheet="upnext" class="${active==='upnext'?'active':''}" aria-expanded="${active==='upnext'}" aria-label="Play queue" title="Queue">${ic('queue',25)}<span>Queue</span></button>
          <button data-player-sheet="credits" class="${active==='credits'?'active':''}" aria-expanded="${active==='credits'}" aria-label="Track details" title="Credits">${ic('info',25)}<span>Info</span></button>
          <button data-player-sheet="audio" class="${active==='audio'?'active':''}" aria-expanded="${active==='audio'}" aria-label="Source quality details" title="Audio">${ic('audio',25)}<span>Audio</span></button>
          <button data-like-track="${html(t.id||'')}" ${t.id?'':'disabled'} aria-label="Add to favourites" title="Favourite">${ic('heart',26)}<span>Favourite</span></button>
          <button type="button" class="aurel-share-control aurel-share-label" data-aurel-share-kind="track" data-aurel-share-id="${html(t.id||'')}" ${t.id?'':'disabled'} aria-label="Share track" title="Share track"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.2"/><circle cx="5.5" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m7.5 11 8.4-4.9M7.5 13l8.4 4.9"/></svg><span>Share</span></button>
        </div>
        <section class="murglar-progress-row aurel-timeline" aria-label="Playback position">
          <span id="elapsed">${duration(position/1000)}</span>
          <input id="progress" class="progress" type="range" min="0" max="${total||100}" step="500" value="${position}" style="--played:${played}%" ${total>0?'':'disabled'} aria-label="Seek within track" aria-valuetext="${duration(position/1000)} of ${duration(total/1000)}">
          <span id="remaining">${duration(total/1000)}</span>
        </section>
        <section class="murglar-transport aurel-main-actions" aria-label="Playback controls">
          <button id="full-shuffle" data-shuffle class="murglar-control peripheral ${p.shuffle?'active':''}" aria-label="Shuffle" aria-pressed="${!!p.shuffle}">${ic('shuffle',25)}</button>
          <button data-prev class="murglar-control aurel-transport side" aria-label="Previous track">${ic('prev',32)}</button>
          <button id="full-toggle" data-full-toggle class="murglar-control aurel-transport middle" aria-label="${p.playing?'Pause':'Play'}">${ic(p.playing?'pause':'play',41)}</button>
          <button data-next class="murglar-control aurel-transport side" aria-label="Next track">${ic('next',32)}</button>
          <button id="full-repeat" data-repeat class="murglar-control peripheral ${p.repeat?'active':''}" aria-label="${repeatCaption(p)}" aria-pressed="${!!p.repeat}">${ic('repeat',25)}${p.repeat===2?'<sup>1</sup>':''}</button>
        </section>
        <button class="murglar-source-line aurel-source-pill" data-player-sheet="audio" aria-label="See audio source details">
          ${ic('audio',18)}<span>${html(source)}</span>
        </button>
         ${p.error&&(app.session?.mornyeConfigured||app.session?.mornyeConnected)&&/mornye|zarz|gateway|verif|session/i.test(p.error)&&!/rate limit|try again/i.test(p.error)?'<button type="button" class="aurel-recovery-inline" data-reverify-mornye>Verify Mornye session</button>':''}
        <span class="murglar-state" id="playingStatus" aria-live="polite">${stateCaption(p)}</span>
      </div>
      ${active?`<button type="button" class="aurel-detail-dimmer" data-close-detail aria-label="Close details"></button>
      <section class="aurel-detail-drawer" role="dialog" aria-modal="true" aria-label="${active==='upnext'?'Queue':active==='credits'?'Track information':'Audio information'}">
        <header class="aurel-drawer-header">
          <span class="aurel-drawer-handle" aria-hidden="true"></span>
          <h2>${active==='upnext'?'Queue':active==='credits'?'Track information':'Audio information'}</h2>
          <button type="button" data-close-detail aria-label="Close information panel">&times;</button>
        </header>
        <div class="aurel-detail-scroll">
          <div class="aurel-detail-sheet murglar-detail-sheet">${active==='upnext'?queuePanel(p):active==='credits'?creditsPanel(p):audioPanel(p)}</div>
        </div>
      </section>`:''}
    </div>`;
    const scroller=overlay.querySelector('.murglar-player-content');
    const detail=overlay.querySelector('.aurel-detail-scroll');
    const sameTrack=priorTrack===String(t.id||'');
    if(!sameTrack)app.dragging=false;
    if(scroller)scroller.scrollTop=(sameTrack&&active===priorSheet)?priorScroll:0;
    if(detail)detail.scrollTop=(sameTrack&&active===priorSheet)?priorDetailScroll:0;
    overlay.dataset.openSheet=active;
    overlay.dataset.openTrack=String(t.id||'');
  };
  updateOverlayState=function(){
    const p=app.player;
    if(!p||!app.overlay)return;
    const progress=$('#progress');
    if(progress&&!app.dragging){
      const max=Math.max(0,Number(p.duration)||0),value=Math.min(max,Math.max(0,Number(p.position)||0));
      if(Number(progress.max)!==Number(max||100))progress.max=max||100;
      if(progress.disabled!==(max<=0))progress.disabled=max<=0;
      if(Math.abs(Number(progress.value)-Number(value))>150)progress.value=value;
      const seekText=duration(value/1000)+' of '+duration(max/1000);
      if(progress.getAttribute('aria-valuetext')!==seekText)progress.setAttribute('aria-valuetext',seekText);
      const total=Number(p.duration)||0;
      const percent=total?Math.min(100,Math.round((Number(p.position)||0)/total*100))+'%':'0%';
      if(progress.dataset.played!==percent){
        progress.dataset.played=percent;
        progress.style.setProperty('--played',percent);
      }
    }
    const elapsed=$('#elapsed'),remaining=$('#remaining');
    const a=duration((p.position||0)/1000),b=duration((p.duration||0)/1000);
    if(elapsed&&elapsed.textContent!==a)elapsed.textContent=a;
    if(remaining&&remaining.textContent!==b)remaining.textContent=b;
    const toggle=$('#full-toggle'),mode=p.playing?'pause':'play';
    if(toggle){
      if(toggle.dataset.icon!==mode){
        toggle.dataset.icon=mode;
        toggle.innerHTML=ic(mode,41);
      }
      const label=p.playing?'Pause':'Play';
      if(toggle.getAttribute('aria-label')!==label)toggle.setAttribute('aria-label',label);
    }
    const shuffleButton=$('#full-shuffle');
    if(shuffleButton){
      if(shuffleButton.classList.contains('active')!==!!p.shuffle)shuffleButton.classList.toggle('active',!!p.shuffle);
      if(shuffleButton.getAttribute('aria-pressed')!==String(!!p.shuffle))shuffleButton.setAttribute('aria-pressed',String(!!p.shuffle));
    }
    const repeatButton=$('#full-repeat');
    if(repeatButton){
      if(repeatButton.classList.contains('active')!==!!p.repeat)repeatButton.classList.toggle('active',!!p.repeat);
      const repeatText=repeatCaption(p);
      if(repeatButton.getAttribute('aria-label')!==repeatText)repeatButton.setAttribute('aria-label',repeatText);
      if(repeatButton.getAttribute('aria-pressed')!==String(!!p.repeat))repeatButton.setAttribute('aria-pressed',String(!!p.repeat));
      if(repeatButton.dataset.mode!==String(p.repeat)){
        repeatButton.dataset.mode=String(p.repeat);
        repeatButton.innerHTML=ic('repeat',25)+(p.repeat===2?'<sup>1</sup>':'');
      }
    }
    const state=$('#playingStatus'),caption=stateCaption(p);
    if(state&&state.textContent!==caption)state.textContent=caption;
  };
})();
