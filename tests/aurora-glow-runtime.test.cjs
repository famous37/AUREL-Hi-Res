'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('app/src/main/assets/aurel-aurora.js','utf8');
function classes(){
  const s=new Set();
  return {toggle:(key,v)=>{if(v)s.add(key);else s.delete(key);return !!v;},
    contains:key=>s.has(key),add:key=>s.add(key)};
}
function setup(saved=null){
 let hidden=false,reduced=false,halo=null,inserts=0,forward=0;
 const classList=classes(),styles=new Map(),events={},requests=[];
 const cover={className:'murglar-cover'};
 const art={querySelector:q=>q==='.murglar-cover'?cover:q==='.aurel-aurora-halo'?halo:null,
   insertBefore(node,sibling){assert.equal(sibling,cover);halo=node;inserts++;}};
 const overlay={classList,style:{setProperty:(k,v)=>styles.set(k,v)},
   querySelector:q=>q==='.murglar-view .murglar-art-wrap'?art:null};
 const root={querySelector:()=>null};
 const document={get hidden(){return hidden;},getElementById:id=>id==='overlay'?overlay:id==='screen'?root:null,
   documentElement:{dataset:{aurelMotion:'soft'}},
   addEventListener:(type,fn)=>events[type]=fn,
   createElement:tag=>({tagName:tag,className:'',setAttribute(){}})};
 const store=new Map(saved===null?[]:[['aurel_aurora_shadows_v1',saved]]);
 const track={image:'https://static.qobuz.com/images/covers/orange.jpg'};
 const app={overlay:true,player:{playing:true,buffering:false,error:null,track,bitPerfect:{enabled:true}}};
 const window={
   matchMedia:()=>({get matches(){return reduced;},addEventListener:(type,fn)=>events.motion=fn}),
   AurelBeatFrame:()=>{forward++;return 'fft';},
   AurelEvent:type=>'event:'+type,
   AurelCoverRhythm:{setAuraCaptureWanted:(v,ask)=>requests.push({v,ask})}
 };
 const context={window,document,app,Date,Number,Math,
   image:track=>track?.image||'',
   renderSettings:()=>{},drawOverlay:()=>{},
   localStorage:{getItem:key=>store.get(key)||null,setItem:(key,v)=>store.set(key,v)}};
 vm.runInNewContext(source,context);
 return {app,window,context,overlay,styles,classList,events,store,requests,
   inserts:()=>inserts,forward:()=>forward,
   setReduced:v=>{reduced=v},setHidden:v=>{hidden=v}};
}
const x=setup();
assert.equal(x.classList.contains('aurel-aurora-enabled'),true);
assert.equal(x.classList.contains('aurel-aurora-playing'),true);
assert.equal(x.classList.contains('aurel-aurora-beat-live'),false,
  'No FFT means NO fake beat animation');
assert.equal(x.styles.get('--aurel-aurora-opacity'),'0.340');
assert.equal(x.inserts(),1);
assert.deepEqual(x.requests[x.requests.length-1],{v:false,ask:false},
  'Bit-perfect must never request Visualizer audio capture');
x.context.drawOverlay();x.context.drawOverlay();
assert.equal(x.inserts(),1,'Repeated drawOverlay must not duplicate halo');
x.window.AurelBeatFrame(1);
assert.equal(x.forward(),1);
assert.equal(x.styles.get('--aurel-aurora-opacity'),'0.340',
  'Bit-perfect rejects fake FFT pulses and keeps a static glow');
const wrong='https://static.qobuz.com/images/covers/wrong.jpg';
x.window.AurelAuroraPalette(wrong,'#180B08','#392018','#FFCD99','#FF6700','#F5AA3B','#D83A12');
assert.notEqual(x.styles.get('--aurel-album-one'),'#FF6700','Stale track palette cannot override current album');
const current=x.app.player.track.image;
x.window.AurelAuroraPalette(current,'#180B08','#392018','#FFCD99','#FF6700','#F5AA3B','#D83A12');
assert.equal(x.styles.get('--aurel-album-bg'),'#180B08');
assert.equal(x.styles.get('--aurel-album-surface'),'#392018');
assert.equal(x.styles.get('--aurel-album-one'),'#FF6700');
assert.equal(x.styles.get('--aurel-album-two'),'#F5AA3B');
assert.equal(x.styles.get('--aurel-album-three'),'#D83A12');
x.app.player.bitPerfect.enabled=false;
x.window.AurelEvent('player',{});
assert.deepEqual(x.requests[x.requests.length-1],{v:true,ask:false},
  'Normal audio enables genuine FFT capture independently of cover-scale toggle');
x.window.AurelBeatFrame(.94);
assert.equal(x.forward(),2,'Original cover FFT callback must be preserved');
assert.ok(Number(x.styles.get('--aurel-aurora-opacity'))>.9,
  'Real bass onset brightens multicolor light');
assert.equal(x.classList.contains('aurel-aurora-beat-live'),true);
assert.equal(x.styles.get('--aurel-aurora-rotation'),'12deg',
  'Genuine bass transient, not clock, shifts album-color gradient');
x.window.AurelBeatFrame(.93);
assert.equal(x.styles.get('--aurel-aurora-rotation'),'12deg',
  'Constant bass envelope should not simulate new onsets');
x.window.AurelBeatFrame(0);
assert.equal(x.styles.get('--aurel-aurora-opacity'),'0.300',
  'Low-energy frames dim the halo');
x.app.player.playing=false;x.window.AurelEvent('player',{});
assert.equal(x.classList.contains('aurel-aurora-playing'),false);
assert.equal(x.classList.contains('aurel-aurora-beat-live'),false);
assert.equal(x.styles.get('--aurel-aurora-opacity'),'0.260');
assert.deepEqual(x.requests[x.requests.length-1],{v:false,ask:false});
x.app.player.playing=true;x.window.AurelEvent('player',{});
assert.equal(x.classList.contains('aurel-aurora-playing'),true);
x.setReduced(true);x.events.motion();
assert.deepEqual(x.requests[x.requests.length-1],{v:false,ask:false});
x.setReduced(false);x.events.motion();
x.events.change({target:{matches:q=>q==='[data-aurel-aurora-toggle]',checked:false}});
assert.equal(x.classList.contains('aurel-aurora-enabled'),false);
assert.equal(x.store.get('aurel_aurora_shadows_v1'),'off');
x.events.change({target:{matches:q=>q==='[data-aurel-aurora-toggle]',checked:true}});
assert.equal(x.classList.contains('aurel-aurora-enabled'),true);
x.app.player.track={image:'https://static.qobuz.com/images/covers/other.jpg'};
x.window.AurelEvent('player',{});
assert.notEqual(x.styles.get('--aurel-album-one'),'#FF6700',
 'Album switch cannot leak previous cover colors');
x.app.player.track={image:current};x.window.AurelEvent('player',{});
assert.equal(x.styles.get('--aurel-album-one'),'#FF6700','Cached album palette is restored');
x.app.overlay=false;x.context.drawOverlay();
assert.equal(x.classList.contains('aurel-aurora-playing'),false);
const off=setup('off');
assert.equal(off.classList.contains('aurel-aurora-enabled'),false);
assert.equal(off.inserts(),0);
console.log('Aurora runtime: real FFT onset, dim decay, exact album palette, stale callbacks, bit-perfect, pause and user preferences PASS');
