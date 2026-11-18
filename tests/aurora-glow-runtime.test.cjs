'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/aurel-aurora.js','utf8');
function classes(){
 const set=new Set();
 return {
   toggle(key,yes){if(yes)set.add(key);else set.delete(key);return !!yes;},
   contains:key=>set.has(key)
 };
}
function setup(saved=null){
 let hidden=false,reduced=false,halo=null,inserts=0,forward=0;
 const classList=classes(),styles=new Map(),events={};
 const cover={className:'murglar-cover'};
 const art={
  querySelector(q){
    if(q==='.murglar-cover')return cover;
    if(q==='.aurel-aurora-halo')return halo;
    return null;
  },
  insertBefore(node,sibling){assert.equal(sibling,cover);halo=node;inserts++;}
 };
 const overlay={classList,style:{setProperty:(k,v)=>styles.set(k,v)},
  querySelector(q){return q==='.murglar-view .murglar-art-wrap'?art:null;}};
 const root={querySelector:()=>null};
 const document={get hidden(){return hidden;},getElementById:id=>id==='overlay'?overlay:id==='screen'?root:null,
  documentElement:{dataset:{aurelMotion:'soft'}},
  addEventListener:(kind,handler)=>{events[kind]=handler;},
  createElement:tag=>({tagName:tag,className:'',setAttribute(){}})};
 const store=new Map(saved===null?[]:[['aurel_aurora_shadows_v1',saved]]);
 const app={overlay:true,player:{playing:true,buffering:false,error:null,bitPerfect:{enabled:true}}};
 const win={
  matchMedia:()=>({get matches(){return reduced;},addEventListener:(kind,handler)=>events.motion=handler}),
  AurelBeatFrame:()=>{forward++;return 'beat';},
  AurelEvent:(kind,data)=>'handled:'+kind
 };
 const context={window:win,document,app,Date,Number,Math,
   renderSettings:()=>{},drawOverlay:()=>{},
   localStorage:{getItem:key=>store.get(key)||null,setItem:(key,v)=>store.set(key,v)}};
 vm.runInNewContext(source,context);
 return {app,win,context,overlay,styles,classList,events,store,
   inserts:()=>inserts,forward:()=>forward,
   setReduced(v){reduced=v},setHidden(v){hidden=v}};
}
const x=setup();
assert.equal(x.classList.contains('aurel-aurora-enabled'),true,'Aurora enabled by default');
assert.equal(x.classList.contains('aurel-aurora-playing'),true,'Ambient shimmer on when playing, even with bit-perfect');
assert.equal(x.inserts(),1,'Glow inserted once');
x.context.drawOverlay();x.context.drawOverlay();
assert.equal(x.inserts(),1,'No repeated decorative DOM insertions on same player');
x.win.AurelBeatFrame(1);
assert.equal(x.forward(),1,'Do not override native beat listener');
assert.equal(x.styles.get('--aurel-aurora-opacity'),'0.82','In bit-perfect do not claim FFT analysis');
x.app.player.bitPerfect.enabled=false;
x.win.AurelBeatFrame(.88);
assert.ok(Number(x.styles.get('--aurel-aurora-opacity'))>.9,'Genuine FFT can brighten the decorative halo');
x.app.player.playing=false;
x.win.AurelEvent('player',{});
assert.equal(x.classList.contains('aurel-aurora-playing'),false,'Pause stops drifting colored light');
assert.equal(x.styles.get('--aurel-aurora-opacity'),'0.43','Paused glow remains softly dimmed');
x.app.player.playing=true;
x.win.AurelEvent('player',{});
assert.equal(x.classList.contains('aurel-aurora-playing'),true);
x.setReduced(true);x.events.motion();
assert.equal(x.classList.contains('aurel-aurora-playing'),false,'Respect system reduced-motion setting');
x.setReduced(false);x.context.document.documentElement.dataset.aurelMotion='off';x.events.motion();
assert.equal(x.classList.contains('aurel-aurora-playing'),false,'Respect in-app animation-off preference');
x.context.document.documentElement.dataset.aurelMotion='soft';x.events.motion();
x.events.change({target:{matches:q=>q==='[data-aurel-aurora-toggle]',checked:false}});
assert.equal(x.classList.contains('aurel-aurora-enabled'),false,'Manual toggle hides all decorative glow');
assert.equal(x.store.get('aurel_aurora_shadows_v1'),'off','Toggle persists');
x.events.change({target:{matches:q=>q==='[data-aurel-aurora-toggle]',checked:true}});
assert.equal(x.classList.contains('aurel-aurora-playing'),true,'Re-enable without music reload');
assert.equal(x.styles.get('--aurel-aurora-opacity'),'0.82','Re-enabled glow must be immediately visible');
x.app.overlay=false;x.context.drawOverlay();
assert.equal(x.classList.contains('aurel-aurora-playing'),false,'Closing player disables compositor animation');
assert.equal(x.classList.contains('aurel-aurora-enabled'),false);
const off=setup('off');
assert.equal(off.classList.contains('aurel-aurora-enabled'),false,'Previously disabled effect stays disabled after restart');
assert.equal(off.inserts(),0);
console.log('Iridescent halo runtime: bit-perfect, optional FFT brightness, pause, reduced motion, persistence, fullscreen close PASS');
