'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('app/src/main/assets/murglar.js','utf8');
const fit=fs.readFileSync('app/src/main/assets/aurel-player-fit.js','utf8');
const gestures=fs.readFileSync('app/src/main/assets/aurel-track-swipe.js','utf8');
assert.match(code,/const visualSignature=JSON\.stringify/);
assert.match(code,/overlay\.dataset\.openSignature===visualSignature/);
assert.match(code,/if\(stableDOM\)/);
assert.match(code,/updateOverlayState\(\);\s*return;/);
assert.match(fit,/if\(after&&\(after!==before\|\|after!==observed\)\)schedule\(\)/);
assert.match(gestures,/priorView!==renderedView\|\|priorSheetHTML!==renderedSheetHTML/);
const calls={renders:0,full:0,status:0};
let content='',hidden=false;
const view={},scroller={scrollTop:0},source={textContent:''};
const classes={add:x=>{if(x==='hidden')hidden=true;},remove:x=>{if(x==='hidden')hidden=false;},contains:x=>x==='hidden'?hidden:false};
const overlay={
 dataset:{openTrack:'',openSheet:'',openSignature:''},
 style:{setProperty(){}},classList:classes,
 get innerHTML(){return content;},
 set innerHTML(next){content=next;calls.full++;},
 querySelector(key){
  if(key==='.murglar-view')return content?view:null;
  if(key==='.murglar-player-content')return content?scroller:null;
  if(key==='.murglar-source-line span')return content?source:null;
  return null;
 }
};
const app={overlay:true,dragging:false,playerSheet:'',session:{},
 player:{track:{id:11,title:'First',artist:{name:'Artist',id:'a'},album:{id:1,title:'Album'}},
 duration:240000,position:1000,playing:true,shuffle:false,repeat:0}};
const context={
 app,document:{querySelector:n=>n==='.app'?{classList:{toggle(){}}}:n==='.main'?{
 setAttribute(){},removeAttribute(){}}:null},
 window:{AurelNative:{setPlayerImmersive(){}}},
 $:key=>key==='#overlay'?overlay:null,
 image:()=> 'https://example.org/cover.jpg',
 artistButton:()=>'<button>Artist</button>',
 artistLabel:()=> 'Artist',
 actualSource:()=> 'FLAC · 24-bit / 48 kHz',
 html:String,ic:()=>'<svg></svg>',
 aurelPlaybackMode:()=> 'playing',aurelPlaybackLabel:()=> 'Pause',
 aurelPlaybackIcon:()=>'<svg></svg>',
 duration:value=>String(value),
 aurelStopLoadingAnimation(){},aurelEnsureLoadingAnimation(){},
 queuePanel:()=> 'Queue',creditsPanel:()=> 'Credits',audioPanel:()=> 'Audio',
 drawOverlay(){calls.renders++;}
};
vm.runInNewContext(code,context);
context.drawOverlay();
assert.equal(calls.full,1,'First opening creates player once');
const firstContent=content;
app.player.position=1600;
context.drawOverlay();
assert.equal(calls.full,1,'Progress events reuse DOM without recreating the cover');
assert.equal(content,firstContent,'Cover, action buttons and content retain identity');
app.player.position=2400;
app.player.buffering=true;
context.drawOverlay();
assert.equal(calls.full,1,'Buffering updates should not rebuild the album view');
app.player.buffering=false;
app.player.track.title='Corrected title';
context.drawOverlay();
assert.equal(calls.full,2,'Real metadata change must rebuild once');
app.playerSheet='audio';
context.drawOverlay();
assert.equal(calls.full,3,'Opening a drawer changes its structure once');
app.playerSheet='';
context.drawOverlay();
assert.equal(calls.full,4,'Closing drawer rebuilds main view once');
app.overlay=false;context.drawOverlay();
assert.equal(calls.full,5,'Minimizing cleans the overlay');
assert(hidden,'The overlay must be hidden after minimizing');
console.log('AUREL 1.1.74: native progress/FFT event DOM stability, metadata updates, drawer transitions PASS');
