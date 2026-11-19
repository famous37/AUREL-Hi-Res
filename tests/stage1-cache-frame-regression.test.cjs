'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,'app/src/main/assets',name),'utf8');
const native=fs.readFileSync(path.join(root,'app/src/main/java/com/aurel/hires/AurelPlaybackService.java'),'utf8');
const activity=fs.readFileSync(path.join(root,'app/src/main/java/com/aurel/hires/MainActivity.java'),'utf8');
const page=source('aurel-page-cache.js');
const pacing=source('aurel-stage1-frame-pacing.js');
const html=source('index.html');
new Function(page);new Function(pacing);
assert(html.includes('<script src="aurel-stage1-frame-pacing.js"></script>'));
assert(html.indexOf('aurel-stage1-frame-pacing.js')>html.indexOf('aurel-aurora.js'));
assert(native.includes('LruCache<String,Bitmap> artworkCache'));
assert(native.includes('artworkCache.get(url)'));
assert(native.includes('artworkPaletteCache.get(url)'));
assert(native.includes('generation!=coverGeneration'));
assert(native.includes('artworkCache.evictAll()'));
assert(activity.includes('restorePlaybackContinuity();'));
assert(activity.includes('savePlaybackContinuity();'));
assert(source('aurel-continuity.js').includes('window.AurelPersistNow='));
assert(source('aurel-player-fit.js').includes("observer.observe(view)"));

(async()=>{
 const state={session:{streamConnected:true,streamUserId:'first',appId:'valid'}};
 const pending=[],storage=new Map();
 let requests=0;
 const sandbox={
   app:state,
   window:{},
   document:{hidden:true},
   localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)},
   hasAuth:()=>true,
   api:(action,params)=>{requests++;return new Promise(resolve=>pending.push(resolve));}
 };
 vm.runInNewContext(page,sandbox,{filename:'aurel-page-cache.js'});
 const cache=sandbox.window.AurelPageCache;
 const one=sandbox.api('album',{id:'a'});
 const two=sandbox.api('album',{id:'a'});
 assert.equal(requests,1,'Concurrent metadata reads must share one network request');
 pending.shift()({id:'a',nested:{title:'Original'}});
 const [first,second]=await Promise.all([one,two]);
 first.nested.title='Modified';
 assert.equal(second.nested.title,'Original','Shared responses must be isolated copies');
 const again=await sandbox.api('album',{id:'a'});
 assert.equal(again.nested.title,'Original');
 assert.equal(requests,1,'Warm cache must avoid a second network request');
 // An older response may complete after an account change, but must never
 // overwrite the second account's catalogue cache.
 const old=sandbox.api('album',{id:'b'});
 state.session.streamUserId='second';
 const fresh=sandbox.api('album',{id:'b'});
 assert.equal(requests,3,'Account changes must not reuse an in-flight request');
 pending.shift()({id:'b',account:'first'});
 pending.shift()({id:'b',account:'second'});
 await old;await fresh;
 const result=await sandbox.api('album',{id:'b'});
 assert.equal(result.account,'second','Old account must not poison new cache');
 assert.equal(requests,3);
 const action=sandbox.api('play',{id:'audio'});
 const another=sandbox.api('play',{id:'audio'});
 assert.equal(requests,5,'Playback commands must never be coalesced');
 pending.shift()({ok:true});pending.shift()({ok:true});
 await Promise.all([action,another]);
 assert(!Array.from(storage.values()).some(value=>String(value).includes('account')),
   'Personal catalogue responses must stay in memory only');

 const frames=[],delivered=[],listeners={};
 const doc={hidden:false,addEventListener(name,listener){listeners[name]=listener;}};
 const frameSandbox={
   window:{AurelBeatFrame:value=>delivered.push(value)},
   document:doc,
   requestAnimationFrame(fn){frames.push(fn);return frames.length;},
   cancelAnimationFrame(){},
 };
 vm.runInNewContext(pacing,frameSandbox,{filename:'aurel-stage1-frame-pacing.js'});
 frameSandbox.window.AurelBeatFrame(.1);
 frameSandbox.window.AurelBeatFrame(.65);
 frameSandbox.window.AurelBeatFrame(.3);
 assert.equal(frames.length,1,'Multiple FFT callbacks should schedule only one animation frame');
 frames.shift()();
 assert.equal(delivered.length,1);
 assert(Math.abs(delivered[0]-.65)<0.0001,'Short FFT peaks must be preserved');
 frameSandbox.window.AurelBeatFrame(.9);
 doc.hidden=true;listeners.visibilitychange();
 frames.shift()();
 assert.equal(delivered.length,1,'Hidden pages must not animate');
 doc.hidden=false;
 frameSandbox.window.AurelBeatFrame(.4);
 frames.shift()();
 assert.equal(delivered.length,2);
 console.log('Stage 1: in-flight catalogue isolation, artwork LRU, FFT frame pacing and continuity PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
