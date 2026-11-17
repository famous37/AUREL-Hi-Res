
/* AUREL 1.1.6 — independently rendered artist catalog.
   All music, biography and artist IDs come from Qobuz, never invented.
   The existing playback, search, account and navigation actions remain intact. */
(function setupArtistDiscography(){
  'use strict';
  const byArtist=new Map();
  // Similar-artist listings often return only names/IDs, not portraits.
  // Resolve real pictures from the artist record, keep a bounded cache.
  const portraitCache=new Map();
  const portraitPending=new Set();
  let requestToken=0;
  function portraitSrc(value){
    const o=value?.artist&&typeof value.artist==='object'&&
      !value.picture&&!value.image?value.artist:value;
    const fields=[o?.picture,o?.image,o?.pictures,o?.images,o?.portrait,o?.photo,o?.avatar];
    function fromImage(node,depth){
      if(typeof node==='string'){
        const direct=safeCover(node);
        if(direct)return direct;
        // Qobuz occasionally provides http: static-image links; upgrade only
        // URLs on the already allowed Qobuz domains.
        try{const u=new URL(node);
          if(u.protocol==='http:'&&(u.hostname==='qobuz.com'||u.hostname.endsWith('.qobuz.com'))){
            u.protocol='https:';
            return safeCover(u.href);
          }
        }catch(_){}
        return '';
      }
      if(!node||typeof node!=='object'||depth>3)return '';
      for(const key of ['medium','small','thumbnail','portrait','square',
                        'large','xl','extralarge','extra_large','original',
                        'default','url','src','image','picture']){
        const result=fromImage(node[key],depth+1);
        if(result)return result;
      }
      return '';
    }
    for(const field of fields){const found=fromImage(field,0);if(found)return found;}
    return '';
  }
  function loadSimilarPortraits(ownerId,token,all=false){
    const state=byArtist.get(ownerId);
    if(!state?.similar?.length)return;
    const ids=state.similar.slice(0,all?24:8)
      .map(a=>safeId(a)).filter(id=>/^\d{1,20}$/.test(id));
    const queue=ids.filter(id=>{
      const entry=state.similar.find(a=>safeId(a)===id);
      return entry&&!portraitSrc(entry)&&!portraitCache.has(id)&&!portraitPending.has(id);
    });
    if(!queue.length)return;
    async function worker(){
      while(queue.length&&token===requestToken){
        const id=queue.shift();
        if(portraitPending.has(id))continue;
        portraitPending.add(id);
        let src='';
        try {
          const result=await nativeCall('artistPortrait',{id});
          src=portraitSrc(result);
          if(portraitCache.size>=96)portraitCache.delete(portraitCache.keys().next().value);
          portraitCache.set(id,src);
        }catch(_){
          // A failed portrait request is not evidence that the artist has no photo.
          // Keep initials; further browsing may retry after a new page visit.
        }finally{portraitPending.delete(id);}
        if(src&&token===requestToken&&validSelection(ownerId)){
          const current=byArtist.get(ownerId);
          if(current){
            current.similar=current.similar.map(a=>
              safeId(a)===id?{...a,picture:src}:a);
            rerender(ownerId);
          }
        }
      }
    }
    void Promise.allSettled([worker(),worker()]);
  }
  const asList=function(v) {
    if(Array.isArray(v))return v;
    if(v&&typeof v==='object') {
      if(Array.isArray(v.items))return v.items;
      if(Array.isArray(v.tracks))return v.tracks;
      if(Array.isArray(v.releases))return v.releases;
      if(Array.isArray(v.albums))return v.albums;
      if(Array.isArray(v.artists))return v.artists;
    }
    return [];
  };
  const safeId=o=>o?.id===undefined||o?.id===null?'':String(o.id);
  function normalizedRelease(v,sourceType=''){
    const release=(v?.album&&typeof v.album==='object')?v.album:v;
    if(!release||typeof release!=='object')return null;
    const name=release.title||release.name;
    if(!safeId(release)||!name)return null;
    return {...release,
      artist:release.artist||app.selected?.artist||{id:app.selected?.id,name:artistName(app.selected||{})},
      release_type:String(v?.release_type||release.release_type||sourceType||''),
      tracks_count:release.tracks_count??v?.tracks_count,
      release_date_original:release.release_date_original||release.dates?.original||v?.dates?.original,
      release_date_stream:release.release_date_stream||release.dates?.stream||v?.dates?.stream
    };
  }
  const unique=function(items){
    const ids=new Set();
    return items.filter(o=>{
      const id=safeId(o);
      if(!id||ids.has(id))return false;
      ids.add(id);return true;
    });
  };
  const typeOf=o=>{
    const t=String(o.release_type||o.releaseType||o.product_type||o.album_type||'').toLowerCase();
    if(/compilation|best.?of|anthology/.test(t))return 'compilation';
    if(/ep|single/.test(t))return 'epSingle';
    return 'album';
  };
  function releaseDate(o){
    const s=String(o.release_date_original||o.release_date_stream||o.release_date||o.dates?.stream||'');
    return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):'';
  }
  function detailFor(id){return byArtist.get(id)||{loading:true,top:[],similar:[],ep:[],compilation:[],following:false};}
  function validSelection(id){
    return app.selectedKind==='artist'&&String(app.selected?.id||'')===String(id);
  }
  function rerender(id){
    if(!validSelection(id))return;
    const scroll=document.scrollingElement;
    const before=scroll?scroll.scrollTop:0;
    renderArtist();
    if(scroll)scroll.scrollTop=before;
    // The information sheet is outside #screen, so catalogue refreshes
    // never close it or reset its scroll while the full biography arrives.
    window.AurelArtistInfoRefresh?.(id);
  }
  async function extend(id,token,action,params,apply,onError){
    try{
      const data=await nativeCall(action,{id,...params});
      if(token!==requestToken)return;
      const state=byArtist.get(id);
      if(!state)return;
      apply(state,data);
      rerender(id);
    }catch(error){
      // Failed requests must not be displayed as genuinely empty discographies.
      if(token!==requestToken)return;
      const state=byArtist.get(id);
      if(!state)return;
      if(typeof onError==='function')onError(state,error);
      rerender(id);
    }
  }
  function loadExtras(id){
    const cached=byArtist.get(id);
    if(cached&&cached.loaded&&!cached.loading)return;
    const state=cached||{loading:true,top:[],similar:[],ep:[],compilation:[],following:false};
    state.loaded=true;
    byArtist.set(id,state);
    if(byArtist.size>16)byArtist.delete(byArtist.keys().next().value);
    const token=++requestToken;
    const top=extend(id,token,'artistExtras',{},function(s,data){
      s.top=asList(data?.top_tracks||data?.topTracks).filter(x=>safeId(x)&&x.title);
      s.similar=asList(data?.similar_artists||data?.similarArtists).filter(x=>safeId(x))
        .map(a=>portraitCache.get(safeId(a))?
          {...a,picture:portraitCache.get(safeId(a))}:a);
      loadSimilarPortraits(id,token);
      // The current artist/page API also returns typed release previews. Render
      // them immediately while separately requested complete lists are loading.
      for(const group of asList(data?.releases)){
        const kind=String(group?.type||group?.release_type||'');
        const releases=asList(group).map(x=>normalizedRelease(x,kind)).filter(Boolean);
        if(kind==='epSingle'||kind==='single'||kind==='ep')
          s.ep=unique([...s.ep,...releases]);
        else if(kind==='compilation')
          s.compilation=unique([...s.compilation,...releases]);
        else if(kind==='album')
          s.pageAlbums=unique([...(s.pageAlbums||[]),...releases]);
      }
      s.lastRelease=normalizedRelease(data?.last_release);
      const biography=data?.biography?.content||data?.biography?.text||data?.biography;
      s.biography=typeof biography==='string'?biography.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
      s.pageError=String(data?._pageError||'');
      s.similarError=String(data?._similarError||'');
      s.pageDone=true;
    },(s)=>{s.pageDone=true;s.pageError='Request failed';s.similarError='Request failed';});
    const ep=extend(id,token,'artistReleaseType',{releaseType:'epSingle'},function(s,data){
      s.ep=unique([...s.ep,...asList(data?.albums||data?.releases||data).map(x=>normalizedRelease(x,'epSingle')).filter(Boolean)]);
      s.epDone=true;
      s.epError='';
    },(s)=>{s.epDone=true;s.epError='Request failed';});
    const compilations=extend(id,token,'artistReleaseType',{releaseType:'compilation'},function(s,data){
      s.compilation=unique([...s.compilation,...asList(data?.albums||data?.releases||data).map(x=>normalizedRelease(x,'compilation')).filter(Boolean)]);
      s.compDone=true;
    });
    Promise.allSettled([top,ep,compilations]).then(()=>{
      if(token!==requestToken)return;
      const latest=byArtist.get(id);
      if(latest){
        latest.loading=false;
        latest.pageDone=true;
        latest.epDone=true;
        latest.compDone=true;
        rerender(id);
      }
    });
  }
  function releaseCard(o){
    const title=String(o.title||o.name||'Untitled');
    const date=releaseDate(o),year=date?date.slice(0,4):'';
    return '<button type="button" class="aurel-release-card" data-open-album="'+html(safeId(o))+'" aria-label="Open '+html(title)+' album">'
      +'<span class="aurel-release-art">'+(art(o,'aurel-release-image')||'<span class="aurel-art-placeholder">♪</span>')+'</span>'
      +'<strong>'+html(title)+'</strong>'
      +'<small>'+html(year||artistLabel(o))+'</small>'
      +(Number(o.maximum_bit_depth)>16?'<em>Hi-Res</em>':'')+'</button>';
  }
  function section(title,items,key,empty,loading,error){
    const count=items.length;
    const errorMessage=error?'<span>Release information could not be loaded.</span> <button type="button" data-artist-retry>Retry</button>':'';
    return '<section class="aurel-artist-section" data-artist-section="'+key+'">'
      +'<header class="aurel-artist-section-heading"><h2>'+title+'</h2>'
      +(count>8?'<button type="button" data-artist-more="'+key+'" aria-expanded="false">See all ›</button>':'')
      +'</header>'
      +(count?'<div class="aurel-release-strip">'+items.map(releaseCard).join('')+'</div>'
       :'<p class="aurel-artist-placeholder">'+(loading?'Loading releases…':errorMessage||empty)+'</p>')
      +'</section>';
  }
  function songRow(t,i){
    return '<button type="button" class="aurel-popular-track" data-artist-play="'+i+'">'
      +'<span class="aurel-popular-number">'+(i+1)+'</span>'
      +'<span class="aurel-popular-art">'+(art(t,'aurel-popular-image')||'<span>♪</span>')+'</span>'
      +'<span class="aurel-popular-copy"><strong>'+html(t.title||'Untitled')+'</strong>'
      +'<small>'+html(t.album?.title||artistLabel(t))+'</small></span>'
      +'<span class="aurel-popular-play" aria-hidden="true">▶</span></button>';
  }
  function popularSection(list,loading,error){
    return '<section class="aurel-artist-section" data-artist-section="popular">'
      +'<header class="aurel-artist-section-heading"><h2>Most popular</h2>'
      +(list.length>5?'<button type="button" data-artist-more="popular" aria-expanded="false">See all ›</button>':'')
      +'</header>'
      +(list.length?'<div class="aurel-popular-list">'+list.map(songRow).join('')+'</div>'
       :'<p class="aurel-artist-placeholder">'+(loading?'Loading popular tracks…':error?'<span>Popular tracks could not be loaded.</span> <button type="button" data-artist-retry>Retry</button>':'No popular tracks returned by Qobuz')+'</p>')
      +'</section>';
  }
  function similarSection(items,loading,error){
    return '<section class="aurel-artist-section" data-artist-section="similar">'
      +'<header class="aurel-artist-section-heading"><h2>Similar artists</h2>'
      +(items.length>8?'<button type="button" data-artist-more="similar" aria-expanded="false">See all ›</button>':'')
      +'</header>'
      +(items.length?'<div class="aurel-similar-strip">'+items.map(o=>{
        const label=artistName(o);
        const src=portraitSrc(o)||portraitCache.get(safeId(o))||'';
        const initial=(Array.from(label).find(c=>/[^\W\d_]/u.test(c))||'♪').toUpperCase();
        return '<button type="button" class="aurel-similar-artist" data-open-artist="'+html(safeId(o))+'">'
          +'<span class="aurel-similar-portrait"><span class="aurel-artist-initial" aria-hidden="true">'+html(initial)+'</span>'
          +(src?'<img class="aurel-artist-portrait" loading="lazy" src="'+html(src)+'" alt="'+html(label)+'">':'')
          +'</span><strong>'+html(label)+'</strong><small>Artist</small></button>';
      }).join('')+'</div>'
       :'<p class="aurel-artist-placeholder">'+(loading?'Loading related artists…':error?'<span>Similar artists could not be loaded.</span> <button type="button" data-artist-retry>Retry</button>':'No similar artists returned by Qobuz')+'</p>')
      +'</section>';
  }
  // Called only after a newly verified session to retry previously rejected
  // artist extras; never cache 401 as an empty discography.
  window.AurelResetArtistMetadata=id=>{byArtist.delete(String(id));};
  window.AurelEnsureArtistExtras=id=>loadExtras(String(id));
  const oldOpenArtist=openArtist;
  openArtist=async function(id){
    requestToken++;
    await oldOpenArtist(id);
    if(validSelection(id))loadExtras(String(id));
  };
  const biographyText=value=>{
    const raw=value?.content||value?.text||value;
    return typeof raw==='string'
      ?raw.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim():'';
  };
  // Read-only, Qobuz-backed information for the accessible artist sheet.
  // Never create biography text from a guess or a generic internet search.
  window.AurelArtistInfoData=id=>{
    if(!validSelection(id))return null;
    const o=app.selected||{},state=detailFor(String(id));
    return {
      id:String(id),
      name:artistName(o),
      biography:state.biography||biographyText(o.biography)||biographyText(o.description),
      loading:!state.pageDone,
      error:!!state.pageError
    };
  };
  renderArtist=function(){
    const o=app.selected||{},id=safeId(o);
    if(!id)return;
    const state=detailFor(id);
    const base=unique([...asList(o.albums),...(state.pageAlbums||[])].map(x=>normalizedRelease(x)).filter(Boolean));
    const epFromBase=base.filter(x=>typeOf(x)==='epSingle');
    const compFromBase=base.filter(x=>typeOf(x)==='compilation');
    const eps=unique([...state.ep,...epFromBase]);
    const compilations=unique([...state.compilation,...compFromBase]);
    const separate=new Set([...eps,...compilations].map(safeId));
    const albums=base.filter(x=>!separate.has(safeId(x)));
    const all=unique([...base,...eps,...compilations,...(state.lastRelease?[state.lastRelease]:[])]);
    const last=all.slice().sort((a,b)=>releaseDate(b).localeCompare(releaseDate(a)))[0];
    const top=state.top||[];
    const avatar=art(o,'aurel-artist-photo')||'<span class="aurel-artist-photo aurel-art-placeholder">♪</span>';
    const fullBio=window.AurelArtistInfoData(id)?.biography||'';
    const bio=fullBio?'<button type="button" class="aurel-artist-bio" data-artist-info-open aria-label="Read full biography">'
      +'<span>'+html(fullBio.slice(0,260))+(fullBio.length>260?'…':'')+'</span>'
      +'<span class="aurel-artist-read-more">Read more '+ic('chevron',16)+'</span></button>':'';
    const showMore=base.length>=Number(o.albums?.limit||100)&&base.length<Number(o.albums?.total||base.length);
    $('#screen').innerHTML='<div class="aurel-artist-page">'
      +'<header class="aurel-artist-hero">'
      +'<div class="aurel-artist-hero-toolbar"><button type="button" data-back aria-label="Back">'+ic('back',26)+'</button><span>Artist</span></div>'
      +'<div class="aurel-artist-photo-frame">'+avatar+'</div>'
      +'<h1>'+html(artistName(o))+'</h1><span class="aurel-artist-kind">Artist</span>'
      +bio
      +'<div class="aurel-artist-actions">'
      +'<button type="button" class="aurel-artist-play" data-artist-play-main '+(top.length?'':'disabled')+'>'+ic('play',23)+'<span>Play popular</span></button>'
      +'<button type="button" class="aurel-artist-follow" data-artist-follow="'+html(id)+'">'+ic('plus',19)+'<span>'+(state.following?'Following':'Follow')+'</span></button>'
      +'<button type="button" class="aurel-artist-about" data-artist-info-open aria-haspopup="dialog" aria-label="About artist">'+ic('info',19)+'<span>About artist</span></button>'
      +'</div></header>'
      +popularSection(top,!state.pageDone,state.pageError)
      +(last?'<section class="aurel-artist-section"><header class="aurel-artist-section-heading"><h2>Latest release</h2></header>'
         +'<div class="aurel-latest-release">'+releaseCard(last)+'</div></section>':'')
      +section('Albums',albums,'albums','No albums available for this artist',false)
      +section('EPs & Singles',eps,'eps','No EPs or singles returned by Qobuz',!state.epDone,state.epError)
      +(compilations.length?section('Compilations',compilations,'compilations','',false):'')
      +similarSection(state.similar||[],!state.pageDone,state.similarError)
      +(showMore?'<button type="button" class="aurel-artist-load-more" data-load-more-artist>Load more releases</button>':'')
      +'</div>';
  };
  // If the CDN rejects a photo, show the readable initial instead of a
  // broken-image icon. No album artwork or other image handlers are changed.
  document.addEventListener('error',function(event){
    const img=event.target;
    if(img?.classList?.contains('aurel-artist-portrait'))img.remove();
  },true);
  document.addEventListener('click',function(ev){
    const b=ev.target.closest?.('button');
    if(!b||app.selectedKind!=='artist')return;
    if(b.hasAttribute('data-artist-retry')){
      ev.preventDefault();ev.stopImmediatePropagation();
      const id=safeId(app.selected);
      byArtist.delete(id);
      loadExtras(id);
      return;
    }
    if(b.dataset.artistMore){
      ev.preventDefault();ev.stopImmediatePropagation();
      const section=b.closest('.aurel-artist-section');
      if(!section)return;
      const expand=!section.classList.contains('expanded');
      section.classList.toggle('expanded',expand);
      b.textContent=expand?'Show less ↑':'See all ›';
      b.setAttribute('aria-expanded',String(expand));
      if(expand&&b.dataset.artistMore==='similar')
        loadSimilarPortraits(safeId(app.selected),requestToken,true);
      return;
    }
    if(b.hasAttribute('data-artist-play-main')||b.hasAttribute('data-artist-play')){
      ev.preventDefault();ev.stopImmediatePropagation();
      const list=detailFor(safeId(app.selected)).top||[];
      if(!list.length){showToast('Popular tracks are not available for playback');return;}
      const tracks=list.map(t=>({...t,artist:t.artist||{id:app.selected.id,name:artistName(app.selected)},album:t.album||{}}));
      const index=b.hasAttribute('data-artist-play')?Number(b.dataset.artistPlay):0;
      playFromTracks(tracks,index).catch(e=>showToast(e.message));
      return;
    }
    if(b.hasAttribute('data-artist-follow')){
      ev.preventDefault();ev.stopImmediatePropagation();
      const id=b.dataset.artistFollow;
      if(window.AurelFavoriteToggle){
        window.AurelFavoriteToggle('artists',id,b);
      }else showToast('Favourite controls are unavailable');
    }
  },true);
})();
