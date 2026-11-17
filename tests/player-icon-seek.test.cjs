'use strict';
/* Original artwork and safe seek gesture regression (no Qobuz credentials). */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(__dirname+'/../'+p,'utf8');
const root='app/src/main/';
const launcher=read(root+'res/drawable/aurel_launcher_foreground.xml');
const monochrome=read(root+'res/drawable/aurel_launcher_monochrome.xml');
const fallback=read(root+'res/mipmap-anydpi/ic_launcher.xml');
const status=read(root+'res/drawable/ic_stat_aurel.xml');
const html=read(root+'assets/index.html');
for(const [label,icon] of Object.entries({launcher,monochrome,fallback})){
 for(const path of ['M54,20 A34,34','M54,25 A29,29','M54,30 A24,24',
  'M30,79 L50,34 L58,34 L78,79','M41,64 L41,68','M66,61 L66,71']){
  assert(icon.includes(path),label+' lost the original vinyl/equalizer element: '+path);
 }
 assert(icon.includes('viewportWidth="108"'),label+' must be a scalable vector');
}
assert.equal((html.match(/class="aurel-brand-svg"/g)||[]).length,2);
assert.equal((html.match(/<circle cx="54" cy="54" r="34"/g)||[]).length,2);
assert.equal((html.match(/M41 64v4m5-7v10/g)||[]).length,2);
assert(status.includes('M5.6,20 L10.5,5.5'),'notification icon must carry AUREL monogram');
assert(status.includes('M9,14 L9,16'),'notification icon must carry equalizer detail');
const player=read(root+'assets/murglar.js');
for(const text of ['aria-pressed="${!!p.shuffle}"','aria-label="${repeatCaption(p)}"',
 'progress.disabled','aria-valuetext','if(!sameTrack)app.dragging=false']){
 assert(player.includes(text),'Now Playing regression: '+text);
}
const source=read(root+'assets/modern.js');
assert(source.includes('data?.bitPerfect?.usbRouted')&&source.includes('data?.androidMixerHz'),
 'Audio details need live USB/mixer status');
const appJs=read(root+'assets/app.js');
const start=appJs.indexOf('// A seek is an intentional user gesture.');
const end=appJs.indexOf("$('#mini').addEventListener",start);
assert(start>0&&end>start,'Seek handlers must remain accessible');
const listeners={};let updates=0;
const calls=[];
const state={dragging:false,player:{track:{id:'one'},duration:30000}};
const elapsed={textContent:''};
const document={
 hidden:false,
 addEventListener(type,callback){(listeners[type]||=[]).push(callback)}
};
const ctx={document,app:state,$:key=>key==='#elapsed'?elapsed:null,
 duration:seconds=>String(Math.floor(seconds)),Number,Math,
 nativeCall:(action,payload)=>{calls.push({action,payload});return Promise.resolve()},
 showToast:()=>{},updateOverlayState:()=>{updates++;}};
vm.runInNewContext(appJs.slice(start,end),ctx);
const emit=(type,event)=>{for(const listener of listeners[type]||[])listener(event)};
const target={id:'progress',value:'12000'};
emit('pointerdown',{target});
emit('input',{target});
assert.equal(state.dragging,true,'Native progress must not fight user drag');
assert.equal(calls.length,0,'Dragging must not emit repeated seeks');
emit('change',{target});
assert.equal(state.dragging,false);
assert.equal(calls.length,1);
assert.equal(calls[0].action,'seek');
assert.equal(calls[0].payload.ms,12000);
target.value='98000';
emit('change',{target});
assert.equal(calls[1].payload.ms,30000,'Seek must be clamped to duration');
emit('pointerdown',{target});
emit('pointercancel',{target});
assert.equal(state.dragging,false,'Cancelled gestures cannot lock progress');
assert(updates>0,'Cancelled gesture must restore live transport state');
state.player.duration=0;
emit('change',{target});
assert.equal(calls.length,2,'Unknown duration must not seek');
console.log('AUREL original icon in all surfaces and resilient player seek PASS');
