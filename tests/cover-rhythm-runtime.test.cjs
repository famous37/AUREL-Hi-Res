'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('app/src/main/assets/aurel-cover-rhythm.js','utf8');
function fakeList(){
  const set=new Set();
  return {
    toggle(name,on){
      if(on===undefined)on=!set.has(name);
      if(on)set.add(name);else set.delete(name);
      return on;
    },
    add(name){set.add(name);},
    remove(name){set.delete(name);},
    contains(name){return set.has(name);}
  };
}
function setup(saved='off'){
  const classes=fakeList(),styles=new Map(),listeners={};
  const overlay={classList:classes,style:{setProperty:(k,v)=>styles.set(k,v)}};
  const screen={querySelector:()=>null};
  const doc={
    hidden:false,
    documentElement:{dataset:{aurelMotion:'soft'}},
    getElementById:id=>id==='overlay'?overlay:id==='screen'?screen:null,
    querySelector:()=>null,
    addEventListener:(name,fn)=>listeners[name]=fn
  };
  const calls=[],messages=[];
  const app={overlay:true,player:{playing:true,buffering:false,error:'',bitPerfect:{enabled:false}}};
  const ctx={
    document:doc,app,renderSettings:()=>{},drawOverlay:()=>{},
    window:{matchMedia:()=>({matches:false,addEventListener:()=>{}}),AurelEvent:()=>{}},
    nativeCall:(name,data)=>{calls.push({name,data});return Promise.resolve({permissionGranted:!!data.requestPermission});},
    localStorage:{getItem:()=>saved,setItem:()=>{}},showToast:(s)=>messages.push(s),
    Date,Math,Number,Promise
  };
  vm.runInNewContext(source,ctx,{filename:'aurel-cover-rhythm.js'});
  return {ctx,app,calls,classes,styles,listeners,messages};
}
(async()=>{
  const f=setup();
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.classes.contains('aurel-beat-live'),false,'No FFT: no fake visual pulse');
  assert.equal(f.classes.contains('aurel-beat-ambient'),false,'No cyclic ambient animation');
  f.listeners.change({target:{matches:()=>true,checked:true}});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  const requests=f.calls.filter(c=>c.name==='setBeatVisualization'&&c.data.requestPermission);
  assert.equal(requests.length,1,'One permission request, no competing false/true race');
  assert.equal(requests[0].data.enabled,true,'Enable native analyzer with permission request');
  f.ctx.window.AurelBeatFrame(.97);
  assert.equal(f.classes.contains('aurel-beat-live'),true,'Real FFT frame starts live transform');
  assert.ok(Number(f.styles.get('--aurel-cover-scale'))>1.09,'Real bass kick expands cover');
  f.ctx.window.AurelBeatFrame(0);
  assert.ok(Number(f.styles.get('--aurel-cover-scale'))<1,'Real silence contracts cover');
  f.app.player.playing=false;
  f.ctx.window.AurelEvent('player',{});
  assert.equal(f.classes.contains('aurel-beat-live'),false,'Pause stops movement');
  f.app.player.playing=true;
  f.app.player.bitPerfect.enabled=true;
  f.ctx.window.AurelEvent('player',{});
  assert.equal(f.classes.contains('aurel-beat-live'),false,'Bit-perfect never claims live FFT');
  f.ctx.window.AurelBeatFrame(1);
  assert.equal(f.classes.contains('aurel-beat-live'),false,'Ignore FFT when bit-perfect enabled');
  const saved=setup('on');
  assert.equal(saved.classes.contains('aurel-beat-ambient'),false);
  assert.equal(saved.classes.contains('aurel-beat-live'),false,'Saved setting is NOT synthetic signal');
  console.log('Rhythm UI runtime: FFT frames drive scale, silence/pause/bit-perfect stay true, one permission request PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
