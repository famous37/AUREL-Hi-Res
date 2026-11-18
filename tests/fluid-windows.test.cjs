'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('app/src/main/assets/aurel-fluid-transitions.js','utf8');
const motion=fs.readFileSync('app/src/main/assets/aurel-motion.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert.ok(html.includes('aurel-fluid-transitions.js'));
assert.ok(html.indexOf('aurel-fluid-transitions.js')>html.indexOf('aurel-cover-rhythm.js'));
assert.ok(!/transition\\s*:\\s*all/.test(code));
assert.ok(!/width:|height:|padding:|margin:/.test(code));
assert.ok(motion.includes('duration:215'));
let playing=false,reduced=false,dismissed=0,backCalls=0,frames=[],sheet='';
const view={animate:(f,o)=>{frames.push({kind:'view',f,o});return {cancel(){}};}};
const drawer={animate:(f,o)=>{frames.push({kind:'drawer',f,o});return {cancel(){}};}};
const dimmer={animate:(f,o)=>{frames.push({kind:'dimmer',f,o});return {cancel(){}};}};
const overlay={
 classList:{contains:x=>x==='hidden'?!playing:false},
 querySelector(x){
   if(x==='.murglar-view')return playing?view:null;
   if(x==='.aurel-detail-drawer')return playing&&sheet?drawer:null;
   if(x==='.aurel-detail-dimmer')return playing&&sheet?dimmer:null;
   return null;
 }
};
const app={overlay:false,playerSheet:''};
const win={matchMedia:()=>({get matches(){return reduced;}}),AurelSwipeMinimize:{minimize:()=>{dismissed++;}},
  AurelBack:()=>{backCalls++;},AurelHistoryBack:()=>{backCalls++;}};
const context={app,window:win,document:{hidden:false,documentElement:{dataset:{aurelMotion:'soft'}},getElementById:()=>overlay},
 drawOverlay(){playing=app.overlay;sheet=app.playerSheet;}};
vm.runInNewContext(code,context);
app.overlay=true;context.drawOverlay();
assert.equal(frames.length,1,'First player opening animates exactly once');
assert.equal(frames[0].o.duration,220);
context.drawOverlay();context.drawOverlay();
assert.equal(frames.length,1,'Playback rerenders never restart entrance');
app.playerSheet='audio';context.drawOverlay();
assert.equal(frames.length,3,'Drawer and dimmer animate on opening');
context.drawOverlay();
assert.equal(frames.length,3,'Same drawer not reanimated on data refresh');
assert(frames[0].f[0].opacity>=.95,'Entrance must never flash mostly transparent');
assert(frames[1].f[0].opacity>=.95,'Detail window begins nearly opaque');
app.playerSheet='';win.AurelBack();
assert.equal(dismissed,1,'Android back uses existing swipe dismissal');
assert.equal(backCalls,0);
reduced=true;win.AurelHistoryBack();
assert.equal(backCalls,1,'Reduced motion delegates to original back action');
app.overlay=false;context.drawOverlay();
assert.equal(frames.length,3);
console.log('Fluid windows: open once, stable rerenders, sheet reveal, back and reduced-motion PASS');
