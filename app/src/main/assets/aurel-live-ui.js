
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
      return '<button type="button" aria-label="'+entry[1]+'" '+action+'><span class="aurel-tab-icon" aria-hidden="true">'+ic(entry[2])+'</span><span class="aurel-tab-label">'+entry[1]+'</span></button>';
    }).join('');
  }
  // Vectorise the desktop sidebar too; native nav actions remain unchanged.
  document.querySelectorAll('.sidebar .nav').forEach(function(button){
    const glyph=button.querySelector('b');
    const map={home:'home',magazine:'album',library:'library',search:'search',settings:'settings'};
    const kind=map[button.dataset.nav];
    if(glyph&&kind){glyph.setAttribute('aria-hidden','true');glyph.innerHTML=ic(kind);}
  });
  // All navigation icons remain consistent vectors; track artwork belongs to mini player.
  const themeByCover=new Map();
  // Bounded cache of public artwork colours; never store account credentials.
  const ARTWORK_CACHE_KEY='aurel_palette_colors_v1';
  const validCachedUrl=value=>typeof value==='string'&&
    /^https:\/\/([a-z0-9-]+\.)*qobuz\.com\//i.test(value)&&value.length<900;
  function persistPalettes(){
    try{localStorage.setItem(ARTWORK_CACHE_KEY,
      JSON.stringify([...themeByCover.entries()].filter(([url])=>validCachedUrl(url)).slice(-24)));}
    catch(_){}
  }
  try{
    const previous=JSON.parse(localStorage.getItem(ARTWORK_CACHE_KEY)||'[]');
    if(Array.isArray(previous)){
      for(const pair of previous.slice(-24)){
        if(!Array.isArray(pair)||pair.length!==2||!validCachedUrl(pair[0]))continue;
        const c=pair[1];
        if(!c||!['bg','surface','accent','one','two','three'].every(
          k=>typeof c[k]==='string'&&/^#[0-9a-f]{6}$/i.test(c[k])))continue;
        themeByCover.set(pair[0],c);
      }
    }
  }catch(_){}
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
  try{window.AurelNative?.setMediaArtworkColors?.(artworkPalette);}catch(_){};
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
    // One authoritative palette for legacy and contemporary components.
    // Older Qobuz, Settings, player and library rules read these base tokens.
    root.style.setProperty('--bg',colors.bg);
    root.style.setProperty('--side',colors.bg);
    root.style.setProperty('--surface',colors.surface);
    root.style.setProperty('--surface2',mixHex(colors.surface,'#FFFFFF',.085));
    root.style.setProperty('--accent',colors.accent);
    root.style.setProperty('--accent2',colors.one||colors.accent);
    root.style.setProperty('--text','#F7F5F6');
    root.style.setProperty('--muted','#D6D2D5');
    root.style.setProperty('--low','#BDB8BC');
    root.style.setProperty('--line',mixHex(colors.surface,'#FFFFFF',.12));
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
    try{window.AurelNative?.setMediaArtworkColors?.(artworkPalette);}catch(_){};
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
        '<span><strong>Use album artwork colours</strong></span>'+
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
  let lastNavRoute;
  function navSync(force=false){
    if(!tabs)return;
    syncTheme();
    // The player tab is a stable queue glyph, including during artwork updates.
    const route=app.overlay?'playing':app.nav==='playlists'?'library':app.nav==='magazine'?'home':app.nav;
    if(!force&&route===lastNavRoute)return;
    lastNavRoute=route;
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
      if(el)el.innerHTML=ic('queue');
    },true);
  }
  const oldMini=updateMini;
  updateMini=function(){const v=oldMini.apply(this,arguments);navSync();return v;};
  const oldRender=render;
  render=function(){const v=oldRender.apply(this,arguments);navSync(true);return v;};
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
    themeByCover.delete(url);themeByCover.set(url,colors);
    if(themeByCover.size>36)themeByCover.delete(themeByCover.keys().next().value);
    if(validCachedUrl(url))persistPalettes();
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
  document.addEventListener('input',event=>{
    if(event.target.id==='searchInput'&&!event.isComposing)void search(true);
  },true);
  setTheme(baseTheme);
  navSync();
})();
