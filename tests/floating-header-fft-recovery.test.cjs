'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const load=p=>fs.readFileSync('app/src/main/assets/'+p,'utf8');
const css=load('aurel-seamless-theme.css'),glass=load('aurel-glass-polish.css'),aurora=load('aurel-aurora.js'),
 rhythm=load('aurel-cover-rhythm.js'),java=fs.readFileSync(
  'app/src/main/java/com/aurel/hires/AurelBeatMonitor.java','utf8'),
 activity=fs.readFileSync('app/src/main/java/com/aurel/hires/MainActivity.java','utf8'),
 gradle=fs.readFileSync('app/build.gradle','utf8');

assert.match(gradle,/versionCode\s+103/);
assert.match(gradle,/versionName[^\n]*'1\.1\.86'/);
assert.match(css,/@media\s*\(orientation:portrait\)[\s\S]*?\.murglar-header\.aurel-listening-nav\{[\s\S]*?position:absolute!important/);
assert.match(css,/pointer-events:none!important;[\s\S]*?\.murglar-header-button/);
assert.match(css,/pointer-events:auto!important/);
assert.match(css,/\.murglar-player-content\{[\s\S]*?padding-top:clamp\(18px,3\.2dvh,40px\)!important/);
assert.match(css,/background-image:none!important/);
assert.doesNotMatch(css,/inset:0 0 auto 0!important/,'A higher-specificity zero-inset header must never overlap Android icons');
assert.match(glass,/\.murglar-view::before[\s\S]*?content:none!important/,'Previous 75dvh canvas must be disabled');
assert.match(glass,/#overlay:not\(\.hidden\)::before[\s\S]*?radial-gradient/,'Full-screen FFT canvas must paint across the navbar seam');
assert.match(css,/transform:scale\(var\(--aurel-reactive-scale,1\)\)/);
assert.doesNotMatch(css,/@keyframes\s+(?:beat|bass)/);
assert.match(aurora,/--aurel-reactive-scale','1'/);
assert.match(aurora,/0\.99\+strong\*\.055/);
assert.match(aurora,/level>\.10&&level>lastPeak\+\.045/);
assert.match(java,/MAX_RECOVERIES=2/);
assert.match(java,/silent_fft_rebind/);
assert.match(java,/stale_fft_rebind/);
assert.match(java,/recoveryAttempts/);
assert.match(activity,/resetAnalyzer=p\.optBoolean\("restartAnalyzer",false\)/);
assert.match(activity,/beatMonitor\.stop\(\)/);
assert.match(activity,/result\.put\("appVersion",BuildConfig\.VERSION_NAME\)/);
assert.match(rhythm,/data-aurel-retry-fft/);
assert.match(rhythm,/nativeCall\('beatDiagnostics'/);
assert.match(rhythm,/restartAnalyzer:!!restart/);
new Function(aurora);new Function(rhythm);

// True FFT pulses must change shared canvas brightness and transform.
// Crucially, elapsed time alone must never do so.
const s=new Map(),classes=new Set(),requests=[];
const cover={};let halo;
const art={querySelector:q=>q==='.murglar-cover'?cover:q==='.aurel-aurora-halo'?halo:null,
 insertBefore(el){halo=el;}};
const overlay={style:{setProperty:(k,v)=>s.set(k,v)},
 classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k),add:k=>classes.add(k)},
 querySelector:q=>q==='.murglar-view .murglar-art-wrap'?art:null};
const document={hidden:false,documentElement:{dataset:{aurelMotion:'soft'}},
 getElementById:k=>k==='overlay'?overlay:{querySelector:()=>null},
 querySelector:()=>null,addEventListener(){},
 createElement:t=>({className:'',setAttribute(){}})};
const app={overlay:true,player:{playing:true,buffering:false,error:null,
 track:{image:'https://static.qobuz.com/a.jpg'},bitPerfect:{enabled:false}}};
const context={app,document,window:{
 matchMedia:()=>({matches:false,addEventListener(){}}),
 AurelEvent:()=>{},AurelBeatFrame:()=>{},
 AurelCoverRhythm:{setAuraCaptureWanted:(enabled,ask)=>requests.push([enabled,ask])}
 },image:o=>o.image,localStorage:{getItem:()=>null,setItem(){}},
 renderSettings(){},drawOverlay(){},Math,Number,Date};
vm.runInNewContext(aurora,context);
assert.equal(s.get('--aurel-reactive-scale'),'1','No fake music animation before FFT');
context.window.AurelBeatFrame(.9);
assert(Number(s.get('--aurel-reactive-scale'))>1.03,'Real FFT moves full artwork canvas');
assert(classes.has('aurel-aurora-beat-live'),'Native audio frame marks active live state');
context.window.AurelBeatFrame(0);
assert(Number(s.get('--aurel-reactive-scale'))<1,'Actual silence reduces scale');
app.player.playing=false;context.window.AurelEvent('player',{});
assert.equal(s.get('--aurel-reactive-scale'),'1','Pause restores static canvas');
assert.equal(requests.at(-1)?.[0],false,'Pause releases native audio analyzer');
console.log('AUREL 1.1.86 floating header, continuous canvas, native FFT watchdog, true-frame scale and explicit diagnostics PASS');
