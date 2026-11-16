
(function installAurelLiveTuning(){
  'use strict';
  // Keep one stable, touch-sized five-tab navigation on every app screen.
  const tabs=document.querySelector('.bottom-nav');
  if(tabs){
    tabs.setAttribute('aria-label','Main navigation');
    tabs.innerHTML=[
      ['home','Discover','home'],['search','Search','search'],
      ['library','Library','library'],['playing','Now Playing','queue'],
      ['settings','Settings','settings']
    ].map(function(entry){
      const action=entry[0]==='playing'?'data-open-player-nav':'data-nav="'+entry[0]+'"';
      return '<button type="button" '+action+'><span class="aurel-tab-icon" aria-hidden="true">'+ic(entry[2],23)+'</span><span class="aurel-tab-label">'+entry[1]+'</span></button>';
    }).join('');
  }
  let navArtwork='';
  function navSync(){
    if(!tabs)return;
    const track=app.player&&app.player.track;
    const url=track?image(track):'';
    const icon=tabs.querySelector('[data-open-player-nav] .aurel-tab-icon');
    if(icon&&url!==navArtwork){
      navArtwork=url;
      icon.innerHTML=url?'<img class="aurel-nav-cover" src="'+html(url)+'" alt="" loading="eager" decoding="async">':ic('queue',23);
    }
    const route=app.overlay?'playing':app.nav==='playlists'?'library':app.nav==='magazine'?'home':app.nav;
    tabs.querySelectorAll('button').forEach(function(b){
      const active=b.hasAttribute('data-open-player-nav')?route==='playing':b.dataset.nav===route;
      b.classList.toggle('active',active);
      if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
  }
  if(tabs){
    tabs.addEventListener('click',function(e){
      const b=e.target.closest('[data-open-player-nav]');
      if(!b)return;
      e.preventDefault();
      e.stopPropagation();
      app.overlay=true;
      app.playerSheet='';
      drawOverlay();
    });
    tabs.addEventListener('error',function(e){
      if(!e.target.matches('img.aurel-nav-cover'))return;
      const el=e.target.closest('.aurel-tab-icon');
      if(el)el.innerHTML=ic('queue',23);
    },true);
  }
  const oldMini=updateMini;
  updateMini=function(){const v=oldMini.apply(this,arguments);navSync();return v;};
  const oldRender=render;
  render=function(){const v=oldRender.apply(this,arguments);navSync();return v;};
  const oldOverlay=drawOverlay;
  drawOverlay=function(){
    const overlay=document.querySelector('#overlay');
    const current=app.player&&app.player.track?image(app.player.track):'';
    if(overlay&&overlay.dataset.paletteArtwork!==current){
      overlay.style.setProperty('--aurel-palette-bg','#1E1B24');
      overlay.style.setProperty('--aurel-palette-surface','#302A35');
      overlay.style.setProperty('--aurel-palette-accent','#C9B7D5');
      overlay.dataset.paletteArtwork='';
    }
    const v=oldOverlay.apply(this,arguments);
    navSync();
    return v;
  };
  window.AurelCoverPalette=function(url,bg,surface,accent){
    const current=app.player&&app.player.track?image(app.player.track):'';
    if(!url||url!==current)return;
    const overlay=document.querySelector('#overlay');
    if(!overlay)return;
    const valid=function(value){return /^#[0-9a-fA-F]{6}$/.test(value)};
    if(!valid(bg)||!valid(surface)||!valid(accent))return;
    overlay.style.setProperty('--aurel-palette-bg',bg);
    overlay.style.setProperty('--aurel-palette-surface',surface);
    overlay.style.setProperty('--aurel-palette-accent',accent);
    overlay.dataset.paletteArtwork=url;
  };
  // Fast in-place suggestions, no input focus loss and no screen rerender on keystrokes.
  let timer=0,serial=0;
  const cache=new Map();
  function show(items,query){
    const field=document.querySelector('#searchInput');
    const pane=document.querySelector('#searchResults');
    if(!field||!pane||app.nav!=='search'||field.value.trim()!==query)return;
    app.results=items;
    pane.innerHTML=items.length?searchResults():'<div class="aurel-live-results-status">No matching results yet.</div>';
  }
  document.addEventListener('input',function(e){
    const input=e.target;
    if(input.id!=='searchInput'||e.isComposing)return;
    const query=input.value.trim();
    app.searchQuery=query;
    const id=++serial;
    clearTimeout(timer);
    const pane=document.querySelector('#searchResults');
    if(query.length<2){
      app.results=[];
      if(pane)pane.innerHTML='<div class="aurel-live-results-status">Enter at least two characters to search.</div>';
      return;
    }
    const category=app.searchType;
    const key=category+'|'+query.toLocaleLowerCase();
    const previous=cache.get(key);
    if(previous&&Date.now()-previous.time<60000)show(previous.items,query);
    else if(pane)pane.innerHTML='<div class="aurel-live-results-status">Searching…</div>';
    timer=setTimeout(async function(){
      try{
        const response=await api('search',{query:query,type:category},true);
        if(id!==serial||app.searchType!==category)return;
        let items=sliceItems(response,category);
        if(!items.length)items=sliceItems(response);
        const needle=query.toLocaleLowerCase();
        const rank=function(item){
          const primary=String(item.title||item.name||'').toLocaleLowerCase();
          const artistName=String(artistLabel(item)||'').toLocaleLowerCase();
          return primary===needle?0:primary.startsWith(needle)?1:primary.includes(needle)?2:artistName.includes(needle)?3:4;
        };
        items=items.slice().sort(function(a,b){return rank(a)-rank(b)});
        cache.set(key,{time:Date.now(),items:items});
        if(cache.size>30)cache.delete(cache.keys().next().value);
        show(items,query);
      }catch(error){
        if(id!==serial)return;
        if(pane&&app.nav==='search'){
          pane.innerHTML='<div class="aurel-live-results-status">Could not load suggestions. Press Search to retry.</div>';
        }
      }
    },320);
  },true);
  document.addEventListener('submit',function(e){
    if(e.target.id==='searchForm'){serial++;clearTimeout(timer);}
  },true);
  navSync();
})();
