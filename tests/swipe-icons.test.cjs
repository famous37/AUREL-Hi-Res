'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'../app/src/main/assets/');
const html=fs.readFileSync(base+'index.html','utf8');
const css=fs.readFileSync(base+'aurel-icon-contrast.css','utf8');
const js=fs.readFileSync(base+'aurel-swipe-minimize.js','utf8');
const original=fs.readFileSync(base+'murglar.js','utf8');
const history=fs.readFileSync(base+'aurel-continuity.js','utf8');

// Vector rendering on every density; no raster assets or changes to source art.
assert(html.includes('aurel-icon-contrast.css'));
assert(html.includes('aurel-swipe-minimize.js'));
assert(html.indexOf('aurel-icon-contrast.css')>html.indexOf('aurel-bit-perfect.css'));
assert(html.indexOf('aurel-swipe-minimize.js')>html.indexOf('aurel-motion.js'));
assert(css.includes('--aurel-icon-stroke:2.35'));
assert(css.includes('stroke-width:2.35!important'));
assert(css.includes('stroke-width:2.4!important'));
assert(css.includes('.aurel-tab-icon svg'));
assert(css.includes('shape-rendering:geometricPrecision'));
assert(!/\.png|base64|image-set\(/.test(css));
assert(original.includes('data-close-overlay'));
assert(history.includes('window.AurelHistoryBack='));
assert(history.includes('rememberPlayer();app.overlay=false;app.playerSheet='));

// Deliberately test gesture behavior rather than merely inspecting strings.
function harness(){
 const events=new Map();
 const style=new Map();
 const classes=new Set();
 let now=0,scrollTop=0,draws=0,backCalls=0,prevents=0,flushed=0;
 let playerSheet='';
 const app={overlay:true,nav:'library',selectedKind:'playlist',
   selected:{id:'playlist-42'},playerSheet:'',player:{playing:true}};
 const view={querySelector(sel){return sel==='.murglar-player-content'?scroller:null;}};
 const scroller={get scrollTop(){return scrollTop;},set scrollTop(v){scrollTop=v;}};
 const overlay={
  dataset:{},contains(){return true;},
  querySelector(sel){return sel==='.murglar-view'&&app.overlay?view:null;},
  classList:{add(...names){names.forEach(n=>classes.add(n));},
    remove(...names){names.forEach(n=>classes.delete(n));},
    contains(n){return classes.has(n);}},
  style:{setProperty(n,v){style.set(n,v);},removeProperty(n){style.delete(n);}},
  addEventListener(name,fn){events.set(name,fn);}
 };
 const target=(blocked=false,header=false)=>({
  nodeType:1,closest(s){
    if(s.includes('murglar-quick-actions')&&blocked)return {};
    if(s==='.murglar-header'&&header)return {};
    return null;
  }
 });
 const doc={
  getElementById(id){return id==='overlay'?overlay:null;},
  addEventListener(name,fn){events.set(name,fn);}
 };
 const context={document:doc,app,window:{AurelHistoryBack(){
   backCalls++;app.overlay=false;app.playerSheet='';draws++;
  }},drawOverlay(){draws++;},performance:{now(){return now;}},
  requestAnimationFrame(fn){fn();return ++flushed;},
  cancelAnimationFrame(){},
  setTimeout(){return 1;},clearTimeout(){},console};
 vm.runInNewContext(js,context,{filename:'aurel-swipe-minimize.js'});
 function start(x,y,opts={}){
  events.get('touchstart')({target:target(!!opts.blocked,!!opts.header),
    touches:[{clientX:x,clientY:y}]});
 }
 function move(x,y){
  now+=60;
  events.get('touchmove')({touches:[{clientX:x,clientY:y}],cancelable:true,
    preventDefault(){prevents++;}});
 }
 function end(x,y){
  now+=60;
  events.get('touchend')({changedTouches:[{clientX:x,clientY:y}]});
 }
 return {app,overlay,style,classes,start,move,end,
  scroll(n){scrollTop=n;},time(ms){now+=ms;},
  backCalls(){return backCalls;},draws(){return draws;},prevents(){return prevents;}};
}
{
 const h=harness();
 h.start(160,210);h.move(158,260);h.move(159,360);h.end(159,360);
 assert.equal(h.backCalls(),1,'downward swipe should minimize');
 assert.equal(h.app.overlay,false);
 assert.equal(h.app.nav,'library','should not jump to Discover');
 assert.equal(h.app.selectedKind,'playlist');
 assert.equal(h.app.selected.id,'playlist-42','must retain exact playlist');
 assert.equal(h.app.player.playing,true,'must not pause native playback');
 assert(h.prevents()>0,'recognized swipe should suppress browser overscroll');
}
{
 const h=harness();
 h.start(160,210);h.move(270,224);h.end(270,224);
 assert.equal(h.backCalls(),0,'horizontal swipe must not navigate');
}
{
 const h=harness();
 h.start(160,210);h.move(160,120);h.end(160,120);
 assert.equal(h.backCalls(),0,'upward scrolling should remain intact');
}
{
 const h=harness();h.scroll(90);
 h.start(160,210);h.move(160,350);h.end(160,350);
 assert.equal(h.backCalls(),0,'scrolling content above zero must not minimize');
}
{
 const h=harness();h.start(160,210,{blocked:true});
 h.move(160,370);h.end(160,370);
 assert.equal(h.backCalls(),0,'seeking or playback controls must not trigger swipe');
}
{
 const h=harness();h.app.playerSheet='audio';
 h.start(160,210);h.move(160,370);h.end(160,370);
 assert.equal(h.backCalls(),0,'information drawer takes priority over player swipe');
}
{
 const h=harness();
 h.start(160,210);h.move(160,256);h.end(160,265);
 assert.equal(h.backCalls(),0,'small downward movement must not minimize');
}
{
 const h=harness();h.scroll(90);h.start(160,100,{header:true});
 h.move(160,240);h.end(160,240);
 assert.equal(h.backCalls(),1,'header swipe can minimize even when content is scrolled');
}
console.log('AUREL icon contrast and swipe-down navigation regressions passed.');
