(function installMurglarPlayer(){
  'use strict';
  const stateCaption=p=>p?.error?'UNAVAILABLE':p?.buffering?'BUFFERING':p?.playing?'PLAYING':'PAUSED';
  const repeatCaption=p=>Number(p?.repeat)===2?'Repeat one':Number(p?.repeat)===1?'Repeat all':'Repeat off';
  let immersiveState=false;
  const syncImmersive=visible=>{
    if(visible===immersiveState)return;
    immersiveState=visible;
    try{window.AurelNative?.setPlayerImmersive?.(visible);}catch(_){}
  };
  drawOverlay=function(){
    const overlay=$('#overlay');
    syncImmersive(!!app.overlay);
    // Keep the underlying route alive for Back, but never let it paint or
    // receive accessibility focus through the full-player navigation strip.
    document.querySelector('.app')?.classList.toggle('aurel-player-open',!!app.overlay);
    const previousPage=document.querySelector('.main');
    if(previousPage){
      if(app.overlay)previousPage.setAttribute('aria-hidden','true');
      else previousPage.removeAttribute('aria-hidden');
    }
    if(!app.overlay){app.dragging=false;aurelStopLoadingAnimation(overlay);overlay.classList.add('hidden');overlay.innerHTML='';overlay.dataset.openSheet='';return}
    const priorScroll=overlay.querySelector('.murglar-player-content')?.scrollTop||0;
    const priorDetailScroll=overlay.querySelector('.aurel-detail-scroll')?.scrollTop||0;
    const priorSheet=overlay.dataset.openSheet||'';
    const priorTrack=overlay.dataset.openTrack||'';
    const p=app.player||{},t=p.track||{},src=image(t),active=app.playerSheet||'';
    const total=Math.max(0,Number(p.duration)||0),position=Math.min(total,Math.max(0,Number(p.position)||0));
    const played=total?Math.min(100,Math.round(position/total*100)):0;
    const artwork=src?`<img src="${html(src)}" class="murglar-cover" alt="Cover art for ${html(t.album?.title||t.title||'the current track')}" loading="eager">`:'<div class="murglar-cover murglar-art-placeholder" aria-label="No cover art available">♫</div>';
    const source=actualSource(p);
    const loading=aurelPlaybackMode(p)==='loading';
    // Preserve the actual drawer DOM across all player/session/quality updates.
    // Replacing the entire WebView sheet restarts its fade and looks like a
    // bright flash on every native track update.
    const stableId=String(t.id||'');
    // Track progress and native beat events must NEVER replace the complete
    // album cover, play controls or sheet: that destroys compositor layers
    // and causes the visible flashes reported on Pixel Android 17.
    // A changed title, cover, artist, availability or opened sheet does
    // invalidate the subtree, and updates it once on the next draw.
    const visualSignature=JSON.stringify([
      stableId,String(t.title||''),String(t.album?.title||''),
      String(t.album?.id||''),String(t.artist?.id||''),
      String(artistLabel(t)||''),String(src||''),String(active),
      String(t.available??''),String(p.error||'')
    ]);
    const drawerHTML=active?`<button type="button" class="aurel-detail-dimmer" data-close-detail aria-label="Close details"></button>
      <section class="aurel-detail-drawer" role="dialog" aria-modal="true" aria-label="${active==='upnext'?'Queue':active==='credits'?'Track information':active==='lyrics'?'Lyrics':'Audio information'}">
        <header class="aurel-drawer-header">
          <span class="aurel-drawer-handle" aria-hidden="true"></span>
          <h2>${active==='upnext'?'Queue':active==='credits'?'Track information':active==='lyrics'?'Lyrics':'Audio information'}</h2>
          <button type="button" data-close-detail aria-label="Close information panel">&times;</button>
        </header>
        <div class="aurel-detail-scroll">
          <div class="aurel-detail-sheet murglar-detail-sheet">${active==='upnext'?queuePanel(p):active==='credits'?creditsPanel(p):active==='lyrics'?(window.AurelStage2Lyrics?.panel?.(p)||''):audioPanel(p)}</div>
        </div>
      </section>`:'';
    // Switching Lyrics / Queue / Credits / Audio updates ONLY the drawer.
    // Rebuilding the full player destroyed artwork compositing and flashed.
    const stableIdentity=JSON.stringify([stableId,String(t.title||''),
      String(t.album?.title||''),String(t.album?.id||''),
      String(t.artist?.id||''),String(artistLabel(t)||''),String(src||''),
      String(t.available??''),String(p.error||'')]);
    const existing=overlay.querySelector('.murglar-view');
    if(existing&&typeof existing.classList?.toggle==='function'&&
       typeof existing.querySelectorAll==='function'&&
       typeof existing.insertAdjacentHTML==='function'&&
       active!==priorSheet&&!overlay.classList.contains('hidden')&&
       overlay.dataset.openIdentity===stableIdentity){
      existing.classList.toggle('murglar-sheet-open',!!active);
      existing.querySelectorAll('.murglar-quick-actions [data-player-sheet]').forEach(button=>{
        const isActive=button.dataset.playerSheet===active;
        button.classList.toggle('active',isActive);
        button.setAttribute('aria-expanded',String(isActive));
      });
      overlay.querySelector('.aurel-detail-dimmer')?.remove();
      overlay.querySelector('.aurel-detail-drawer')?.remove();
      if(active){
        existing.insertAdjacentHTML('beforeend',drawerHTML);
        const panel=existing.querySelector('.aurel-detail-sheet');
        if(panel){
          panel.__aurelPanelHTML=active==='upnext'?queuePanel(p):
            active==='credits'?creditsPanel(p):
            active==='lyrics'?(window.AurelStage2Lyrics?.panel?.(p)||''):audioPanel(p);
          window.AurelLanguage?.refresh?.(panel);
        }
      }
      overlay.dataset.openSheet=active;
      overlay.dataset.openSignature=visualSignature;
      updateOverlayState();
      return;
    }
    const stableDOM=active===priorSheet&&stableId===priorTrack&&
      overlay.dataset.openSignature===visualSignature&&
      !overlay.classList.contains('hidden')&&
      !!overlay.querySelector('.murglar-view');
    if(stableDOM){
      const livePanel=active?overlay.querySelector('.aurel-detail-sheet'):null;
      if(active&&!livePanel){
        // A drawer was removed elsewhere: rebuild once, not on every tick.
      }else{
        if(livePanel){
          const contents=active==='upnext'?queuePanel(p):
            active==='credits'?creditsPanel(p):active==='lyrics'?(window.AurelStage2Lyrics?.panel?.(p)||''):audioPanel(p);
          if(livePanel.__aurelPanelHTML!==contents){
            livePanel.innerHTML=contents;
            livePanel.__aurelPanelHTML=contents;
          }
        }
        const sourceLabel=overlay.querySelector('.murglar-source-line span');
        if(sourceLabel&&sourceLabel.textContent!==source)sourceLabel.textContent=source;
        updateOverlayState();
        return;
      }
    }
    // Persistent app bottom navigation remains mounted outside this overlay.
    overlay.classList.remove('hidden');
    overlay.style.setProperty('--cover-image','none');
    aurelStopLoadingAnimation(overlay);
    overlay.innerHTML=`<div class="aurel-listening-screen murglar-view ${active?'murglar-sheet-open':''}">
      <div class="aurel-art-backdrop" aria-hidden="true"></div>
      <header class="murglar-header aurel-listening-nav">
        <button data-close-overlay class="murglar-header-button" aria-label="Minimize player">${ic('down',26)}</button>
        <span class="murglar-now-heading" aria-hidden="true"></span>
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
          <button data-player-sheet="upnext" class="${active==='upnext'?'active':''}" aria-expanded="${active==='upnext'}" aria-label="Play queue" title="Queue">${ic('queue',28)}<span>Queue</span></button>
          <button data-player-sheet="credits" class="${active==='credits'?'active':''}" aria-expanded="${active==='credits'}" aria-label="Track details" title="Credits">${ic('info',28)}<span>Info</span></button>
          <button data-player-sheet="lyrics" class="${active==='lyrics'?'active':''}" aria-expanded="${active==='lyrics'}" aria-label="Lyrics" title="Lyrics">${ic('lyrics',28)}<span>Lyrics</span></button>
          <button data-like-track="${html(t.id||'')}" ${t.id?'':'disabled'} aria-label="Add to favourites" title="Favourite">${ic('heart',28)}<span>Favourite</span></button>
          <button type="button" class="aurel-share-control aurel-share-label" data-aurel-share-kind="track" data-aurel-share-id="${html(t.id||'')}" ${t.id?'':'disabled'} aria-label="Share track" title="Share track">${ic('share',28)}<span>Share</span></button>
        </div>
        <section class="murglar-progress-row aurel-timeline" aria-label="Playback position">
          <span id="elapsed">${duration(position/1000)}</span>
          <input id="progress" class="progress" type="range" min="0" max="${total||100}" step="500" value="${position}" style="--played:${played}%" ${total>0?'':'disabled'} aria-label="Seek within track" aria-valuetext="${duration(position/1000)} of ${duration(total/1000)}">
          <span class="aurel-seek-rail" aria-hidden="true"><span class="aurel-seek-rail-fill" style="transform:scaleX(${(played/100).toFixed(4)})"></span></span>
          <span id="remaining">-${duration(Math.max(0,total-position)/1000)}</span>
        </section>
        <section class="murglar-transport aurel-main-actions" aria-label="Playback controls">
          <button id="full-shuffle" data-shuffle class="murglar-control peripheral ${p.shuffle?'active':''}" aria-label="Shuffle" aria-pressed="${!!p.shuffle}">${ic('shuffle',25)}</button>
          <button data-prev class="murglar-control aurel-transport side" aria-label="Previous track">${ic('prev',32)}</button>
          <button id="full-toggle" data-full-toggle class="murglar-control aurel-transport middle ${loading?'is-loading':''}" aria-label="${aurelPlaybackLabel(p)}" aria-busy="${loading}">${aurelPlaybackIcon(p,39)}</button>
          <button data-next class="murglar-control aurel-transport side" aria-label="Next track">${ic('next',32)}</button>
          <button id="full-repeat" data-repeat class="murglar-control peripheral ${p.repeat?'active':''}" aria-label="${repeatCaption(p)}" aria-pressed="${!!p.repeat}">${ic('repeat',25)}${p.repeat===2?'<sup>1</sup>':''}</button>
        </section>
        <button class="murglar-source-line aurel-source-pill" data-player-sheet="audio" aria-label="See audio source details">
          ${ic('audio',18)}<span>${html(source)}</span>
        </button>
         ${p.error&&(app.session?.mornyeConfigured||app.session?.mornyeConnected)&&/mornye|zarz|gateway|verif|session/i.test(p.error)&&!/rate limit|try again/i.test(p.error)?'<button type="button" class="aurel-recovery-inline" data-reverify-mornye>Verify Mornye session</button>':''}
        <span class="murglar-state" id="playingStatus" aria-live="polite">${stateCaption(p)}</span>
      </div>
      ${drawerHTML}
    </div>`;
    aurelEnsureLoadingAnimation(overlay);
    const createdPanel=overlay.querySelector('.aurel-detail-sheet');
    if(createdPanel&&active)createdPanel.__aurelPanelHTML=
      active==='upnext'?queuePanel(p):active==='credits'?creditsPanel(p):active==='lyrics'?(window.AurelStage2Lyrics?.panel?.(p)||''):audioPanel(p);
    const scroller=overlay.querySelector('.murglar-player-content');
    const detail=overlay.querySelector('.aurel-detail-scroll');
    const sameTrack=priorTrack===String(t.id||'');
    if(!sameTrack)app.dragging=false;
    if(scroller)scroller.scrollTop=(sameTrack&&active===priorSheet)?priorScroll:0;
    if(detail)detail.scrollTop=(sameTrack&&active===priorSheet)?priorDetailScroll:0;
    overlay.dataset.openSheet=active;
    overlay.dataset.openTrack=String(t.id||'');
    overlay.dataset.openSignature=visualSignature;
    overlay.dataset.openIdentity=stableIdentity;
  };
  updateOverlayState=function(){
    const p=app.player;
    if(!p||!app.overlay)return;
    const progress=$('#progress');
    if(progress&&!app.dragging){
      const max=Math.max(0,Number(p.duration)||0),value=Math.min(max,Math.max(0,Number(p.position)||0));
      if(Number(progress.max)!==Number(max||100))progress.max=max||100;
      if(progress.disabled!==(max<=0))progress.disabled=max<=0;
      // The compositor owns running progress; native snapshots should not
      // move the slider backwards when the audio clock is active.
      if((!p.playing||!window.AurelProgressClock)&&
         Math.abs(Number(progress.value)-Number(value))>150)
        progress.value=value;
      const seekText=duration(value/1000)+' of '+duration(max/1000);
      if((!p.playing||!window.AurelProgressClock)&&
         progress.getAttribute('aria-valuetext')!==seekText)
        progress.setAttribute('aria-valuetext',seekText);
      const total=Number(p.duration)||0;
      const percent=total?Math.min(100,Math.round((Number(p.position)||0)/total*100))+'%':'0%';
      if((!p.playing||!window.AurelProgressClock)&&progress.dataset.played!==percent){
        progress.dataset.played=percent;
        progress.style.setProperty('--played',percent);
        const rail=progress.parentElement?.querySelector('.aurel-seek-rail-fill');
        if(rail)rail.style.transform='scaleX('+
          (Math.min(100,Math.max(0,parseFloat(percent)||0))/100).toFixed(5)+')';
      }
    }
    const elapsed=$('#elapsed'),remaining=$('#remaining');
    const positionForLabels=(p.playing&&window.AurelProgressClock)?
      window.AurelProgressClock.read(p):(Number(p.position)||0);
    const a=duration(positionForLabels/1000),
      b='-'+duration(Math.max(0,(Number(p.duration)||0)-positionForLabels)/1000);
    if(elapsed&&elapsed.textContent!==a)elapsed.textContent=a;
    if(remaining&&remaining.textContent!==b)remaining.textContent=b;
    const toggle=$('#full-toggle'),mode=aurelPlaybackMode(p);
    if(toggle){
      if(toggle.dataset.icon!==mode){
        aurelStopLoadingAnimation(toggle);
        toggle.dataset.icon=mode;
        toggle.innerHTML=aurelPlaybackIcon(p,39);
      }
      toggle.classList.toggle('is-loading',mode==='loading');
      if(mode==='loading')aurelEnsureLoadingAnimation(toggle);
      if(toggle.getAttribute('aria-busy')!==String(mode==='loading'))
        toggle.setAttribute('aria-busy',String(mode==='loading'));
      const label=aurelPlaybackLabel(p);
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
