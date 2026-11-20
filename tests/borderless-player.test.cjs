'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const css=read('app/src/main/assets/aurel-borderless-player.css');
const page=read('app/src/main/assets/index.html');
const aurora=read('app/src/main/assets/aurel-aurora.js');
const player=read('app/src/main/assets/murglar.js');
const landscape=read('app/src/main/assets/aurel-landscape.css');
const gradle=read('app/build.gradle');
assert(page.includes('aurel-borderless-player.css'),'New stylesheet is packaged');
assert(page.indexOf('aurel-aurora.css')<page.indexOf('aurel-borderless-player.css'));
assert(page.indexOf('aurel-borderless-player.css')<page.indexOf('aurel-landscape-nav.css'),
 'Keep tested landscape navbar geometry as the final stylesheet');
assert.match(css,/murglar-header\.aurel-listening-nav/);
assert.match(css,/murglar-quick-actions > button/);
assert.match(css,/murglar-transport \.murglar-control:not\(\.middle\)/);
assert.match(css,/#full-toggle/);
assert.match(css,/murglar-source-line/);
assert.match(css,/bottom-nav button\.active/);
assert.match(css,/aurel-detail-drawer/);
assert.match(css,/::-webkit-slider-runnable-track/);
assert.match(css,/::-webkit-slider-thumb/);
assert.match(css,/border:0!important/);
assert.match(css,/background:transparent!important/);
assert.match(css,/var\(--aurel-album-accent/);
assert.match(css,/var\(--aurel-album-one/);
assert.match(css,/var\(--aurel-album-bg/);
assert.match(css,/var\(--played,0%\)/);
assert.match(css,/focus-visible/,'Keyboard focus indicator must remain visible');
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/data-aurel-motion="off"/);
assert.match(css,/orientation:landscape/);
assert.doesNotMatch(css,/@keyframes|animation:.*infinite/,'No fake beat timers');
assert.doesNotMatch(css,/grid-template-(columns|rows)|(?:^|[;{]\s*)(?:width|height)\s*:\s*\d+px/mi,
 'Skin must not resize the proven player controls or navigation');
assert.doesNotMatch(css,/transition:\s*all|transition:[^;]*(?:width|height|padding|margin|left|top)/i,
 'Animations must not move layout');
assert(player.includes('data-full-toggle')&&player.includes('data-player-sheet="audio"'),
 'Functional playback and details controls must stay mounted');
assert(landscape.includes('grid-template-areas:')&&landscape.includes('"cover transport"'),
 'Do not change established two-column landscape arrangement');
assert.match(gradle,/versionCode\s+109/);
assert.match(gradle,/versionName[^\n]*'1\.1\.92'/);
new Function(aurora);

// Runtime: native artwork palette is mirrored ONLY to the active player
// and the persistent nav, including when global monochrome is selected.
const styles=()=>{const map=new Map();return {map,setProperty:(k,v)=>map.set(k,v)}};
const overlayStyle=styles(),navStyle=styles(),store=new Map();
const classes={toggle(){},add(){},remove(){},contains(){return false}};
const overlay={style:overlayStyle,classList:classes,querySelector:()=>null};
const nav={style:navStyle};
const track={image:{large:'https://static.qobuz.com/album-a.jpg'}};
const app={overlay:true,player:{playing:false,track,bitPerfect:{enabled:false}}};
const win={matchMedia:()=>({matches:false,addEventListener(){}}),AurelEvent:()=>{},AurelBeatFrame:()=>{}};
const doc={hidden:false,documentElement:{dataset:{aurelMotion:'soft'}},
 getElementById:id=>id==='overlay'?overlay:id==='screen'?{querySelector:()=>null}:null,
 querySelector:q=>q==='.bottom-nav'?nav:null,
 addEventListener(){},createElement:()=>({setAttribute(){}})};
const context={window:win,document:doc,app,
 image:t=>t?.image?.large||'',renderSettings(){},drawOverlay(){},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 Date,Number,Math};
vm.runInNewContext(aurora,context,{filename:'aurel-aurora.js'});
win.AurelAuroraPalette('https://static.qobuz.com/album-a.jpg',
 '#15120F','#302820','#EFD199','#DAA352','#B88335','#F2CE8B');
assert.equal(overlayStyle.map.get('--aurel-album-accent'),'#EFD199');
assert.equal(navStyle.map.get('--aurel-album-accent'),'#EFD199');
assert.equal(navStyle.map.get('--aurel-album-bg'),'#15120F');
assert.equal(navStyle.map.get('--aurel-album-one'),'#DAA352');
win.AurelAuroraPalette('https://static.qobuz.com/not-active.jpg',
 '#090909','#222222','#50D0EC','#35E7FF','#0088D1','#C860E1');
assert.equal(navStyle.map.get('--aurel-album-accent'),'#EFD199',
 'Stale artwork cannot contaminate the playing track');
track.image.large='https://static.qobuz.com/album-b.jpg';
win.AurelAurora.refresh();
assert.equal(navStyle.map.get('--aurel-album-accent'),'#D5D7DB',
 'Until a new album palette arrives, stale colors must be removed');
assert.equal(overlayStyle.map.get('--aurel-album-accent'),'#D5D7DB');
assert.equal(overlay.classList?.contains?.('aurel-aurora-beat-live')||false,false);
console.log('AUREL borderless visual hierarchy, contrast, responsive safety and album palette/nav synchronization PASS');
