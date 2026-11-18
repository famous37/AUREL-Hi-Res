(function installCompactPlayer(){
  'use strict';
  const mobile=document.querySelector('.bottom-nav');
  if(mobile)mobile.innerHTML=`
    <button data-nav="home"><span aria-hidden="true">${ic('home',24)}</span>Discover</button>
    <button data-nav="search"><span aria-hidden="true">${ic('search',24)}</span>Search</button>
    <button data-nav="library"><span aria-hidden="true">${ic('library',24)}</span>Library</button>
    <button data-nav="settings"><span aria-hidden="true">${ic('settings',24)}</span>Settings</button>`;
  document.querySelectorAll('.sidebar .nav').forEach(b=>{
    const glyph=b.querySelector('b');
    const name=b.dataset.nav==='magazine'?'info':b.dataset.nav;
    if(glyph&&['home','search','library','settings','info'].includes(name))glyph.innerHTML=ic(name,23);
  });
  updateMini=function(){
    const p=app.player,m=$('#mini');
    if(!m)return;
    if(!p?.track?.id){
      m.classList.add('hidden');
      m.dataset.fingerprint='';
      m.dataset.miniPlaying='';
      return;
    }
    const t=p.track,id=String(t.id),cover=image(t,'thumb'),title=trackTitle(t),
          performer=artistLabel(t);
    const played=p.duration?Math.max(0,Math.min(100,(Number(p.position)||0)/(Number(p.duration)||1)*100)):0;
    // Only change the DOM when the track or artwork changes; the name, play
    // button and progress are updated in place with no UI flash or scroll jump.
    const fingerprint=id+'|'+cover;
    m.classList.remove('hidden');
    if(m.dataset.fingerprint!==fingerprint||!m.querySelector('.mini-track-open')){
      m.dataset.fingerprint=fingerprint;
      m.dataset.miniPlaying='';
      m.innerHTML=`<span class="mini-handle" aria-hidden="true"></span>
        ${cover?`<img class="minicover" src="${html(cover)}" alt="Album cover" loading="eager" decoding="async" fetchpriority="high">`:'<div class="minicover mini-cover-placeholder">♫</div>'}
        <button class="mini-track-open" data-open-mini-player aria-label="Open Now Playing">
          <strong class="mini-title">${html(title)}</strong><small class="mini-artist">${html(performer)}</small>
        </button>
        <div class="mini-buttons">
          <button data-mini-prev aria-label="Previous track">${ic('prev',24)}</button>
          <button data-mini-toggle aria-label="Play" class="mini-play">${ic('play',26)}</button>
          <button data-mini-next aria-label="Next track">${ic('next',24)}</button>
        </div>
        <span class="mini-progress" aria-hidden="true"></span>`;
    }
    const name=m.querySelector('.mini-title'),artistNode=m.querySelector('.mini-artist');
    if(name&&name.textContent!==title)name.textContent=title;
    if(artistNode&&artistNode.textContent!==performer)artistNode.textContent=performer;
    const toggle=m.querySelector('[data-mini-toggle]'),state=aurelPlaybackMode(p);
    if(toggle&&m.dataset.miniPlaying!==state){
      toggle.innerHTML=aurelPlaybackIcon(p,26);
      toggle.setAttribute('aria-label',aurelPlaybackLabel(p));
      toggle.setAttribute('aria-busy',String(state==='loading'));
      toggle.classList.toggle('is-loading',state==='loading');
      m.dataset.miniPlaying=state;
    }
    const bar=m.querySelector('.mini-progress'),value=played.toFixed(1)+'%';
    if(bar&&bar.dataset.played!==value){
      bar.style.setProperty('--played',value);
      bar.dataset.played=value;
    }
  };
  let down=null;
  const mini=$('#mini');
  if(mini){
    mini.addEventListener('touchstart',e=>{
      if(e.touches&&e.touches.length===1)down={x:e.touches[0].clientX,y:e.touches[0].clientY};
    },{passive:true});
    mini.addEventListener('touchend',e=>{
      if(!down||!e.changedTouches?.length)return;
      const dx=e.changedTouches[0].clientX-down.x,dy=e.changedTouches[0].clientY-down.y;
      down=null;
      if(dy< -35&&Math.abs(dy)>Math.abs(dx)){app.overlay=true;drawOverlay();}
    },{passive:true});
  }
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('button');
    if(!b)return;
    if(b.hasAttribute('data-mini-prev')){
      ev.preventDefault();ev.stopImmediatePropagation();
      nativeCall('previous').catch(e=>showToast(e.message,5000));
      return;
    }
    if(b.hasAttribute('data-open-mini-player')){
      ev.preventDefault();ev.stopImmediatePropagation();
      app.overlay=true;drawOverlay();
    }
  },true);
})();
