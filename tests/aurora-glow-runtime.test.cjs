'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/aurel-aurora.js','utf8');
function classes(){
 const set=new Set();
 return {
   toggle(k,on){if(on)set.add(k);else set.delete(k);return !!on},
   contains:k=>set.has(k),remove:k=>set.delete(k),add:k=>set.add(k)
 };
}
function setup(saved=null){
 let hidden=false,reduced=false,halo=null,inserts=0,forward=0,paletteForward=0,refreshCalls=0;
 const classList=classes(),styles=new Map(),events={};
 const cover={className:'murglar-cover'};
 const art={
  querySelector(q){return q==='.murglar-cover'?cover:q==='.aurel-aurora-halo'?halo:null},
  insertBefore(node,sibling){assert.equal(sibling,cover);halo=node;inserts++;}
 };
 const overlay={classList,style:{setProperty:(k,v)=>styles.set(k,v)},
  querySelector:q=>q==='.murglar-view .murglar-art-wrap'?art:null};
 const root={querySelector:()=>null};
 const document={get hidden(){return hidden;},
  getElementById:id=>id==='overlay'?overlay:id==='screen'?root:null,
  documentElement:{dataset:{aurelMotion:'soft'}},
  addEventListener:(kind,handler)=>{events[kind]=handler;},
  createElement:tag=>({tagName:tag,className:'',setAttribute(){}})};
 const store=new Map(saved===null?[]:[['aurel_aurora_shadows_v1',saved]]);
 const track={image:{large:'https://static.qobuz.com/large.jpg',
                     extralarge:'https://static.qobuz.com/extralarge.jpg'}};
 const app={overlay:true,player:{track,playing:true,buffering:false,error:null,
                                bitPerfect:{enabled:false}}};
 const win={
  matchMedia:()=>({get matches(){return reduced;},
                   addEventListener:(kind,handler)=>events.motion=handler}),
  AurelBeatFrame:()=>{forward++;return 'beat';},
  AurelCoverPalette:()=>{paletteForward++;return 'palette';},
  AurelEvent:kind=>'handled:'+kind,
  AurelCoverRhythm:{refresh:()=>{refreshCalls++;}}
 };
 const context={window:win,document,app,Date,Number,Math,Object,
   image:t=>t?.image?.large||'',
   renderSettings:()=>{},drawOverlay:()=>{},
   localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};
 vm.runInNewContext(source,context,{filename:'aurel-aurora.js'});
 return {app,win,context,overlay,styles,classList,events,store,
  inserts:()=>inserts,forward:()=>forward,paletteForward:()=>paletteForward,
  refreshCalls:()=>refreshCalls,
  setReduced:v=>{reduced=v},setHidden:v=>{hidden=v}};
}
const x=setup();
assert.equal(x.classList.contains('aurel-aurora-enabled'),true,'Cover glow defaults on');
assert.equal(x.classList.contains('aurel-aurora-playing'),true,'Active player appearance');
assert.equal(x.classList.contains('aurel-aurora-beat'),false,'No FFT means no fake pulse');
assert.equal(x.styles.get('--aurel-aurora-pulse-opacity'),'.30');
assert.equal(x.inserts(),1);
x.context.drawOverlay();x.context.drawOverlay();
assert.equal(x.inserts(),1,'No duplicate halo on repeated redraw');
x.win.AurelCoverPalette('https://static.qobuz.com/extralarge.jpg','#171113','#33241F','#DEA16F');
assert.equal(x.paletteForward(),1,'Do not swallow existing native album-theme callbacks');
assert.match(x.styles.get('--aurel-aurora-primary'),/^hsl\(/,'Album accent drives glow');
const warm=x.styles.get('--aurel-aurora-primary');
x.win.AurelCoverPalette('https://static.qobuz.com/another.jpg','#131313','#282828','#366FC9');
assert.equal(x.styles.get('--aurel-aurora-primary'),warm,
 'Ignore late or unrelated album palette callbacks');
x.win.AurelBeatFrame(.92);
assert.equal(x.forward(),1,'Forward every genuine beat to legacy cover handler');
assert.equal(x.classList.contains('aurel-aurora-beat'),true);
assert.ok(Number(x.styles.get('--aurel-aurora-pulse-opacity'))>.83);
assert.ok(Number(x.styles.get('--aurel-aurora-pulse-scale'))>1.06);
assert.ok(Number(x.styles.get('--aurel-aurora-button-opacity'))>.80);
x.win.AurelBeatFrame(0);
assert.equal(x.styles.get('--aurel-aurora-pulse-opacity'),'0.300','Real silence calms the halo');
x.app.player.bitPerfect.enabled=true;
x.win.AurelEvent('player',{});
assert.equal(x.classList.contains('aurel-aurora-beat'),false,
 'Bit-perfect never claims decoded-PCM FFT capture');
x.win.AurelBeatFrame(1);
assert.equal(x.styles.get('--aurel-aurora-pulse-opacity'),'.30');
x.app.player.bitPerfect.enabled=false;
x.app.player.playing=false;
x.win.AurelEvent('player',{});
assert.equal(x.classList.contains('aurel-aurora-playing'),false);
assert.equal(x.styles.get('--aurel-aurora-button-opacity'),'.24');
x.app.player.playing=true;
x.win.AurelEvent('player',{});
x.setReduced(true);x.events.motion();
x.win.AurelBeatFrame(1);
assert.equal(x.classList.contains('aurel-aurora-beat'),false,
 'Android reduced-motion blocks beat movement');
x.setReduced(false);
x.context.document.documentElement.dataset.aurelMotion='off';x.events.motion();
x.win.AurelBeatFrame(1);
assert.equal(x.classList.contains('aurel-aurora-beat'),false);
x.context.document.documentElement.dataset.aurelMotion='soft';x.events.motion();
x.events.change({target:{matches:q=>q==='[data-aurel-aurora-toggle]',checked:false}});
assert.equal(x.classList.contains('aurel-aurora-enabled'),false);
assert.equal(x.store.get('aurel_aurora_shadows_v1'),'off');
x.events.change({target:{matches:q=>q==='[data-aurel-aurora-toggle]',checked:true}});
assert.equal(x.classList.contains('aurel-aurora-enabled'),true);
assert.ok(x.refreshCalls()>=3,'Enabling glow refreshes shared FFT subscription');
x.app.player.track.image.large='https://static.qobuz.com/new-large.jpg';
x.context.drawOverlay();
assert.equal(x.styles.get('--aurel-aurora-primary'),'#82736c',
 'Changing albums clears previous colors while native artwork is loading');
x.app.overlay=false;x.context.drawOverlay();
assert.equal(x.classList.contains('aurel-aurora-enabled'),false);
const off=setup('off');
assert.equal(off.classList.contains('aurel-aurora-enabled'),false);
assert.equal(off.inserts(),0);
console.log('Artwork palette, live FFT impulse, silence, pause, bit-perfect, motion preferences and persistence PASS');
