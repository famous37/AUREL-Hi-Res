// Exercise the shipped HTML, styles and delegated handlers together in mobile Chromium.
// GitHub's Android build runner includes a matching Chrome and ChromeDriver.
'use strict';
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const net=require('node:net');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function run(){
 const binary=process.env.AUREL_CHROMEDRIVER||'chromedriver';
 if(spawnSync(binary,['--version']).status!==0){
  if(process.env.GITHUB_ACTIONS)throw new Error('ChromeDriver required for mobile interaction tests');
  console.log('Mobile Chromium tests skipped locally (install ChromeDriver to run).');
  return;
 }
 const portServer=net.createServer();
 await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));
 const port=portServer.address().port;
 await new Promise(resolve=>portServer.close(resolve));
 const base='http://127.0.0.1:'+port;
 const driver=spawn(binary,['--port='+port],{stdio:'ignore'});
 let session;
 async function command(endpoint,body){
  const response=await fetch(base+endpoint,body===undefined?{}:{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const {value}=await response.json();
  if(!response.ok)throw new Error(value?.message||'ChromeDriver '+response.status);
  return value;
 }
 try{
  let ready=false;
  for(let i=0;i<60&&!ready;i++){
   try{ready=(await command('/status')).ready;}catch{await delay(100);}
  }
  assert(ready,'ChromeDriver did not start');
  const options={args:['--headless','--no-sandbox','--disable-dev-shm-usage']};
  if(process.env.AUREL_CHROME)options.binary=process.env.AUREL_CHROME;
  const info=await command('/session',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':options}}});
  session='/session/'+info.sessionId;
  const cdp=(cmd,params)=>command(session+'/goog/cdp/execute',{cmd,params});
  const viewport=async(width,height)=>cdp('Emulation.setDeviceMetricsOverride',{
   width,height,deviceScaleFactor:2,mobile:true
  });
  async function evaluate(fn,...args){
   const script='const done=arguments[arguments.length-1];'+
    'Promise.resolve().then(()=>('+fn.toString()+')(...Array.from(arguments).slice(0,-1)))'+
    '.then(value=>done({value}),error=>done({error:String(error.stack||error)}));';
   const result=await command(session+'/execute/async',{script,args});
   assert(!result.error,result.error);
   return result.value;
  }
  await viewport(393,808);
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await cdp('Network.enable',{});
  await cdp('Network.setBlockedURLs',{urls:['*://*.qobuz.com/*']});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:'('+installFixture.toString()+')()'});
  await command(session+'/url',{url:pathToFileURL(path.join(__dirname,'../app/src/main/assets/index.html')).href});
  await evaluate(checkLibraryAndSearch);
  await evaluate(checkGestures);
  await evaluate(checkReopen);
  const handlePoint=()=>evaluate(async()=>{
   await fixture.frame();
   const handle=document.querySelector('.aurel-drawer-handle');
   const rect=handle.getBoundingClientRect();
   const x=Math.round(rect.x+rect.width/2),y=Math.round(rect.y+rect.height/2);
   const hit=document.elementFromPoint(x,y);
   fixture.check(handle.contains(hit),'Drawer handle covered by '+hit?.outerHTML.slice(0,180));
   return {x,y};
  });
  async function touch(deltaY){
   const {x,y}=await handlePoint();
   const actions=[{type:'pointerMove',origin:'viewport',x,y},{type:'pointerDown',button:0}];
   if(deltaY)actions.push({type:'pointerMove',duration:130,origin:'viewport',x,y:y+deltaY});
   actions.push({type:'pointerUp',button:0});
   await command(session+'/actions',{actions:[{type:'pointer',id:'finger',parameters:{pointerType:'touch'},actions}]});
  }
  await evaluate(()=>document.querySelector('button[data-player-sheet="credits"]').click());
  await touch(-72);
  assert(await evaluate(()=>AurelDetailDrag.isExpanded()),'Touch drag did not expand the drawer');
  await touch(0);
  assert.equal(await evaluate(()=>AurelDetailDrag.isExpanded()),false,'A new tap after dragging did not collapse the drawer');
  await viewport(320,600);
  await evaluate(async()=>{
   await fixture.frame();
   const cover=document.querySelector('.murglar-cover'),width=cover.getBoundingClientRect().width;
   const fit=getComputedStyle(cover).getPropertyValue('--aurel-fit-art');
   fixture.check(parseFloat(fit)<=innerWidth*.94+1,'Open drawer kept the previous viewport fit');
   document.querySelector('.aurel-drawer-header [data-close-detail]').click();
   await fixture.frame();
   fixture.check(Math.abs(cover.getBoundingClientRect().width-width)<2,'Closing the resized drawer changed cover width');
  });
  for(const [width,height] of [[393,808],[360,640],[808,393]]){
   await viewport(width,height);
   const metrics=await evaluate(checkLayout);
   console.log('Mobile layout',width+'x'+height,JSON.stringify(metrics));
  }
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const animations=await evaluate(async()=>{
   document.querySelector('button[data-player-sheet="credits"]').click();
   return document.querySelector('.aurel-detail-drawer').getAnimations().length;
  });
  assert.equal(animations,0,'Reduced motion must suppress drawer entrance');
  console.log('Playback clock and native message sizes',await evaluate(checkProgressClock));
  for(const [width,height] of [[393,808],[808,393]]){
   await viewport(width,height);
   for(const artwork of [false,true]){
    const result=await evaluate(checkGlobalIcons,artwork);
    console.log('Rendered icons',width+'x'+height,artwork?'artwork':'mono',JSON.stringify(result));
   }
  }
  console.log('Mobile Chrome '+info.capabilities.browserVersion+' interaction checks passed.');
 }finally{
  try{if(session)await fetch(base+session,{method:'DELETE'});}finally{driver.kill();}
 }
}

