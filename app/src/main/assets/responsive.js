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
    if(!p?.track?.id){
      m.classList.add('hidden');
      m.dataset.fingerprint='';
      return;
    }
    const t=p.track,played=p.duration?Math.max(0,Math.min(100,Math.round((p.position||0)/p.duration*100))):0;
    const fingerprint=[t.id,t.title,artistLabel(t),image(t),!!p.playing].join('|');
    m.classList.remove('hidden');
    if(m.dataset.fingerprint!==fingerprint){
      m.dataset.fingerprint=fingerprint;
      m.innerHTML=`<span class="mini-handle" aria-hidden="true"></span>
        ${art(t,'minicover')||'<div class="minicover mini-cover-placeholder">♫</div>'}
        <button class="mini-track-open" data-open-mini-player aria-label="Open Now Playing">
          <strong>${html(t.title||'Untitled')}</strong><small>${html(artistLabel(t))}</small>
        </button>
        <div class="mini-buttons">
          <button data-mini-prev aria-label="Previous track">${ic('prev',23)}</button>
          <button data-mini-toggle aria-label="${p.playing?'Pause':'Play'}" class="mini-play">${ic(p.playing?'pause':'play',25)}</button>
          <button data-mini-next aria-label="Next track">${ic('next',23)}</button>
        </div>
        <span class="mini-progress" style="--played:${played}%" aria-hidden="true"></span>`;
    }else{
      const bar=m.querySelector('.mini-progress');
      if(bar)bar.style.setProperty('--played',played+'%');
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
