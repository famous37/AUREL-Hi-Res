'use strict';
/* Reproduce the user-visible shrinking cover after repeat minimize/reopen.
 * Chrome resolves margin-bottom:auto to a USED pixel size in a flexbox.
 * The value is free slack, not fixed height required by playback controls. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/aurel-player-fit.js','utf8');
const css=fs.readFileSync('app/src/main/assets/aurel-gesture-safe.css','utf8');
assert(src.includes("element.classList?.contains('murglar-source-line')"),
  'fit must identify the album-quality line as an elastic flex spacer');
assert(src.includes('(elasticEnd?0:number(s.marginBottom))'),
  'resolved auto margin must never subtract from available artwork space');
assert(src.includes("root.style.getPropertyValue('--aurel-native-status-inset')"),
  'native status insets must trigger a new fit once Android becomes immersive');
assert(src.includes("root.style.getPropertyValue('--aurel-native-navigation-inset')"),
  'native gesture inset must trigger a new fit');
assert(css.includes('margin-bottom:auto!important'),
  'retain the visual vertical breathing room; fix the measurement instead');
assert(src.includes('if(after&&(after!==before||after!==observed))schedule()'),
  'reuse existing DOM and avoid remesurements on each progress tick');

const pending=[];
let current=null, nativeCallback=null, navSize=64, nextHeight=820;
const makeStyle=()=>{const attrs=new Map();return{
  setProperty:(key,val)=>attrs.set(key,String(val)),
  getPropertyValue:key=>attrs.get(key)||'',
  removeProperty:key=>attrs.delete(key)
}};
const root={style:makeStyle()};
const navbar={getBoundingClientRect:()=>({height:navSize})};
const overlay={style:makeStyle()};
const source={kind:'source',classList:{contains:name=>name==='murglar-source-line'},
 getBoundingClientRect:()=>({height:42})};
const makeItem=(kind,height)=>({
  kind, classList:{contains:()=>false},
  getBoundingClientRect:()=>({height})
});
function newView(height=820){
  const style=makeStyle(), classes=new Set();
  const art=makeItem('art',0);
  const content={
    clientHeight:height,clientWidth:420,children:[art,
      makeItem('track',104),makeItem('actions',57),
      makeItem('progress',40),makeItem('transport',93),
      source,makeItem('state',0)],
    querySelector:name=>name==='.murglar-art-wrap'?art:null
  };
  const view={
    style,
    classList:{
      toggle:(name,on)=>{if(on)classes.add(name);else classes.delete(name)},
      remove:name=>classes.delete(name),
      contains:name=>classes.has(name)
    },
    querySelector:name=>name==='.murglar-player-content'?content:null
  };
  return{view,content};
}
const dom={
  documentElement:root,
  getElementById:()=>overlay,
  querySelector:sel=>{
    if(sel==='.app .bottom-nav')return navbar;
    if(sel==='#overlay:not(.hidden) .murglar-view')return current?.view||null;
    return null;
  },
  addEventListener:()=>{}
};
const context={
  document:dom,
  window:{
    innerWidth:420,innerHeight:930,
    matchMedia:()=>({matches:false}),
    addEventListener:()=>{},
    visualViewport:{addEventListener:()=>{}}
  },
  drawOverlay(){ current=newView(nextHeight); },
  requestAnimationFrame(callback){pending.push(callback);return pending.length;},
  getComputedStyle(element){
    if(element===current?.content)return{
      paddingTop:'128px',paddingBottom:'9px',paddingLeft:'16px',
      paddingRight:'16px',rowGap:'3px',gap:'3px'
    };
    if(element===source){
      // More flex slack appears as the cover gets smaller. Previously
      // adding this used margin to reserved height shrank the cover again.
      const cover=Number.parseFloat(current.view.style.getPropertyValue('--aurel-fit-art'))||340;
      return{display:'block',position:'static',marginTop:'12px',
        marginBottom:Math.max(0,360-cover)+'px'};
    }
    return{display:element.kind==='state'?'none':'block',
      position:'static',marginTop:'0px',marginBottom:'0px'};
  },
  ResizeObserver:class{
    observe(){} disconnect(){}
  },
  MutationObserver:class{
    constructor(fn){nativeCallback=fn}
    observe(){} disconnect(){}
  }
};
vm.runInNewContext(src,context);
function flush(){
  let rounds=0;
  while(pending.length&&rounds++<50)pending.shift()();
  assert(rounds<50,'layout resize loop must converge');
}
context.drawOverlay();flush();
const baseline=Number.parseFloat(current.view.style.getPropertyValue('--aurel-fit-art'));
const baselineScrollable=current.view.classList.contains('aurel-fit-scroll');
assert(baseline>200,'test must begin with a realistic full-size cover');
for(let i=0;i<12;i++){
  context.drawOverlay();flush();
  const actual=Number.parseFloat(current.view.style.getPropertyValue('--aurel-fit-art'));
  assert.equal(actual,baseline,
    'opening '+(i+1)+' must not progressively shrink artwork');
  assert.equal(current.view.classList.contains('aurel-fit-scroll'),baselineScrollable,
    'opening sheets cannot change scroll mode or resize cover');
}
root.style.setProperty('--aurel-native-status-inset','24px');
nativeCallback();flush();
assert.equal(Number.parseFloat(current.view.style.getPropertyValue('--aurel-fit-art')),baseline);
root.style.setProperty('--aurel-native-navigation-inset','24px');
nativeCallback();flush();
assert.equal(Number.parseFloat(current.view.style.getPropertyValue('--aurel-fit-art')),baseline);

nextHeight=385;
context.drawOverlay();flush();
const compact=Number.parseFloat(current.view.style.getPropertyValue('--aurel-fit-art'));
assert(compact<=baseline,'short viewport must still reduce cover to protect controls');
assert(current.view.classList.contains('aurel-fit-scroll'),
  'short portrait retains scroll fallback to expose all transport controls');
console.log('AUREL 1.1.79 12 reopen cycles: stable cover, native inset refit, and compact scroll PASS');