// All fixtures stay in this browser process. No external provider is contacted.
function installFixture(){
 const tracks=['Zulu','Alpha','Middle'].map((title,i)=>({id:101+i,title,
  artist:{name:['Alpha band','Zulu band','Middle band'][i]},album:{id:'a12',title:'Album',image:{large:'https://static.qobuz.com/qa/missing.jpg'}},duration:180}));
 const session={streamConnected:true,streamValidation:'verified',profile:{displayName:'QA'},quality:6};
 const player={track:tracks[0],queue:tracks,index:0,duration:180000,position:54000,playing:false};
 const pending=new Map(),calls=[];
 window.fixture={player,calls,pending,errors:[],
  check(value,message){if(!value)throw Error(message);},
  async until(test){
   for(let i=0;i<100;i++){if(test())return;await new Promise(r=>setTimeout(r,30));}
   throw Error('Timed out waiting for '+String(test));
  },
  frame:()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
 };
 window.addEventListener('error',e=>{if(e.message)fixture.errors.push(e.message);});
 window.AurelNative={
  getAppVersion:()=>'1.2.3-preview',
  call(id,action,raw){
   const params=JSON.parse(raw);calls.push({action,params});
   const reply=data=>window.AurelReceive(id,{ok:true,data});
   if(action==='search'){pending.set(params.query,reply);return;}
   if(action==='playerState'&&window.AurelEvent){
    setTimeout(()=>window.AurelEvent('player',{...player,queueRevision:20}),0);
   }
   const album={id:'a12',title:'Test album',artist:{id:42,name:'Test artist'},tracks:{items:tracks}};
   const data={session,validateSession:session,album,playlist:{...album,id:'55',name:'Test playlist'},
    artist:{id:42,name:'Test artist',albums:{items:[album]},biography:'Short biography.'},discover:{albums:{items:[{id:'a12',title:'Album'}]}},
    favorites:{tracks:{items:tracks},albums:{items:[album]}},audioDiagnostics:{outputs:[]},lyrics:{status:'missing'}};
   setTimeout(()=>reply(data[action]||{}),0);
  },
  setPlayerImmersive(open){
   document.documentElement.style.setProperty('--aurel-native-status-inset','24px');
   document.documentElement.style.setProperty('--aurel-toast-safe-top',open?'24px':'0px');
  }
 };
}
async function checkLibraryAndSearch(){
 const {check,until,pending,player,calls}=fixture;
 await until(()=>window.AurelLanguage&&app.session?.streamConnected);
 AurelLanguage.set('uk');
 await navigate('settings');
 check(document.querySelector('[data-aurel-settings-panel="about"]').textContent.includes('1.2.3-preview'),'About must display the installed variant');
 check(document.querySelector('#aurel-updates-panel').textContent.includes('1.2.3-preview'),'Updates must display the installed variant');
 check(AurelErrorLog.report().includes('1.2.3-preview'),'Error reports must display the installed variant');
 check(document.querySelectorAll('[data-aurel-settings-group]').length===5,'Missing Ukrainian settings groups');
 document.querySelector('.aurel-settings-heading h1').click();
 check(!document.documentElement.hasAttribute('aria-pressed'),'Unrelated taps selected the page as a motion control');
 const motion=document.querySelector('button[data-aurel-motion="off"]');
 motion.click();
 check(document.documentElement.dataset.aurelMotion==='off'&&motion.getAttribute('aria-pressed')==='true','Motion switch did not update');
 document.querySelector('button[data-aurel-motion="soft"]').click();

 app.libType='tracks';
 await navigate('library');
 window.AurelEvent('player',player);
 for(const [sort,title] of [['alpha','Alpha'],['artist','Zulu']]){
  const select=document.querySelector('#libSort');
  select.value=sort;select.dispatchEvent(new Event('change',{bubbles:true}));
  const row=document.querySelector('#libraryContent .track-title');
  check(row?.textContent===title,'Unexpected first row for '+sort);
  document.querySelector('#libraryContent [data-play-next="0"]').click();
  check(calls.filter(c=>c.action==='queueAdd').at(-1)?.params.tracks[0].title===title,'Queued the wrong row for '+sort);
  document.querySelector('#libraryContent [data-play-index="0"]').click();
  await until(()=>app.overlay);
  const play=calls.filter(c=>c.action==='play').at(-1)?.params;
  check(play?.tracks[play.index].title===title,'Played the wrong row for '+sort);
  window.AurelMinimizePlayer();
 }
 await navigate('search');
 const field=document.querySelector('#searchInput');
 field.focus();field.value='Older';
 field.form.requestSubmit();
 await until(()=>pending.has('Older'));
 field.value='Latest';field.dispatchEvent(new Event('input',{bubbles:true}));
 await until(()=>pending.has('Latest'));
 pending.get('Latest')({tracks:{items:[{id:301,title:'Latest result'}]}});
 await until(()=>app.results[0]?.id===301);
 pending.get('Older')({tracks:{items:[{id:302,title:'Stale result'}]}});
 await fixture.frame();
 check(app.results[0]?.id===301&&document.querySelector('#searchResults').textContent.includes('Latest result'),'Stale search overwrote latest results');
 check(document.activeElement===field,'Completing a search replaced the focused input');
 field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));
 check(!app.results.length&&!app.searchQuery&&!app.searchBusy,'Clearing search retained old results');
 check(document.querySelector('#searchHistory [data-search-recent]'),'Clearing search did not restore recent searches');
 // Dismiss the queue confirmation before testing the controls underneath it.
 document.querySelector('#toast.aurel-toast-visible [data-dismiss-aurel-toast]')?.click();
 document.querySelector('#mini .mini-track-open').click();
 await until(()=>document.querySelector('#overlay #progress'));
}
async function checkGestures(){
 const {check,frame,player}=fixture;
 const slider=document.querySelector('#progress'),elapsed=document.querySelector('#elapsed');
 const pointer=(target,type,y=0)=>target.dispatchEvent(new PointerEvent(type,{
  pointerId:42,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientY:y
 }));
 pointer(slider,'pointerdown');pointer(slider,'pointerup');
 check(!app.dragging,'A stationary touch froze seek updates');
 pointer(slider,'pointerdown');slider.value='90000';slider.dispatchEvent(new Event('input',{bubbles:true}));
 window.AurelEvent('player',player);
 check(elapsed.textContent==='1:30','A playback tick overwrote the seek preview');
 pointer(slider,'pointercancel');
 check(Math.abs(parseFloat(document.querySelector('.aurel-seek-rail-fill').style.transform.slice(7))-.3)<.001,
  'Cancelled seek left the paused rail showing the preview');
 await fixture.until(()=>document.querySelector('.murglar-art-placeholder')&&document.querySelector('#mini .minicover.placeholder'));
 const cover=document.querySelector('.murglar-cover');
 check(cover.getBoundingClientRect().width>100,'Unavailable artwork collapsed the cover');
 document.querySelector('button[data-player-sheet="credits"]').click();
 const drawer=document.querySelector('.aurel-detail-drawer'),handle=drawer.querySelector('.aurel-drawer-handle');
 const height=()=>parseFloat(drawer.style.getPropertyValue('--aurel-drawer-size'));
 const rest=height();
 check(handle.tagName==='BUTTON'&&handle.getBoundingClientRect().height>=44,'Drawer handle is not a finger-sized button');
 check(drawer.getAnimations().length===1,'Drawer has competing entrance animations');
 pointer(handle,'pointerdown',380);pointer(handle,'pointermove',308);
 drawOverlay();pointer(handle,'pointerup',308);
 const expanded=height();await frame();
 check(expanded>rest+20&&height()===expanded&&handle.getAttribute('aria-expanded')==='true','Queued drag frame overwrote expanded height');
 pointer(handle,'pointerdown',200);pointer(handle,'pointermove',307);pointer(handle,'pointercancel',307);
 await frame();
 check(height()===expanded,'Cancelled drag changed the settled size');
 handle.click();check(height()===rest,'Accessible handle did not collapse drawer');
 drawer.querySelector('[data-close-detail]').click();
 check(document.querySelector('.murglar-cover')===cover,'Drawer remounted artwork');
}
async function checkReopen(){
 const {check,frame,player}=fixture;
 const close=document.querySelector('[data-close-overlay]');
 close.click();close.click();
 check(app.overlay,'Second tap interrupted the close animation');
 window.AurelBack();
 check(app.overlay,'Repeated Back interrupted the close animation');
 window.AurelMinimizePlayer();
 document.querySelector('#mini .mini-track-open').click();
 await new Promise(r=>setTimeout(r,430));
 check(app.overlay,'A previous dismiss timer closed a newly opened player');
 window.AurelEvent('player',{...player,repeat:2});
 await frame();
 check(document.querySelector('#full-repeat').getAttribute('aria-label')===AurelLanguage.translate('Repeat one'),
  'Changed repeat state lost its Ukrainian accessibility label');
}
async function checkLayout(){
 const {check,frame}=fixture;
 await frame();
 const box=s=>document.querySelector(s).getBoundingClientRect();
 const rail=box('.aurel-seek-rail'),input=box('#progress');
 const offset=Math.abs((rail.y+rail.height/2)-(input.y+input.height/2));
 check(rail.width>60&&rail.height>=3&&offset<=1,'Seek rail not centered under thumb: '+JSON.stringify({offset,rail,input}));
 const root=document.documentElement;
 const checkToast=()=>{
  const r=box('#toast');
  check(r.top>=24&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight,'Notification escaped the viewport');
  return getComputedStyle(document.querySelector('#toast')).backgroundColor;
 };
 window.AurelTheme.setArtworkPalette(false);
 showToast('Test notification '+innerWidth+' '+('Long text '.repeat(16)));
 await new Promise(r=>setTimeout(r,250));
 const mono=checkToast();
 window.AurelTheme.setArtworkPalette(true);
 root.style.setProperty('--aurel-theme-surface','#224466');
 root.style.setProperty('--aurel-theme-accent','#ddaa33');
 const tinted=checkToast();
 check(tinted!==mono,'Artwork palette did not reach notification');
 const dismiss=document.querySelector('[data-dismiss-aurel-toast]');dismiss.click();
 check(document.querySelector('#toast').classList.contains('hidden'),'Notification did not dismiss');
 check(!fixture.errors.length,fixture.errors.join('; '));
 return {width:innerWidth,height:innerHeight,railOffset:offset,railWidth:Math.round(rail.width)};
}
async function checkProgressClock(){
 const {check,until,player}=fixture;
 window.AurelMinimizePlayer();
 await navigate('library');
 const queue=Array.from({length:500},(_,index)=>({...player.track,id:index+1000}));
 const full={...player,queue,queueRevision:17,playing:true,position:12000};
 window.AurelEvent('player',full);
 const bar=document.querySelector('#mini .mini-progress'),fill=bar?.querySelector('.mini-progress-fill');
 check(fill&&bar.getAttribute('role')==='progressbar','The active mini renderer discarded its progress fill');
 const first=Number(fill.style.transform.match(/[\d.]+/)?.[0])||0;
 await until(()=>Number(fill.style.transform.match(/[\d.]+/)?.[0])>first+.0005);
 const {queue:ignored,...tick}=full;
 window.AurelEvent('player',{...tick,position:14000});
 check(app.player.queue===queue,'A native progress tick copied or lost a 500-track queue');
 const compactBytes=JSON.stringify(tick).length,fullBytes=JSON.stringify(full).length;
 check(compactBytes<fullBytes/50,'Progress messages still carry catalogue-size payloads');
 document.querySelector('#mini [data-open-mini-player]').click();
 await until(()=>document.querySelector('#overlay #progress'));
 const slider=document.querySelector('#progress'),start=Number(slider.value);
 await until(()=>Number(slider.value)>start+120);
 window.AurelEvent('player',{...player,queueRevision:18,queue:player.queue.slice().reverse()});
 document.querySelector('.murglar-quick-actions [data-player-sheet="upnext"]').click();
 await until(()=>document.querySelector('.queue-item .queue-text strong'));
 check(document.querySelector('.queue-item .queue-text strong').textContent===player.queue.at(-1).title,
       'A changed queue was not reflected in the drawer');
 window.AurelEvent('player',{...player,queueRevision:19,queue:[]});
 check(!document.querySelector('.queue-item'),'The last queue entry remained after removing it');
 window.AurelEvent('player',{...player,queueRevision:20});
 await until(()=>fixture.calls.some(c=>c.action==='playerState')&&app.player.queue?.length===player.queue.length);
 check(app.player.queue[0].id===player.track.id,'A missing full snapshot did not resynchronize the queue');
 window.AurelMinimizePlayer();
 return {tracks:queue.length,fullBytes,compactBytes};
}

