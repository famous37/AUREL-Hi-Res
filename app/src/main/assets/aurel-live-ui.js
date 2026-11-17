
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
      return '<button type="button" aria-label="'+entry[1]+'" '+action+'><span class="aurel-tab-icon" aria-hidden="true">'+ic(entry[2],23)+'</span><span class="aurel-tab-label">'+entry[1]+'</span></button>';
    }).join('');
  }
  let navArtwork='';
  const themeByCover=new Map();
  // Neutral graphite is the default. Album-derived colours are opt-in.
  const PALETTE_KEY='aurel_palette_artwork_v1';
  const baseTheme={bg:'#111214',surface:'#202124',accent:'#D5D7DB'};
  let artworkPalette=false;
  try{artworkPalette=localStorage.getItem(PALETTE_KEY)==='on';}catch(_){}
  let activeCover='';
  const validHex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
  function coverNow(){return app.player?.track?image(app.player.track):'';}
  function setTheme(colors){
    const root=document.documentElement;
    if(!root||!root.style)return;
    root.style.setProperty('--aurel-theme-bg',colors.bg);
    root.style.setProperty('--aurel-theme-surface',colors.surface);
    root.style.setProperty('--aurel-theme-accent',colors.accent);
    // Keep the full player and the rest of AUREL on exactly one palette.
    root.style.setProperty('--aurel-palette-bg',colors.bg);
    root.style.setProperty('--aurel-palette-surface',colors.surface);
    root.style.setProperty('--aurel-palette-accent',colors.accent);
    const overlay=document.querySelector('#overlay');
    if(overlay&&overlay.style){
      overlay.style.setProperty('--aurel-palette-bg',colors.bg);
      overlay.style.setProperty('--aurel-palette-surface',colors.surface);
      overlay.style.setProperty('--aurel-palette-accent',colors.accent);
    }
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    if(themeMeta)themeMeta.setAttribute('content',colors.bg);
  }
  function syncTheme(force=false){
    const next=coverNow();
    if(next===activeCover&&!force)return;
    activeCover=next;
    setTheme(artworkPalette?(themeByCover.get(next)||baseTheme):baseTheme);
  }
  function setArtworkPalette(value){
    artworkPalette=!!value;
    try{localStorage.setItem(PALETTE_KEY,artworkPalette?'on':'off');}catch(_){}
    syncTheme(true);
  }
  window.AurelTheme={isArtworkPalette:()=>artworkPalette,setArtworkPalette};
  const originalSettings=renderSettings;
  renderSettings=function(){
    const result=originalSettings.apply(this,arguments);
    const screen=document.getElementById('screen');
    if(screen&&screen.querySelector('.aurel-settings-heading')){
      const panel=document.createElement('section');
      panel.className='panel aurel-appearance-panel';
      panel.innerHTML='<h3>Appearance</h3><label class="aurel-appearance-toggle">'+
        '<span><strong>Use album artwork colours</strong><small>Off by default · neutral dark theme</small></span>'+
        '<input type="checkbox" data-aurel-artwork-colours '+(artworkPalette?'checked':'')+'></label>';
      const first=screen.querySelector('.panel');
      if(first)first.before(panel);else screen.appendChild(panel);
    }
    return result;
  };
  document.addEventListener('change',function(e){
    if(!e.target.matches?.('[data-aurel-artwork-colours]'))return;
    setArtworkPalette(e.target.checked);
  });
  function navSync(){
    if(!tabs)return;
    const track=app.player&&app.player.track;
    const url=track?image(track,'thumb'):'';
    syncTheme();
    const icon=tabs.querySelector('[data-open-player-nav] .aurel-tab-icon');
    if(icon&&url!==navArtwork){
      navArtwork=url;
      icon.innerHTML=url?'<img class="aurel-nav-cover" src="'+html(url)+'" alt="" loading="eager" decoding="async">':ic('queue',23);
    }
    const route=app.overlay?'playing':app.nav==='playlists'?'library':app.nav==='magazine'?'home':app.nav;
    tabs.querySelectorAll('button').forEach(function(b){
      const active=b.hasAttribute('data-open-player-nav')?route==='playing':b.dataset.nav===route;
      // Native player progress arrives every second. Do not repaint stable
      // navigation buttons when neither the route nor the artwork changed.
      if(b.classList.contains('active')!==active)b.classList.toggle('active',active);
      const current=b.getAttribute('aria-current')==='page';
      if(active&&!current)b.setAttribute('aria-current','page');
      else if(!active&&current)b.removeAttribute('aria-current');
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
    const result=oldOverlay.apply(this,arguments);
    navSync();
    return result;
  };
  window.AurelCoverPalette=function(url,bg,surface,accent){
    if(!url||!validHex(bg)||!validHex(surface)||!validHex(accent))return;
    const colors={bg,surface,accent};
    themeByCover.set(url,colors);
    if(themeByCover.size>36)themeByCover.delete(themeByCover.keys().next().value);
    if(artworkPalette&&coverNow()===url){
      activeCover=url;
      setTheme(colors);
    }
  };
  // Physical Android Back should close the information drawer before
  // minimizing the entire player.
  const previousBack=window.AurelBack;
  window.AurelBack=function(){
    if(app.overlay&&app.playerSheet){
      app.playerSheet='';
      drawOverlay();
      return;
    }
    if(typeof previousBack==='function')return previousBack();
  };
  function dismissDetails(ev){
    const button=ev.target.closest?.('[data-close-detail]');
    if(!button)return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if(!app.playerSheet)return;
    app.playerSheet='';
    drawOverlay();
  }
  document.addEventListener('click',dismissDetails,true);
  document.addEventListener('keydown',function(ev){
    if(ev.key==='Escape'&&app.overlay&&app.playerSheet){
      ev.preventDefault();
      app.playerSheet='';
      drawOverlay();
    }
  },true);
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
  setTheme(baseTheme);
  navSync();
})();
