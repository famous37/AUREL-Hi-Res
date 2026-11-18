'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const code=fs.readFileSync('app/src/main/assets/aurel-error-log.js','utf8');
const css=fs.readFileSync('app/src/main/assets/aurel-error-log.css','utf8');
const activity=fs.readFileSync('app/src/main/java/com/aurel/hires/MainActivity.java','utf8');
assert.ok(html.indexOf('aurel-error-log.js')<html.indexOf('app.js'),'Global errors must be observed from app initialization');
assert.ok(html.includes('aurel-error-log.css'));
assert.ok(css.includes('data-aurel-error-count'));
assert.match(activity,/case "copySupportLog":/);
assert.ok(activity.includes('setWebChromeClient(new WebChromeClient')); 
assert.ok(activity.includes('onConsoleMessage(ConsoleMessage item)'));
assert.ok(code.includes('safeSource(raw)'));
assert.ok(code.includes('opaque-script'));
assert.ok(code.includes('file:///android_asset/'));
assert.doesNotMatch(activity,/case "copyBeatDiagnostics":/);
assert.match(code,/unhandledrejection/);
assert.match(code,/window\.addEventListener\('error'/);
assert.match(code,/MAX=70/);
assert.match(code,/MAX_AGE=/);
let storage=new Map(),events={};
const window={addEventListener:(type,fn)=>events[type]=fn,AurelEvent:()=>{}};
const document={readyState:'complete',querySelector:()=>null,getElementById:()=>null,addEventListener:(name,fn)=>events['doc:'+name]=fn};
let nativeCalls=[];
const context={window,document,Date,JSON,Promise,console,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  nativeCall(action,data){nativeCalls.push(action);return Promise.reject(new Error('Network failure on https://example.com/private?token=secret'));},
  renderSettings(){},showToast(){}};
vm.runInNewContext(code,context);
const logs=window.AurelErrorLog;
assert.ok(logs&&logs.count()===0);
logs.record('playback','Authorization: verysecret at https://example.net/song?token=ab12 user@host.org');
assert.equal(logs.count(),1);
const report=logs.report();
assert.ok(!report.includes('verysecret'));
assert.ok(!report.includes('example.net'));
assert.ok(!report.includes('user@host.org'));
assert.ok(report.includes('[url]')&&report.includes('[email]'));
logs.record('playback','Authorization: verysecret at https://example.net/song?token=ab12 user@host.org');
assert.equal(logs.count(),1,'Deduplicate repeated native errors');
events.error({message:'JavaScript crashed',filename:'file:///android_asset/aurel-motion.js',lineno:42,colno:7});
assert.equal(logs.count(),2);
assert.ok(logs.report().includes('aurel-motion.js:42:7'),'Local script line and column retained');
events.error({message:'Script error.',filename:'',lineno:0,colno:0});
assert.equal(logs.count(),3);
assert.ok(logs.report().includes('opaque-script'),'Opaque external script errors must not be misattributed');
events.unhandledrejection({reason:{message:'Unhandled call'}});assert.equal(logs.count(),4);
window.AurelEvent('player',{error:'Decoder failure'});
assert.equal(logs.count(),5,'Native player failure is logged');
(async()=>{
 try{await context.nativeCall('seek',{ms:10});assert.fail('Must propagate native rejection');}
 catch(err){assert.ok(err.message.includes('Network failure'));}
 assert.equal(logs.count(),6,'Bridge error is logged and still rejects');
 events.error({target:{tagName:'SCRIPT',src:'file:///android_asset/secondary-player.js'}});
 assert.ok(logs.report().includes('secondary-player.js'),'Missing internal JS resource is actionable');
 const n=logs.count();
 events.error({message:'External failure',filename:'https://private.example.net/secret.js?token=abc',lineno:4,colno:6});
 assert.equal(logs.count(),n+1);
 assert.ok(logs.report().includes('[external script]:4:6'),'External scripts are distinguished');
 assert.ok(!logs.report().includes('private.example.net'),'External origins never appear in support logs');
 events.unhandledrejection({reason:{
   message:'Promise load failed',
   stack:'Error: Promise load failed\\n at run (file:///android_asset/aurel-continuity.js:28:9)'
 }});
 assert.ok(logs.report().includes('aurel-continuity.js:28:9'),'Local promise stack source is preserved');
 for(let i=0;i<110;i++)logs.record('system-'+i,'failure-'+i);
 assert.equal(logs.count(),70,'Error log is bounded');
 assert.ok(storage.has('aurel_error_journal_v1'),'Support log persists locally');
 logs.clear();assert.equal(logs.count(),0);
 assert.ok(!logs.report().includes('failure-109'),'Clearing deletes local history');
 console.log('Global errors: native, player, script, promises, privacy, dedupe, max size and clear PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
