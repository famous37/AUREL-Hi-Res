'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'../app/src/main');
const asset=name=>fs.readFileSync(path.join(base,'assets',name),'utf8');
const java=name=>fs.readFileSync(path.join(base,'java/com/aurel/hires',name),'utf8');
const html=asset('index.html');
const page=asset('aurel-page-cache.js'),settings=asset('aurel-settings-pro.js');
const motion=asset('aurel-motion.js'),nav=asset('aurel-continuity.js');
const app=asset('app.js'),style=asset('aurel-studio.css');
const native=java('MainActivity.java'),bit=java('BitPerfectOutput.java');
new Function(page);new Function(settings);new Function(motion);

assert(html.indexOf('aurel-studio.css')>html.indexOf('aurel-precision-ui.css'));
assert(html.indexOf('aurel-settings-pro.js')>html.indexOf('aurel-page-cache.js'));
assert(html.indexOf('aurel-page-cache.js')>html.indexOf('aurel-continuity.js'));
assert(motion.includes("document.documentElement?.dataset?.aurelMotion==='off'"));
assert(nav.includes("if(before!==shown||!before)restoreY(location());"),
 'Same-route metadata must NOT forcibly reset scroll position');
assert(!nav.includes("if(before===shown||!before)restoreY(location());"));
for(const name of ['artist','album','playlist','search']){
 assert(app.includes("AurelPageCache?.peek('"+name+"'"),'No instant cache-first route: '+name);
}
for(const word of ['audioDiagnostics','setDigitalHeadroom','setMetadataPreload']){
 assert(native.includes('case "'+word+'"'),'Missing native command: '+word);
 assert(settings.includes("'"+word+"'"),'Missing settings action: '+word);
}
assert(native.includes('mp.setVolume(gain,gain)'), 'Headroom must alter native MediaPlayer volume');
assert(native.includes('if(prefetchNextMetadata && queueIndex+1<queue.size())'));
assert(native.includes('if(db!=0&&bitPerfect.isEnabled())'),
 'Do not digitally attenuate a bit-perfect stream');
assert(bit.includes('getSupportedMixerAttributes(device)'));
assert(bit.includes('MIXER_BEHAVIOR_BIT_PERFECT'));
assert(bit.includes('"verifiedEndToEnd",false'));
assert(!settings.includes('Audio engine limits'),'Do not show verbose capabilities notice');
assert(settings.includes('Signal path'),'Keep optional technical diagnostics');
assert(settings.includes('Refresh outputs'),'Keep manual output refresh');
assert(style.includes('html[data-aurel-motion="off"]'));
assert(style.includes('.aurel-signal-chain'));
assert(style.includes('.topbar .mobile-logo'));
for(const file of [
 'drawable/aurel_launcher_foreground.xml','drawable/aurel_launcher_monochrome.xml',
 'drawable/aurel_launcher_background.xml','mipmap-anydpi-v26/ic_launcher.xml'
])assert(fs.existsSync(path.join(base,'res',file)),file+' missing');
assert(fs.readFileSync(path.join(base,'res/mipmap-anydpi-v26/ic_launcher.xml'),'utf8')
 .includes('aurel_launcher_foreground'));

(async()=>{
 let clock=1000,calls=0,fail=false;
 const persisted=new Map();
 const state={session:{streamConnected:true,streamUserId:'user-one',appId:'123'}};
 const sandbox={
  app:state,window:{},document:{hidden:true},
  localStorage:{getItem:k=>persisted.get(k)||null,setItem:(k,v)=>persisted.set(k,v)},
  Date:class extends Date {static now(){return clock;}},
  hasAuth:()=>true,console,
  api:async(action,params)=>{calls++;if(fail)throw Error('offline');
    return {id:params?.id||'home',payload:{nested:{value:'original'}},count:calls,action};}
 };
 vm.runInNewContext(page,sandbox,{filename:'aurel-page-cache.js'});
 const cache=sandbox.window.AurelPageCache;
 assert(cache.installed);
 const x=await sandbox.api('album',{id:'abc'});
 assert.equal(calls,1);
 x.payload.nested.value='mutated';
 const y=await sandbox.api('album',{id:'abc'});
 assert.equal(calls,1,'Fresh album should be returned without network');
 assert.equal(y.payload.nested.value,'original','Cache contents must be copied');
 assert.equal(cache.info().hits,1);
 await sandbox.api('play',{tracks:[1]});
 await sandbox.api('play',{tracks:[1]});
 assert.equal(calls,3,'Streams must NEVER be cached');
 assert(!Array.from(persisted.values()).some(v=>String(v).includes('payload')));
 assert.equal(cache.info().pages,1);
 // Account identity is a hard cache boundary.
 state.session.streamUserId='user-two';
 await sandbox.api('album',{id:'abc'});
 assert.equal(calls,4);
 assert.equal(cache.info().pages,1);
 // Expired metadata may be displayed if the network is down, not a fake fresh result.
 clock+=21*60*1000;fail=true;
 const offline=await sandbox.api('album',{id:'abc'});
 assert.equal(offline.action,'album');
 assert.equal(cache.info().staleFallbacks,1);
 fail=false;
 cache.configure({enabled:false});
 const offBefore=calls;
 await sandbox.api('album',{id:'abc'});
 await sandbox.api('album',{id:'abc'});
 assert.equal(calls-offBefore,2,'Disabled buffer must bypass cache');
 cache.configure({enabled:true,limit:12});
 for(let i=0;i<20;i++)await sandbox.api('album',{id:'album-'+i});
 assert(cache.info().pages<=12,'LRU max pages enforced');
 cache.clear();
 assert.equal(cache.info().pages,0);
 console.log('AUREL v1.1.40 page buffer, audio diagnostics, animation and launcher checks PASS');
})().catch(err=>{console.error(err);process.exitCode=1;});