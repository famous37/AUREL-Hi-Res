'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync('app/src/main/assets/'+p,'utf8');
const rhythm=read('aurel-cover-rhythm.js');
const aura=read('aurel-aurora.js');
const theme=read('aurel-live-ui.js');
const css=read('aurel-universal-borderless.css');
const html=read('index.html');
const gradle=fs.readFileSync('app/build.gradle','utf8');
const native=fs.readFileSync('app/src/main/java/com/aurel/hires/MainActivity.java','utf8');
assert.match(gradle,/versionCode\s+94/);
assert.match(gradle,/versionName[^\n]*'1\.1\.75'/);
assert.match(html,/aurel-universal-borderless\.css/);
assert.match(css,/#overlay:not\(\.hidden\) \.murglar-view::before/);
assert.match(css,/#overlay\.aurel-aurora-enabled:not\(\.hidden\) \.murglar-view::before/);
assert.match(css,/--aurel-aurora-opacity/);
assert.match(css,/murglar-header\.aurel-listening-nav/);
assert.match(css,/background-color:transparent!important/);
assert.match(css,/pointer-events:none/);
assert.match(css,/aurel-settings-group-content>/);
assert.match(css,/aurel-pro-settings/);
assert.match(css,/searchbox/);
assert.match(css,/quality\.selected/);
assert.match(css,/data-aurel-palette="artwork"/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/orientation:landscape/);
assert.doesNotMatch(css,/@keyframes\s+.*beat|animation:\s*infinite/,
  'No synthetic music pulses or timed rainbow cycles');
assert.match(theme,/--aurel-theme-card/);
assert.match(theme,/--aurel-theme-raised/);
assert.match(theme,/--aurel-theme-border/);
assert.match(theme,/--aurel-theme-line/);
assert.match(theme,/--aurel-theme-secondary/);
assert.match(theme,/--aurel-theme-dark/);
assert.match(theme,/mixHex\(/);
assert.match(theme,/contrastInk\(/);
assert.match(aura,/data-aurel-aurora-status/);
assert.match(aura,/sync\(enabled\)/);
assert.match(rhythm,/auraPermissionAttempted/);
assert.match(rhythm,/auraRequested&&!auraPermissionAttempted/);
assert.match(native,/case "setBeatVisualization":/);
assert.match(native,/Manifest\.permission\.RECORD_AUDIO/);
assert.match(native,/!pureOutput/);
new Function(rhythm);new Function(aura);new Function(theme);
const fakeClasses=()=>{const set=new Set();return {
  toggle:(k,v)=>{if(v)set.add(k);else set.delete(k);},
  add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k)
}};
function setup(){
 const listeners={},calls=[];
 const overlay={classList:fakeClasses(),style:{setProperty(){}}};
 const app={overlay:true,player:{playing:true,buffering:false,error:null,bitPerfect:{enabled:false}}};
 const document={
  hidden:false,documentElement:{dataset:{aurelMotion:'soft'}},
  getElementById:id=>id==='overlay'?overlay:id==='screen'?{querySelector:()=>null}:null,
  querySelector:()=>null,
  addEventListener:(k,fn)=>listeners[k]=fn
 };
 const window={matchMedia:()=>({matches:false,addEventListener(){}}),AurelEvent:()=>{}};
 const context={document,window,app,renderSettings(){},drawOverlay(){},showToast(){},
   nativeCall:(name,args)=>{calls.push({name,args});return Promise.resolve({permissionGranted:false})},
   localStorage:{getItem:()=>null,setItem(){}},
   Promise,Math,Number,Date};
 vm.runInNewContext(rhythm,context,{filename:'aurel-cover-rhythm.js'});
 return {context,window,app,calls,listeners,overlay};
}
const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
(async()=>{
 const t=setup();
 await flush();
 assert(!t.calls.some(c=>c.args.requestPermission),
   'Playback with all visual options disabled must NOT prompt');
 t.window.AurelCoverRhythm.setAuraCaptureWanted(true,false);
 await flush();
 let ask=t.calls.filter(c=>c.name==='setBeatVisualization'&&c.args.requestPermission);
 assert.equal(ask.length,1,'Glow-only must request FFT permission exactly once');
 assert.equal(ask[0].args.enabled,true,'FFT is for current AUREL session');
 assert.equal(t.window.AurelCoverRhythm.enabled(),false,
   'Glow must not secretly turn on album artwork scaling');
 t.window.AurelEvent('player',{});
 t.window.AurelEvent('beatStatus',{state:'permission'});
 await flush();
 ask=t.calls.filter(c=>c.args.requestPermission);
 assert.equal(ask.length,1,'No repeat nag after permission denial/status updates');
 t.app.player.playing=false;
 t.window.AurelEvent('player',{});
 await flush();
 assert.equal(t.calls.at(-1).args.enabled,false,'Pause releases analyzer');
 t.app.player.playing=true;
 t.app.player.bitPerfect.enabled=true;
 t.window.AurelEvent('player',{});
 await flush();
 assert.equal(t.window.AurelCoverRhythm.isNativeCaptureRequested(),false,
   'USB bit-perfect never runs Android FFT analyzer');
 t.app.player.bitPerfect.enabled=false;
 t.window.AurelEvent('player',{});
 await flush();
 assert.equal(t.calls.filter(c=>c.args.requestPermission).length,1,
   'Automatic resume does not re-request denied permission');
 t.window.AurelCoverRhythm.setAuraCaptureWanted(false,false);
 t.window.AurelCoverRhythm.setAuraCaptureWanted(true,true);
 await flush();
 assert.equal(t.calls.filter(c=>c.args.requestPermission).length,2,
   'Explicit user glow toggle may retry a declined permission once');
 t.window.AurelEvent('beatPermission',{granted:true});
 t.window.AurelCoverRhythm.setAuraCaptureWanted(false,false);
 t.window.AurelCoverRhythm.setAuraCaptureWanted(true,true);
 await flush();
 assert.equal(t.calls.filter(c=>c.args.requestPermission).length,2,
   'Already granted Android permission must not be requested again');
 assert.equal(t.overlay.classList.contains('aurel-beat-ambient'),false,
   'No invented bass pulse');
 console.log('FFT permission only for own audio, once per opt-in, no pause/bit-perfect requests, global palette/header safety PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
