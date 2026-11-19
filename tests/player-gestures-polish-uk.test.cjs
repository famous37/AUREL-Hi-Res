'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=n=>fs.readFileSync('app/src/main/assets/'+n,'utf8');
const c=load('aurel-glass-polish.css'),js=load('aurel-track-swipe.js'),
aurora=load('aurel-aurora.js'),lang=load('aurel-language.js'),
html=load('index.html'),gradle=fs.readFileSync('app/build.gradle','utf8');
assert.match(gradle,/versionCode\s+104/);
assert.match(gradle,/versionName[^\n]*'1\.1\.87'/);
assert(html.indexOf('aurel-track-swipe.js')>html.indexOf('aurel-aurora.js'));
assert.match(c,/top:max\(56px,calc\(var\(--aurel-native-status-inset/);
assert.match(c,/padding-top:clamp\(10px,1\.8dvh,24px\)/);
assert.match(c,/#overlay:not\(\.hidden\)::before\{[\s\S]*?background:/);
assert.match(c,/radial-gradient\(ellipse 77% 61% at 19% 17%/);
assert.match(c,/--aurel-aurora-drift/);
assert.match(c,/background:color-mix\(in srgb,var\(--aurel-seam-bg/);
assert.match(c,/\.app:has\(#overlay\.aurel-swipe-tracking\)/);
assert.match(c,/#overlay\.aurel-swipe-tracking \.murglar-view/);
assert.match(c,/#overlay\.aurel-swipe-dismissing \.murglar-view/);
assert.match(c,/#overlay\.aurel-track-scrubbing \.murglar-art-wrap/);
assert.match(c,/@media\(prefers-reduced-motion:reduce\)/);
assert(!/@keyframes\s+(?:fakeBass|timedBass|musicBeat)/i.test(c));
assert.match(aurora,/--aurel-aurora-drift','0px'/);
assert.match(aurora,/--aurel-aurora-drift',Math\.round\(\(strong-\.45\)\*13\)\+'px'/);
assert.match(js,/const action=dx>0\?'next':'previous'/);
assert.match(js,/Math\.abs\(dx\)>=78/);
assert.match(js,/\.murglar-progress-row/);
assert.match(js,/!!app\.playerSheet/);
assert.match(js,/window\.AurelLanguage\.refresh\?\.\(overlay\)/);
assert.match(lang,/refresh:function\(root\)/);
assert.match(lang,/'Swipe right for next track':'Проведіть праворуч/);
assert.match(lang,/'Swipe left for previous track':'Проведіть ліворуч/);
for(const name of ['aurel-track-swipe.js','aurel-language.js','aurel-aurora.js'])
 assert.doesNotThrow(()=>new Function(load(name)),name+' invalid JavaScript');

function harness(){
 const events={},classes=new Set(),style=new Map(),commands=[];
 let tick=1000,playerSheet='',calls=0,draws=0;
 const timers=[];
 const art={animate(frames,options){calls++;return {frames,options};}};
 const overlay={
   classList:{contains:v=>classes.has(v),add:v=>classes.add(v),remove:(...a)=>a.forEach(v=>classes.delete(v))},
   style:{setProperty:(a,v)=>style.set(a,v),removeProperty:a=>style.delete(a)},
   addEventListener:(n,cb)=>events[n]=cb,
   querySelector:selector=>selector==='.murglar-art-wrap'?art:null
 };
 const app={overlay:true,player:{track:{id:'first'}},get playerSheet(){return playerSheet;},set playerSheet(v){playerSheet=v;}};
 const target=interactive=>({closest:selector=>interactive&&selector.includes('button')?{}:null});
 const root={dataset:{aurelMotion:'soft'}};
 const doc={getElementById:n=>n==='overlay'?overlay:null,documentElement:root};
 const ctx={document:doc,window:{matchMedia:()=>({matches:false}),AurelLanguage:{
    get:()=> 'uk',refresh:()=>{}}},
   app,performance:{now:()=>tick},nativeCall:command=>{
     commands.push(command);return Promise.resolve({});
   },drawOverlay:()=>{draws++;},requestAnimationFrame:cb=>cb(),
   setTimeout:cb=>{timers.push(cb);return timers.length;},Promise,console,
   showToast:()=>{}
 };
 vm.runInNewContext(js,ctx,{filename:'aurel-track-swipe.js'});
 const start=(x,y,blocked=false)=>events.touchstart({touches:[{clientX:x,clientY:y}],target:target(blocked)});
 const move=(x,y)=>{tick+=75;let prevented=false;events.touchmove({
   touches:[{clientX:x,clientY:y}],cancelable:true,preventDefault(){prevented=true;}});
   return prevented;};
 const end=(x,y)=>{tick+=60;events.touchend({changedTouches:[{clientX:x,clientY:y}]});};
 const flush=async()=>{for(let i=0;i<8;i++){const t=timers.splice(0);if(!t.length)break;t.forEach(f=>f());await Promise.resolve();await Promise.resolve();}};
 return {start,move,end,flush,commands,app,classes,style,
  tick:v=>tick+=v,setDrawer:v=>playerSheet=v,
  draws:()=>draws,animations:()=>calls};
}
(async()=>{
 let h=harness();h.start(140,240);assert(h.move(253,247));h.end(279,249);
 await h.flush();assert.deepEqual(h.commands,['next'],'right swipe must advance one track');
 assert(!h.classes.has('aurel-track-scrubbing'),'Gesture styles must clear');
 h=harness();h.start(260,260);assert(h.move(145,265));h.end(115,270);
 await h.flush();assert.deepEqual(h.commands,['previous'],'left swipe must go back one track');
 h=harness();h.start(200,220);h.move(237,229);h.end(249,229);
 await h.flush();assert.deepEqual(h.commands,[],'A small horizontal drag is not a track skip');
 h=harness();h.start(180,220,true);h.move(290,221);h.end(312,225);
 await h.flush();assert.deepEqual(h.commands,[],'Buttons, links, seek must not trigger swipes');
 h=harness();h.setDrawer('audio');h.start(180,220);h.move(290,221);h.end(312,225);
 await h.flush();assert.deepEqual(h.commands,[],'An open audio sheet must keep touch priority');
 h=harness();h.start(190,210);assert(!h.move(192,355));h.end(192,369);
 await h.flush();assert.deepEqual(h.commands,[],'Swipe down remains controlled by minimizer');
 h=harness();h.start(145,220);h.move(290,225);
 h.end(301,228);await h.flush();
 assert.equal(h.commands.length,1,'One gesture = one native track command');
 console.log('AUREL 1.1.87: safe horizontal and vertical gestures, position, soft glow and translations PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
