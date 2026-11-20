'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'..');
const asset=name=>fs.readFileSync(path.join(base,'app/src/main/assets',name),'utf8');
const java=fs.readFileSync(path.join(base,'app/src/main/java/com/aurel/hires/MainActivity.java'),'utf8');
const syncCode=asset('aurel-preference-sync.js');
const appCode=asset('app.js'),settings=asset('aurel-settings-pro.js');
const motion=asset('aurel-motion.js'),swipe=asset('aurel-swipe-minimize.js');
const clarity=asset('aurel-clarity.css'),index=asset('index.html');
const gradle=fs.readFileSync(path.join(base,'app/build.gradle'),'utf8');
assert(/versionCode\s+116/.test(gradle) && gradle.includes("'1.1.99'"),
 'New release must advance versionCode and versionName');
for(const js of [syncCode,motion,swipe,settings])new Function(js);
assert(index.indexOf('aurel-preference-sync.js')>index.indexOf('aurel-page-cache.js'));
assert(index.indexOf('aurel-preference-sync.js')<index.indexOf('aurel-settings-pro.js'));
assert(appCode.includes('const structural=fields.some('));
assert(appCode.includes('window.AurelPreferenceSync?.refreshControls()'));
assert(appCode.includes('window.AurelPreferenceSync?.reconcileSession(data)'));
assert(!appCode.includes("function setQuality(q){nativeCall('saveSettings',{quality:q}).then(d=>{app.session=d;render()"));
assert(appCode.includes("nativeCall('saveSettings',{appSecret:value})"));
assert(!appCode.includes("nativeCall('saveSettings',{quality:app.session.quality,appSecret:value})"));
assert(java.includes('if(p.has("quality")){')&&java.includes('p.getInt("quality")'));
assert(java.includes('digitalHeadroomDb=0;')&&java.includes('prefetchNextMetadata=true;'));
assert(settings.includes("sync.change('digitalHeadroomDb',db"));
assert(settings.includes("sync.change('preloadNextMetadata',value"));
assert(motion.includes("duration:215")&&!motion.includes("translate3d(0,5px,0)"));
assert(motion.includes("previous===next"));
assert(clarity.includes('animation:none!important;')&&!clarity.includes('animation:aurel-settings-enter'));
assert(swipe.includes('if(!g||dismissing)return;'));

const session={
 authMode:'qobuz',streamUserId:'42',libraryUserId:'',
 streamConnected:true,libraryConnected:false,
 quality:27,digitalHeadroomDb:0,preloadNextMetadata:true,
 bitPerfect:{enabled:false,status:'off'}
};
const app={nav:'settings',session:{...session}};
function control(dataset){
 const attrs={},classes=new Set(),node={
   dataset,isConnected:true,checked:false,classList:{
     contains:name=>classes.has(name),
     toggle(name,active){if(active)classes.add(name);else classes.delete(name);}
   },
   getAttribute:k=>attrs[k],
   setAttribute(k,v){attrs[k]=String(v);}
 };
 return node;
}
const qualities=[5,6,7,27].map(q=>control({quality:String(q)}));
const headrooms=[0,-3,-6,-9,-12].map(db=>control({aurelHeadroom:String(db)}));
const preload=control({}),bp=control({});
const statusNode={textContent:''};
const dot=control({});
const document={
 querySelector(sel){
  if(sel==='.aurel-bp-status strong')return statusNode;
  if(sel==='.aurel-bp-dot')return dot;
  return null;
 },
 querySelectorAll(sel){
  const map={
   '[data-quality]':qualities,
   '[data-aurel-headroom]':headrooms,
   '[data-aurel-preload]':[preload],
   '[data-bit-perfect-toggle]':[bp]
  };
  assert(Object.prototype.hasOwnProperty.call(map,sel),'Unexpected preference selector '+sel);
  return map[sel];
 }
};
const window={};
vm.runInNewContext(syncCode,{app,document,window,Map,Promise,String,Number,Error});
const prefs=window.AurelPreferenceSync;
assert(prefs,'Preferences helper is installed');
prefs.refreshControls();
assert.equal(qualities[3].getAttribute('aria-pressed'),'true');
let resolveSix,resolveSeven;
const six=new Promise(r=>resolveSix=r);
const seven=new Promise(r=>resolveSeven=r);
const writes=[];
const first=prefs.change('quality',6,v=>{writes.push(v);return six;});
const second=prefs.change('quality',7,v=>{writes.push(v);return seven;});
assert.equal(app.session.quality,7,'Latest selection must appear immediately');
assert.equal(qualities[2].getAttribute('aria-pressed'),'true');
assert.equal(qualities[1].getAttribute('aria-pressed'),'false');
assert.equal(prefs.reconcileSession({...session,quality:27}).quality,7,
 'Old Android event must not overwrite the newest quality');
(async()=>{
 // Cross-realm Promise continuations need one event-loop turn to settle.
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(writes,[6],'Same-setting writes are serialized');
 resolveSix({quality:6});
 await first;
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(writes,[6,7],'Newest write eventually reaches native storage');
 assert.equal(app.session.quality,7);
 resolveSeven({quality:7});
 await second;
 assert.equal(prefs.reconcileSession({...session,quality:6}).quality,7,
  'Late stale event must not undo confirmed quality');

 const fail=await prefs.change('digitalHeadroomDb',-6,()=>Promise.reject(new Error('USB bit-perfect mode')))
   .then(()=>null,e=>e);
 assert.match(fail.message,/USB bit-perfect/);
 assert.equal(app.session.digitalHeadroomDb,0,'Failed headroom must roll back');
 assert.equal(headrooms[0].getAttribute('aria-pressed'),'true');

 const preloadTask=prefs.change('preloadNextMetadata',false,()=>Promise.resolve({enabled:false}));
 assert.equal(preload.checked,false);
 await preloadTask;
 assert.equal(prefs.reconcileSession({...session,preloadNextMetadata:true}).preloadNextMetadata,false);

 const bitTask=prefs.change('bitPerfect',true,()=>Promise.resolve({enabled:true}));
 await bitTask;
 assert.equal(bp.getAttribute('aria-checked'),'true');
 assert.equal(statusNode.textContent,'Standard playback');
 assert.equal(prefs.reconcileSession(session).bitPerfect.enabled,true);
 assert.equal(bp.getAttribute('aria-checked'),'true');

 const newAccount={...session,streamUserId:'43'};
 assert.equal(prefs.reconcileSession(newAccount).quality,27,
  'Account switch resets stale preference overrides');
 assert.equal(prefs.reconcileSession(newAccount).bitPerfect.enabled,false);
 console.log('AUREL 1.1.40 settings concurrency, rollback, native persistence and jitter checks PASS');
})().catch(err=>{console.error(err);process.exitCode=1;});
