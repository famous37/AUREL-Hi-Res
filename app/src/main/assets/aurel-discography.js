
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
            // Updating a portrait must not tear down the full artist page
            // or reset horizontal shelves and their scroll positions.
            const buttons=document.querySelectorAll('.aurel-similar-artist');
            for(const button of buttons){
              if(button.dataset.openArtist!==id)continue;
              const frame=button.querySelector('.aurel-similar-portrait');
              if(frame&&!frame.querySelector('img')){
                const img=document.createElement('img');
                img.className='aurel-artist-portrait';
                img.loading='lazy';img.src=src;
                img.alt=button.querySelector('strong')?.textContent||'Artist';
                frame.appendChild(img);
              }
            }
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
    const t=String(o.release_type||o.releaseType||o.product_type||o.album_type||o.type||'').toLowerCase();
    if(/compilation|best.?of|anthology/.test(t))return 'compilation';
    if(/ep|single/.test(t))return 'epSingle';
    return 'album';
  };
  function releaseDate(o){
    const s=String(o.release_date_original||o.release_date_stream||o.release_date||o.dates?.stream||'');
    return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):'';
  }
  function canonicalLatestRelease(items){
    // Reissues can inherit a new 2026 streaming date even when the album was
    // originally released in 2006. Deduplicate each work by title, prefer the
    // earliest verified original date, then choose the newest distinct work.
    const works=new Map();
    for(const release of items){
      if(!release||!safeId(release))continue;
      const key=String(release.title||release.name||'').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/\s*[([{](?:remaster(?:ed)?|deluxe|expanded|anniversary|edition|reissue)[^\])}]*[\])}]/gi,'')
        .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      if(!key)continue;
      const current=works.get(key),date=releaseDate(release);
      if(!current||(date&&(!releaseDate(current)||date<releaseDate(current))))
        works.set(key,release);
    }
    return [...works.values()].filter(x=>releaseDate(x))
      .sort((a,b)=>releaseDate(b).localeCompare(releaseDate(a)))[0]||null;
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
    // The Android bridge can wait 65 seconds for a response. A single
    // unavailable category must never leave the page on an endless spinner.
    // The native request may finish later, but only this bounded result is
    // applied; stale results and older artist selections are ignored.
    let timer=null;
    try{
      const timeout=action==='artistPublicFallback'?57000:
        action==='artistReleaseType'?24000:28000;
      const data=await Promise.race([
        nativeCall(action,{id,...params}),
        new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(new Error('Artist catalogue request timed out')),timeout);
        })
      ]);
      if(token!==requestToken||!validSelection(id))return;
      const state=byArtist.get(id);
      if(!state)return;
      apply(state,data);
      rerender(id);
    }catch(error){
      // A timed-out or rejected request is an error, not an empty catalogue.
      if(token!==requestToken||!validSelection(id))return;
      const state=byArtist.get(id);
      if(!state)return;
      if(typeof onError==='function')onError(state,error);
      rerender(id);
    }finally{
      if(timer!==null)clearTimeout(timer);
    }
  }
  function startIndependentArtistCatalog(id,token){
    const state=byArtist.get(id);
    if(!state||state.externalStarted||token!==requestToken)return Promise.resolve();
    state.externalStarted=true;state.externalLoading=true;
    return extend(id,token,'artistPublicFallback',
      {name:artistName(app.selected||{})},function(s,data){
        s.externalLoading=false;s.externalDone=true;
        const top=normalizedPopularTracks(data?.top_tracks,id);
        if(!s.top.length&&top.length&&data?._topSource==='deezer'){
          s.top=top;s.topSource='deezer';s.topError='';
        }
        const eps=asList(data?.eps).map(x=>normalizedRelease(x)).filter(Boolean);
        if(!s.ep.length&&eps.length&&data?._epSource==='deezer'){
          s.ep=unique(eps);s.epSource='deezer';s.epError='';
          s.epShortPreview=false;
        }
      },function(s){
        // Optional independent metadata failure must not interrupt Qobuz playback.
        s.externalLoading=false;s.externalDone=true;
      });
  }
  function loadTypedEps(id,token){
    const state=byArtist.get(id);
    if(!state)return Promise.resolve();
    state.epDone=false;
    return extend(id,token,'artistReleaseType',{releaseType:'epSingle',
      name:artistName(app.selected||{})},function(s,data){
      const releases=asList(data?.albums||data?.releases||data)
        .map(x=>normalizedRelease(x,'epSingle')).filter(Boolean);
      if(releases.length){
        // The official Qobuz category takes priority over independent hints.
        s.ep=unique(releases);s.epSource='qobuz';
      }
      s.epDone=true;
      s.epShortPreview=!!data?._shortPreview;
      // Retain real provider entries from partial responses without a warning overlay.
      s.epError=data?._partial&&!s.epShortPreview&&!s.ep.length?'partial':'';
      if(!s.ep.length)void startIndependentArtistCatalog(id,token);
    },(s,error)=>{
      s.epDone=true;
      const message=String(error?.message||'');
      // artist/get may already have returned genuine, artist-owned short
      // releases even when the typed Qobuz endpoint is denied.
      const candidates=asList(app.selected?.albums).filter(album=>{
        const id=String(album?.artist?.id||'');
        if(id&&id!==String(app.selected?.id))return false;
        const kind=String(album?.release_type||album?.album_type||'').toLowerCase();
        if(kind&&kind!=='single'&&kind!=='epsingle'&&kind!=='ep')return false;
        // Partial Qobuz album previews may list only 1–6 tracks even when
        // the release is a full album; require explicit catalogue type.
        return kind==='single'||kind==='epsingle'||kind==='ep';
      }).map(album=>normalizedRelease(album)).filter(Boolean);
      if(candidates.length)
        s.ep=unique([...s.ep,...candidates]);
      if(s.ep.length){
        // Do not discard authentic artist/page EPs after a typed API rejection.
        s.epShortPreview=true;
        s.epError='';
      }else{
        s.epError=/401|403|405|unauthori[sz]|forbidden|access denied|not permitted|app.?id/i.test(message)
          ?'authorization':'unavailable';
        void startIndependentArtistCatalog(id,token);
      }
    });
  }
  // Qobuz top_tracks is already ordered by Qobuz. Preserve that order.
  // A general artist-name search is not a chart, and collaborations with a
  // different primary artist must not silently populate this artist's chart.
  function normalizedPopularTracks(collection,ownerId){
    const seen=new Set();
    const result=[];
    for(const entry of asList(collection)){
      const track=entry?.track&&typeof entry.track==='object'?entry.track:entry;
      const id=safeId(track);
      if(!id||!track?.title||seen.has(id))continue;
      const primary=track.artist?.id??track.main_artist?.id??
        track.mainArtist?.id??track.album?.artist?.id;
      if(primary!=null&&String(primary)!==String(ownerId))continue;
      seen.add(id);
      result.push(track);
      if(result.length===24)break;
    }
    return result;
  }
  function loadExtras(id){
    const cached=byArtist.get(id);
    // A previous page visit may have invalidated its in-flight responses.
    // Reuse completed metadata, but restart any unfinished categories.
    if(cached&&cached.loaded&&!cached.loading&&cached.epDone&&
       cached.pageDone&&cached.compDone&&
       (!cached.externalStarted||cached.externalDone))return;
    if(cached?.externalStarted&&!cached.externalDone){
      cached.externalStarted=false;cached.externalLoading=false;
    }
    const state=cached||{loading:true,top:[],similar:[],ep:[],compilation:[],following:false};
    state.loading=true;
    state.pageDone=false;
    state.compDone=false;
    state.epDone=false;
    state.loaded=true;
    byArtist.set(id,state);
    if(byArtist.size>16)byArtist.delete(byArtist.keys().next().value);
    const token=++requestToken;
    const top=extend(id,token,'artistExtras',{},function(s,data){
      const official=normalizedPopularTracks(data?.top_tracks||data?.topTracks,id);
      // Prefer the official Qobuz ranking; never erase already matched
      // independent chart results when a slower Qobuz request returns empty.
      if(official.length){s.top=official;s.topSource='qobuz';s.topError='';}
      else if(!s.top.length){
        s.topError=String(data?._topError||data?._pageError||'');
        void startIndependentArtistCatalog(id,token);
      }
      s.similar=asList(data?.similar_artists||data?.similarArtists).filter(x=>safeId(x))
        .map(a=>portraitCache.get(safeId(a))?
          {...a,picture:portraitCache.get(safeId(a))}:a);
      loadSimilarPortraits(id,token);
      // The current artist/page API also returns typed release previews. Render
      // them immediately while separately requested complete lists are loading.
      const preview=data?.releases;
      const groups=asList(preview);
      // Some Qobuz variants return a dictionary keyed by release type.
      if(!groups.length&&preview&&!Array.isArray(preview)&&typeof preview==='object'){
        for(const [kind,value] of Object.entries(preview)){
          if(value&&typeof value==='object')groups.push({...value,type:kind});
        }
      }
      for(const group of groups){
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
      s.biography=biographyText(biography);
      s.pageError=String(data?._pageError||'');
      s.similarError=String(data?._similarError||(
        s.similar.length?'':data?._pageError||''));
      s.pageDone=true;
    },(s)=>{s.pageDone=true;s.pageError='Request failed';s.similarError='Request failed';
      if(!s.top.length){s.topError='Request failed';void startIndependentArtistCatalog(id,token);}
    });
    const ep=loadTypedEps(id,token);
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
    const category=(key==='eps'||key==='compilations');
    const message=category
      ?(error==='authorization'
        ?'This Qobuz connection cannot access this release category.'
        :error==='partial'?'Only part of this release category could be loaded.'
        :'Some release categories could not be loaded.')
      :'Release information could not be loaded.';
    const errorMessage=error?'<span>'+message+
      '</span> <button type="button" data-artist-retry="'+html(key)+'">Retry</button>':'';
    return '<section class="aurel-artist-section" data-artist-section="'+key+'">'
      +'<header class="aurel-artist-section-heading"><h2>'+title+'</h2>'
      +(count>8?'<button type="button" data-artist-more="'+key+'" aria-expanded="false">See all ›</button>':'')
      +'</header>'
      +(count?'<div class="aurel-release-strip">'+items.map(releaseCard).join('')+'</div>'
       :'<p class="aurel-artist-placeholder">'+(loading?'Loading releases…':
         errorMessage||empty+(key==='eps'?
          ' <button type="button" data-artist-retry="eps">Retry</button>':''))+'</p>')
      +(count&&error&&!category?'<p class="aurel-artist-placeholder">'+errorMessage+'</p>':'')
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
  function popularSection(list,loading,error,source){
    return '<section class="aurel-artist-section" data-artist-section="popular">'
      +'<header class="aurel-artist-section-heading"><h2>'+'Most popular'+'</h2>'
      +(source==='deezer'?'<small class="aurel-artist-data-source">Deezer ranking · Qobuz playback</small>':'')
      +(list.length>5?'<button type="button" data-artist-more="popular" aria-expanded="false">See all ›</button>':'')
      +'</header>'
      +(list.length?'<div class="aurel-popular-list">'+list.map((track,i)=>songRow(track,i)).join('')+'</div>'
       :'<p class="aurel-artist-placeholder">'+(loading?'Loading popular tracks…':error?'<span>Popular tracks could not be loaded.</span> <button type="button" data-artist-retry>Retry</button>':'Qobuz did not provide a ranked track list for this connection')+'</p>')
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
       :'<p class="aurel-artist-placeholder">'+(loading?'Loading related artists…':error?'<span>Similar artists could not be loaded.</span> <button type="button" data-artist-retry>Retry</button>':'Qobuz did not provide similar-artist recommendations for this connection')+'</p>')
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
      ?raw.replace(/<\s*br\s*\/?>/gi,'\n')
          .replace(/<\s*\/p\s*>/gi,'\n\n')
          .replace(/<[^>]*>/g,' ')
          .replace(/\r/g,'')
          .replace(/[ \t]+/g,' ')
          .replace(/[ \t]*\n[ \t]*/g,'\n')
          .replace(/\n{3,}/g,'\n\n')
          .trim():'';
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
    const last=canonicalLatestRelease(all);
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
      +'<button type="button" class="aurel-artist-play" data-artist-play-main '+(top.length?'':'disabled')+'>'+ic('play',23)+'<span>'+'Play popular'+'</span></button>'
      +'<button type="button" class="aurel-artist-follow" data-artist-follow="'+html(id)+'">'+ic('plus',19)+'<span>'+(state.following?'Following':'Follow')+'</span></button>'
      +'<button type="button" class="aurel-artist-about" data-artist-info-open aria-haspopup="dialog" aria-label="About artist">'+ic('info',19)+'<span>About artist</span></button>'
      +'</div></header>'
      +popularSection(top,!state.pageDone||!!state.externalLoading,state.topError,state.topSource)
      +(last?'<section class="aurel-artist-section"><header class="aurel-artist-section-heading"><h2>Latest listed release</h2></header>'
         +'<div class="aurel-latest-release">'+releaseCard(last)+'</div></section>':'')
      +section('Albums',albums,'albums','No albums available for this artist',false)
      +section('EPs & Singles',eps,'eps',
        'No verified EPs or singles available from this connection',
        !state.epDone||!!state.externalLoading,state.epError)
      +(state.epSource==='deezer'&&eps.length?
        '<p class="aurel-release-preview-note">Deezer categories · Qobuz albums</p>':'')
      +(state.epShortPreview&&eps.length?'<p class="aurel-release-preview-note">'+
        'EPs and singles identified by Qobuz release metadata.</p>':'')
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
      const section=b.dataset.artistRetry||'';
      if(section==='eps'){
        const state=byArtist.get(id);
        if(state){
          state.epDone=false;state.epError='';
          state.externalStarted=false;state.externalDone=false;state.externalLoading=false;
          rerender(id);
          void loadTypedEps(id,requestToken);
        }else loadExtras(id);
      }else{
        byArtist.delete(id);
        loadExtras(id);
      }
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
