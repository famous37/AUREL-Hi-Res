'use strict';
/* AUREL universal borderless acceptance tests; no network or Android SDK. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const css=read('app/src/main/assets/aurel-universal-borderless.css');
const html=read('app/src/main/assets/index.html');
const player=read('app/src/main/assets/murglar.js');
const live=read('app/src/main/assets/aurel-live-ui.js');
const gradle=read('app/build.gradle');
const native=read('app/src/main/java/com/aurel/hires/AurelPlaybackService.java');
const usb=read('app/src/main/java/com/aurel/hires/BitPerfectOutput.java');
assert.match(gradle,/versionCode\s+109/);
assert.match(gradle,/versionName[^\n]*'1\.1\.92'/);
assert(html.includes('aurel-universal-borderless.css'));
assert(html.indexOf('aurel-universal-borderless.css')>html.indexOf('aurel-landscape-nav.css'),
 'Final stylesheet must defeat previously hard-coded icon frames');
assert(!player.includes('<span>Now Playing</span>'),'No Now Playing label occupying the glow header');
assert(!player.includes('class="murglar-heading-cover"'),'No duplicate thumbnail obscuring album ambience');
assert.match(player,/data-close-overlay/);
assert.match(player,/data-player-sheet="audio"/);
assert.match(player,/data-full-toggle/);
assert.match(player,/data-like-track/);
assert.match(player,/data-open-playing-album/);
assert.match(css,/murglar-header\.aurel-listening-nav/);
assert.match(css,/murglar-now-heading\{visibility:hidden/);
assert.match(css,/aurel-art-backdrop\{pointer-events:none/);
assert.match(css,/app \.bottom-nav button\.active/);
assert.match(css,/app \.mini:not\(\.hidden\)/);
assert.match(css,/aurel-settings-group > summary \.aurel-group-icon/);
assert.match(css,/aurel-favourite-control/);
assert.match(css,/aurel-settings-heading button/);
assert.match(css,/app #screen.*\.panel/);
assert.match(css,/focus-visible/,'Touch navigation can remain frameless but focus must stay visible');
assert.match(css,/orientation:portrait/);
assert.match(css,/orientation:landscape/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/data-aurel-motion="off"/);
assert.match(css,/data-aurel-palette="artwork"/);
assert.doesNotMatch(css,/@keyframes|animation:\s*infinite/,
 'No decorative fictitious music beat');
assert.doesNotMatch(css,/transition\s*:\s*all/,
 'No layout-wide transitions');
assert.match(live,/aurel_palette_artwork_v1/,'Respect the existing opt-in preference key');
assert.match(live,/themeByCover\.set/);
assert.match(live,/coverNow\(\)===url/,'A late cover callback cannot contaminate the next song');
assert.match(live,/--aurel-global-glow-one/);
assert.match(live,/--aurel-global-glow-two/);
assert.match(live,/--aurel-global-glow-three/);
assert.match(native,/onAlbumArtworkPalette/);
assert.match(native,/static String\[\] palette\(Bitmap bitmap\)/);
assert(!usb.includes('universal-borderless'),'No audio engine changes');
new Function(player);
new Function(live);
// Simulate the global theme preference, cover callbacks, stale updates,
// track change, navigation and complete revert to graphite.
function fixture(mode){
 const values=new Map();
 const initial=new Map([['aurel_mono_default_1_1_37','done'],['aurel_palette_artwork_v1',mode]]);
 const styles={setProperty:(k,v)=>values.set(k,v)};
 const attrs=new Map(),root={style:styles,setAttribute:(k,v)=>attrs.set(k,v)};
 const tabs={innerHTML:'',setAttribute(){},addEventListener(){},querySelectorAll:()=>[]};
 const overlay={style:{setProperty(){}}};
 const meta={setAttribute:(k,v)=>{meta[k]=v}};
 const events={};
 const doc={documentElement:root,
  querySelector:q=>q==='.bottom-nav'?tabs:q==='#overlay'?overlay:q==='meta[name="theme-color"]'?meta:null,
  querySelectorAll:()=>[],getElementById:()=>null,
  addEventListener:(k,fn)=>events[k]=fn};
 const track={image:{large:'cover-A'}};
 const app={player:{track},overlay:false,nav:'home'};
 let forwarded=0;
 const win={AurelAuroraPalette:()=>forwarded++};
 const ctx={window:win,document:doc,app,ic:()=>'<svg/>',
   renderSettings(){},updateMini(){},render(){},drawOverlay(){},
   image:t=>t?.image?.large||'',localStorage:{
     getItem:k=>initial.get(k)||null,setItem:(k,v)=>initial.set(k,v)},
   setTimeout(){},clearTimeout(){},Date,Math,Number};
 vm.runInNewContext(live,ctx,{filename:'aurel-live-ui.js'});
 return {win,doc,root,attrs,values,initial,app,ctx,track,forwarded:()=>forwarded};
}
const x=fixture('off');
assert.equal(x.attrs.get('data-aurel-palette'),'mono');
x.win.AurelCoverPalette('cover-A','#241019','#37202a','#EE8B9A','#F56B85','#C53156','#F3B3C7');
assert.equal(x.values.get('--aurel-theme-accent'),'#D5D7DB',
 'If preference is OFF, playback may not recolor the rest of the app');
assert.equal(x.forwarded(),1,'Album halo still receives native artwork when global colors OFF');
x.win.AurelTheme.setArtworkPalette(true);
assert.equal(x.attrs.get('data-aurel-palette'),'artwork');
assert.equal(x.values.get('--aurel-theme-bg'),'#241019');
assert.equal(x.values.get('--aurel-theme-surface'),'#37202a');
assert.equal(x.values.get('--aurel-theme-accent'),'#EE8B9A');
assert.equal(x.values.get('--aurel-global-glow-one'),'#F56B85');
assert.equal(x.values.get('--aurel-global-glow-two'),'#C53156');
assert.equal(x.values.get('--aurel-global-glow-three'),'#F3B3C7');
assert.equal(x.initial.get('aurel_palette_artwork_v1'),'on');
x.app.player.track.image.large='cover-B';
x.ctx.drawOverlay();
assert.equal(x.values.get('--aurel-theme-accent'),'#D5D7DB',
 'When a new track starts, show neutral color until its actual pixels arrive');
x.win.AurelCoverPalette('cover-A','#241019','#37202a','#FF0000','#FF0000','#FF0000','#FF0000');
assert.equal(x.values.get('--aurel-theme-accent'),'#D5D7DB',
 'A delayed palette callback for the old track cannot tint the new album');
x.win.AurelCoverPalette('cover-B','#0C1D1F','#244143','#9ADEDC','#53E1CF','#77BEB6','#5CB4E2');
assert.equal(x.values.get('--aurel-theme-accent'),'#9ADEDC');
assert.equal(x.values.get('--aurel-global-glow-one'),'#53E1CF');
x.win.AurelTheme.setArtworkPalette(false);
assert.equal(x.attrs.get('data-aurel-palette'),'mono');
assert.equal(x.values.get('--aurel-theme-bg'),'#111214');
assert.equal(x.values.get('--aurel-global-glow-one'),'#82878D');
assert.equal(x.initial.get('aurel_palette_artwork_v1'),'off');
const y=fixture('on');
assert.equal(y.attrs.get('data-aurel-palette'),'artwork','Saved preference survives restarts');
console.log('AUREL 1.1.92: full-screen album opt-in/off, clean icon system, unchanged audio, no stale colors, nav and borderless player PASS');
