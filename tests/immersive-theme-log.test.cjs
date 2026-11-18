'use strict';
/* Pixel 10 Pro XL reported defects: visually seamless full player, selected
 * navigation, app-wide artwork theme, and the private error-log clipboard. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const load=n=>fs.readFileSync('app/src/main/assets/'+n,'utf8');
const stylesheet=load('aurel-seamless-theme.css');
const player=load('murglar.js'),live=load('aurel-live-ui.js');
const journal=load('aurel-error-log.js');
const activity=fs.readFileSync('app/src/main/java/com/aurel/hires/MainActivity.java','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');
assert.match(gradle,/versionCode\s+90/);
assert.match(gradle,/versionName[^\n]*'1\.1\.71'/);
assert.match(player,/classList\.toggle\('aurel-player-open',!!app\.overlay\)/);
assert.match(player,/previousPage\.setAttribute\('aria-hidden','true'\)/);
assert.match(player,/previousPage\.removeAttribute\('aria-hidden'\)/);
assert.match(stylesheet,/\.app\.aurel-player-open \.main\s*\{\s*visibility:hidden!important/);
assert.match(stylesheet,/\.app\.aurel-player-open \.bottom-nav/);
assert.match(stylesheet,/background:var\(--aurel-album-bg,var\(--aurel-seam-bg/);
assert.match(stylesheet,/data-aurel-palette="mono"[\s\S]*?\.bottom-nav button\.active/);
assert.match(stylesheet,/background:#303236!important/);
assert.match(stylesheet,/data-aurel-palette="artwork"[\s\S]*?\.bottom-nav button\.active/);
assert.match(stylesheet,/\.aurel-pro-choice button\.is-selected/);
assert.match(stylesheet,/\.aurel-language-choice\[aria-checked="true"\]/);
assert.match(stylesheet,/\.aurel-settings-group\[open\]/);
assert.match(stylesheet,/\.aurel-error-panel pre\[data-aurel-error-report\]\[hidden\]/);
assert.match(live,/setProperty\('--accent',colors\.accent\)/);
assert.match(live,/setProperty\('--bg',colors\.bg\)/);
assert.match(live,/setProperty\('--surface',colors\.surface\)/);
assert.match(live,/setProperty\('--muted','#D6D2D5'\)/);
assert.match(activity,/report\.indexOf\('\\n'\)/);
assert.match(activity,/header\.matches\("AUREL Hi-Res/);
assert.doesNotMatch(activity,/report\.startsWith\("AUREL Hi-Res 1\.1\.70/);
assert.match(activity,/clipboard\.setPrimaryClip/);
assert.match(activity,/getWindow\(\)\.getDecorView\(\)\.setBackgroundColor\(color\)/);
assert.match(activity,/web\.setBackgroundColor\(color\)/);
assert.match(journal,/data-aurel-view-errors/);
assert.match(journal,/data-aurel-error-report/);
assert.match(journal,/navigator\.clipboard\?\.writeText/);
assert.match(journal,/document\.execCommand\('copy'\)/);
assert.doesNotMatch(stylesheet,/@keyframes\s+(?:beat|music)|animation\s*:\s*infinite/);
for(const n of ['aurel-error-log.js','aurel-live-ui.js','murglar.js'])
 assert.doesNotThrow(()=>new Function(load(n)),n+' JS syntax');

// A true click simulation, including the report payload and view fallback.
const callbacks={},storage=new Map(),toast=[],requests=[];
const visible={hidden:true,textContent:''};
const viewerButton={
 disabled:false,isConnected:true,attributes:{},hasAttribute:name=>name==='data-aurel-view-errors',
 setAttribute(name,value){this.attributes[name]=value;}
};
const copyButton={
 disabled:false,isConnected:true,hasAttribute:name=>name==='data-aurel-copy-errors'
};
const doc={
 readyState:'complete',body:{appendChild(){}},
 querySelector:selector=>selector==='[data-aurel-error-report]'?visible:null,
 getElementById:()=>null,
 addEventListener:(name,fn)=>callbacks[name]=fn,
};
const win={AurelEvent:()=>{},addEventListener:(name,fn)=>callbacks['window:'+name]=fn};
const context={
 window:win,document:doc,Date,JSON,Promise,console,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 nativeCall:(action,data)=>{requests.push({action,data});return Promise.resolve({copied:true});},
 renderSettings(){},showToast:t=>toast.push(t)
};
vm.runInNewContext(journal,context,{filename:'aurel-error-log.js'});
const log=win.AurelErrorLog;
assert(log&&typeof callbacks.click==='function');
log.record('javascript','Uncaught TypeError in app');
const event=button=>({
 target:{closest:()=>button},
 preventDefault(){},stopPropagation(){}
});
(async()=>{
 await callbacks.click(event(copyButton));
 assert.equal(requests.length,1,'One request must reach Android native clipboard');
 assert.equal(requests[0].action,'copySupportLog');
 assert.match(requests[0].data.report,/^AUREL Hi-Res 1\.1\.71 \| App error log\n/);
 assert(requests[0].data.report.includes('Uncaught TypeError'));
 assert(toast.some(x=>/copied/.test(x)),'Successful native copy must show success');
 await callbacks.click(event(viewerButton));
 assert.equal(visible.hidden,false,'View log expands offline even without clipboard');
 assert(visible.textContent.includes('Uncaught TypeError'));
 assert.equal(viewerButton.attributes['aria-expanded'],'true');
 await callbacks.click(event(viewerButton));
 assert.equal(visible.hidden,true);
 // Simulate older WebView where the native bridge rejects; use local clipboard.
 const requests2=[],captured=[];
 const fakeDocument={
   ...doc,querySelector:()=>null,addEventListener:(name,fn)=>requests2.push({name,fn})
 };
 const fallbackCtx={
   ...context,document:fakeDocument,
   nativeCall:()=>Promise.reject(new Error('Clipboard unavailable')),
   navigator:{clipboard:{writeText:async text=>captured.push(text)}},
   showToast:t=>toast.push(t),
   window:{AurelEvent:()=>{},addEventListener(){}}
 };
 vm.runInNewContext(journal,fallbackCtx);
 const fallbackClick=requests2.find(x=>x.name==='click')?.fn;
 assert(typeof fallbackClick==='function');
 await fallbackClick(event({...copyButton,disabled:false}));
 assert.equal(captured.length,1);
 assert.match(captured[0],/^AUREL Hi-Res 1\.1\.71/);
 console.log('AUREL 1.1.71 immersive navigation, album/graphite design, native/local clipboard, inline viewer PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