async function checkGlobalIcons(artwork){
 const {check,until,frame,player}=fixture;
 window.AurelTheme.setArtworkPalette(artwork);
 window.AurelEvent('player',player);
 const screens={};
 async function scan(name,root,required){
  await frame();
  const scope=document.querySelector(root);
  check(scope,name+' root is missing');
  const vectors=[...scope.querySelectorAll('svg:not(.aurel-brand-svg)')].filter(svg=>svg.getClientRects().length&&getComputedStyle(svg).visibility==='visible');
  check(vectors.length,name+' has no rendered controls');
  for(const svg of vectors){
   const shape=svg.querySelector('path,circle,rect,ellipse');
   const css=getComputedStyle(svg),box=svg.getBoundingClientRect(),id=svg.dataset.icon||svg.className.baseVal;
   check(svg.matches('svg.ui-icon,svg.aurel-spinner'),name+' uses a detached icon family: '+id);
   check(css.width==='24px'&&css.height==='24px'&&Math.abs(box.width-24)<.6&&Math.abs(box.height-24)<.6,
     name+'/'+id+' rendered '+box.width+'×'+box.height+' (CSS '+css.width+'×'+css.height+')');
   check(shape&&getComputedStyle(shape).strokeWidth==='2.25px',name+'/'+id+' has a different outline');
  }
  for(const key of required||[])check(vectors.some(svg=>svg.dataset.icon===key),name+' did not render '+key);
  screens[name]=vectors.length;
 }
 await navigate('home');
 await scan('home','#screen',['settings','search','library']);
 await scan('navigation','.bottom-nav',['home','search','library','queue','settings']);
 await scan('mini','#mini',['prev','play','next']);
 await navigate('search');
 await scan('search','#screen',['search','arrow-right']);
 app.libType='tracks';await navigate('library');
 await scan('library tracks','#screen',['plus','play','heart']);
 app.libType='albums';await navigate('library');
 await scan('library layouts','#screen',['grid','list']);
 await openAlbum('a12');await scan('album','#screen',['back','play','heart']);
 await openPlaylist('55');await scan('playlist','#screen',['back','play']);
 await openArtist('42');await scan('artist','#screen',['info','play','plus']);
 document.querySelector('[data-artist-info-open]').click();
 await scan('artist biography','.aurel-artist-info-dialog',['close']);
 window.AurelArtistInfo.close();
 await navigate('settings');
 await scan('settings','#screen',['speaker','audio','user','palette','library','down']);
 renderLogin();await scan('sign-in','#screen',['user','key']);
 await navigate('search');
 showToast('Icon QA '+artwork,4000);
 await scan('notification','#toast',['close']);
 document.querySelector('[data-dismiss-aurel-toast]').click();
 document.querySelector('#mini [data-open-mini-player]').click();
 await scan('player','#overlay',['queue','info','lyrics','heart','share','shuffle','prev','play','next','repeat']);
 const actions=[...document.querySelectorAll('.murglar-quick-actions > button')];
 const extents=actions.map(button=>{
  const svg=button.querySelector('svg'),box=svg.getBBox(),target=button.getBoundingClientRect();
  check(target.width>=43.5&&target.height>=43.5,'Small touch target for '+svg.dataset.icon);
  check(Math.abs((box.x+box.width/2)-12)<1.5&&Math.abs((box.y+box.height/2)-12)<1.6,'Off-centre '+svg.dataset.icon);
  return Math.max(box.width,box.height);
 });
 check(Math.max(...extents)-Math.min(...extents)<2,'Mismatched drawn player glyphs: '+extents);
 document.querySelector('.murglar-quick-actions [data-player-sheet="upnext"]').click();
 await scan('queue','.aurel-detail-drawer',['close','arrow-up','arrow-down']);
 window.AurelMinimizePlayer();
 check(!fixture.errors.length,fixture.errors.join('; '));
 return screens;
}

run().catch(error=>{console.error(error);process.exitCode=1;});
