
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
  // Vectorise the desktop sidebar too; native nav actions remain unchanged.
  document.querySelectorAll('.sidebar .nav').forEach(function(button){
    const glyph=button.querySelector('b');
    const map={home:'home',magazine:'album',library:'library',search:'search',settings:'settings'};
    const kind=map[button.dataset.nav];
    if(glyph&&kind){glyph.setAttribute('aria-hidden','true');glyph.innerHTML=ic(kind,23);}
  });
  // All navigation icons remain consistent vectors; track artwork belongs to mini player.
  const themeByCover=new Map();
  // Neutral graphite is the default. Album-derived colours are opt-in.
  const PALETTE_KEY='aurel_palette_artwork_v1';
  const baseTheme={bg:'#111214',surface:'#202124',accent:'#D5D7DB',one:'#82878D',two:'#666970',three:'#B0B3B7'};
  let artworkPalette=false;
  try{
    // One-time visual migration: prevent a previously enabled album-derived
    // palette from tinting artist, settings or player screens after the user
    // explicitly chose a monochrome default. They can opt in again manually.
    const migrationKey='aurel_mono_default_1_1_37';
    if(localStorage.getItem(migrationKey)!=='done'){
      localStorage.setItem(PALETTE_KEY,'off');
      localStorage.setItem(migrationKey,'done');
    }
    artworkPalette=localStorage.getItem(PALETTE_KEY)==='on';
  }catch(_){};
  // Explicit theme state lets monochrome selectors override old artwork
  // gradients everywhere, even when older components set inline variables.
  document.documentElement.setAttribute('data-aurel-palette',artworkPalette?'artwork':'mono');
  let activeCover='';
  const validHex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
  // Material-style palette tokens for all existing settings, search and
  // library controls. Native artwork RGB remains the only color source.
  // Real hex values also work on Android 7 WebViews without color-mix().
  const mixHex=(left,right,part)=>{
    const a=validHex(left)?left:'#202124',b=validHex(right)?right:'#111214';
    const t=Math.max(0,Math.min(1,part));
    return '#'+[1,3,5].map(i=>{
      const v=Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+
                         parseInt(b.slice(i,i+2),16)*t);
      return v.toString(16).padStart(2,'0');
    }).join('').toUpperCase();
  };
  const contrastInk=hex=>{
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    const L=rgb.map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));
    return (.2126*L[0]+.7152*L[1]+.0722*L[2])>.28?'#151517':'#FFFFFF';
  };
  function coverNow(){return app.player?.track?image(app.player.track):'';}
  function setTheme(colors){
    const root=document.documentElement;
    if(!root||!root.style)return;
    root.setAttribute('data-aurel-palette',artworkPalette?'artwork':'mono');
    root.style.setProperty('--aurel-theme-bg',colors.bg);
    root.style.setProperty('--aurel-theme-surface',colors.surface);
    root.style.setProperty('--aurel-theme-accent',colors.accent);
    const card=mixHex(colors.surface,colors.bg,.20);
    const raised=mixHex(colors.surface,'#FFFFFF',.10);
    const line=mixHex(colors.surface,'#FFFFFF',.15);
    // Legacy AUREL components use these tokens, not merely --theme-bg.
    // Set them atomically on each actual cover change and on theme OFF.
    root.style.setProperty('--aurel-theme-card',card);
    root.style.setProperty('--aurel-theme-raised',raised);
    root.style.setProperty('--aurel-theme-border',line);
    root.style.setProperty('--aurel-theme-line',line);
    root.style.setProperty('--aurel-theme-on','#F7F5F6');
    root.style.setProperty('--aurel-theme-secondary','#D6D2D5');
    root.style.setProperty('--aurel-theme-muted','#C7C2C7');
    root.style.setProperty('--aurel-theme-ink',contrastInk(colors.accent));
    root.style.setProperty('--aurel-theme-dark',contrastInk(colors.accent));
    root.style.setProperty('--aurel-contrast-ink',contrastInk(colors.accent));
    root.style.setProperty('--aurel-ui-accent',colors.accent);
    root.style.setProperty('--aurel-theme-card-hover',mixHex(raised,colors.accent,.07));
    // Keep the full player and the rest of AUREL on exactly one palette.
    root.style.setProperty('--aurel-palette-bg',colors.bg);
    root.style.setProperty('--aurel-palette-surface',colors.surface);
    root.style.setProperty('--aurel-palette-accent',colors.accent);
    // All screens, cards, drawer surfaces and the mini-player share the same
    // verified current-track palette, but only while the user opts in.
    root.style.setProperty('--aurel-global-glow-one',colors.one||colors.accent);
    root.style.setProperty('--aurel-global-glow-two',colors.two||colors.one||colors.accent);
    root.style.setProperty('--aurel-global-glow-three',colors.three||colors.accent);
    root.style.setProperty('--aurel-shell-accent',colors.accent);
    const overlay=document.querySelector('#overlay');
    if(overlay&&overlay.style){
      overlay.style.setProperty('--aurel-palette-bg',colors.bg);
      overlay.style.setProperty('--aurel-palette-surface',colors.surface);
      overlay.style.setProperty('--aurel-palette-accent',colors.accent);
    }
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    if(themeMeta)themeMeta.setAttribute('content',colors.bg);
    try{window.AurelNative?.setWindowPalette?.(colors.bg);}catch(_){}
    // Match native status and gesture-bar backing without hiding either bar.
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
    window.AurelAurora?.refresh?.();
  }
  window.AurelTheme={isArtworkPalette:()=>artworkPalette,setArtworkPalette,
    cachedPalette:url=>themeByCover.get(url)||null,
    currentColors:()=>artworkPalette?(themeByCover.get(coverNow())||baseTheme):baseTheme};
  const originalSettings=renderSettings;
  renderSettings=function(){
    const result=originalSettings.apply(this,arguments);
    const screen=document.getElementById('screen');
    if(screen&&screen.querySelector('.aurel-settings-heading')){
      const panel=document.createElement('section');
      panel.className='panel aurel-appearance-panel';
      panel.innerHTML='<h3>Appearance</h3><label class="aurel-appearance-toggle">'+
        '<span><strong>Use album artwork colours</strong><small>On: the entire app follows the playing album. Off: neutral graphite throughout.</small></span>'+
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
    syncTheme();
    // The player tab is a stable queue glyph, including during artwork updates.
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
  window.AurelCoverPalette=function(url,bg,surface,accent,glow1,glow2,glow3){
    if(!url||!validHex(bg)||!validHex(surface)||!validHex(accent))return;
    const colors={bg,surface,accent,
      one:validHex(glow1)?glow1:accent,
      two:validHex(glow2)?glow2:accent,
      three:validHex(glow3)?glow3:accent};
    themeByCover.set(url,colors);
    if(themeByCover.size>36)themeByCover.delete(themeByCover.keys().next().value);
    if(artworkPalette&&coverNow()===url){
      activeCover=url;
      setTheme(colors);
    }
    // Playback-only artwork scheme is independent of the global
    // monochrome/album-colours preference.
    if(typeof window.AurelAuroraPalette==='function')
      window.AurelAuroraPalette(url,bg,surface,accent,glow1,glow2,glow3);
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
