'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync('app/src/main/assets/'+name,'utf8');
const modern=read('modern.js');
const murglar=read('murglar.js');
const responsive=read('responsive.js');
const app=read('app.js');
const share=read('aurel-share.js');
const styles=read('aurel-bold-controls.css');
const olderShare=read('aurel-share.css');
const olderPlayer=read('aurel-minimal-player.css');
const html=read('index.html');

for(const name of ['modern.js','murglar.js','responsive.js','app.js','aurel-share.js'])
 assert.doesNotThrow(()=>new Function(read(name)),name+' must be valid JavaScript');
const begin=modern.indexOf('const aurelPlaybackMode=');
const end=modern.indexOf('const artistButton=',begin);
assert(begin>0&&end>begin,'Shared icon helpers must be defined before installed player overrides');
const context={window:{matchMedia:()=>({matches:false})}};
vm.runInNewContext(
 'const ic=(name,size)=>"<svg data-name="+name+">";\n'+modern.slice(begin,end)+
 '\nglobalThis.glyphTests={aurelPlaybackMode,aurelPlaybackIcon,aurelPlaybackLabel,aurelEnsureLoadingAnimation,aurelStopLoadingAnimation};',
 context);
const {aurelPlaybackMode,aurelPlaybackIcon,aurelPlaybackLabel,aurelEnsureLoadingAnimation,aurelStopLoadingAnimation}=context.glyphTests;
assert.equal(aurelPlaybackMode({buffering:true,playing:false}),'loading');
assert.equal(aurelPlaybackMode({buffering:true,playing:true}),'loading');
assert.equal(aurelPlaybackMode({buffering:true,error:'Unavailable',playing:false}),'play');
assert.equal(aurelPlaybackMode({playing:true,buffering:false}),'pause');
assert.equal(aurelPlaybackMode({playing:false,buffering:false}),'play');
assert.match(aurelPlaybackIcon({buffering:true},33),/class="aurel-spinner"/);
assert.match(aurelPlaybackIcon({playing:true},33),/data-name=pause/);
assert.equal(aurelPlaybackLabel({buffering:true}),'Loading audio');
assert(modern.includes('stroke-width="2.55"'),'SVG renderer should use bold outlines');
assert(modern.includes("share:'<circle"),'Share must belong to the vector family');
assert(share.includes("ic('share',24)"),'Supplemental share control should use shared icon');
assert(murglar.includes("ic('share',32)"),'Now Playing share should use shared icon');
assert(!murglar.includes('stroke-width="1.85"'),'No thin standalone icons on Now Playing');
assert(murglar.includes("const loading=aurelPlaybackMode(p)==='loading'"));
assert(murglar.includes('toggle.innerHTML=aurelPlaybackIcon(p,39)'));
assert(murglar.includes('toggle.dataset.icon=mode'),'Avoid rerendering primary button on each tick');
assert(murglar.includes('aria-busy='),'Loader requires accessible status');
assert(responsive.includes('toggle.innerHTML=aurelPlaybackIcon(p,26)'));
assert(responsive.includes('m.dataset.miniPlaying=state'),'Keep mini-player DOM stable on every tick');
assert(app.includes('aurelPlaybackIcon(p,33)'),'Fallback full player must also display spinner');
assert(app.includes('1.1.65'),'Settings must show correct version');
assert(/@keyframes aurel-bold-spin/.test(styles));
assert(/prefers-reduced-motion:reduce/.test(styles));
assert(/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/.test(styles));
assert(/\.murglar-control\.middle/.test(styles));
assert(/\.bottom-nav button .*svg\.ui-icon/.test(styles));
const boldAt=html.indexOf('<link rel="stylesheet" href="aurel-bold-controls.css">');
const monochromeAt=html.indexOf('<link rel="stylesheet" href="aurel-monochrome.css">');
const landscapeAt=html.indexOf('<link rel="stylesheet" href="aurel-landscape.css">');
assert(boldAt>monochromeAt && landscapeAt>boldAt,
 'Bold control styles should load after legacy themes, followed by landscape-only overrides');
// Confirm the requested spinner actually starts animating in WebView, even
// when theme CSS has animation:none!important. Avoid restarting it on ticks.
let spinStarts=0,spinStops=0,spinDuration=0,inlineDisabled=false;
const spinner={
 dataset:{},
 style:{setProperty:(key,value,priority)=>{inlineDisabled=key==='animation'&&value==='none'&&priority==='important';},removeProperty:()=>{}},
 animate:(frames,opts)=>{spinStarts++;spinDuration=opts.duration;
  assert.equal(opts.iterations,Infinity);
  assert.equal(frames[1].transform,'rotate(360deg)');
  return {cancel:()=>{spinStops++}};
 }};
const root={querySelectorAll:selector=>selector==='svg.aurel-spinner'?[spinner]:[]};
aurelEnsureLoadingAnimation(root);
assert.equal(spinStarts,1,'Spinner must start a real Web Animations rotation');
assert(inlineDisabled,'Legacy CSS rotation must not compete with Web Animations');
assert.equal(spinDuration,860);
aurelEnsureLoadingAnimation(root);
assert.equal(spinStarts,1,'Routine position events must not restart the animation');
aurelStopLoadingAnimation(root);
assert.equal(spinStops,1,'Removed player controls must cancel animations');
context.window.matchMedia=()=>({matches:true});
const reducedSpinner={...spinner,dataset:{}};
aurelEnsureLoadingAnimation({querySelectorAll:()=>[reducedSpinner]});
assert.equal(spinDuration,2400,'Reduced-motion spinner should spin more slowly');
assert(modern.includes('aurelEnsureLoadingAnimation(m)'));
assert(murglar.includes('aurelEnsureLoadingAnimation(overlay)'));
assert(murglar.includes('aurelEnsureLoadingAnimation(toggle)'));
assert(responsive.includes('aurelEnsureLoadingAnimation(m)'));
assert(styles.includes('box-sizing:border-box!important'),'Header dimensions must include padding and border');
assert(styles.includes('width:calc(100% - 28px)!important'),'Header must fit inside screen');
assert(styles.includes('grid-template-columns:42px minmax(0,1fr) 42px!important'));
assert(styles.includes('width:40px!important'),'Top controls need small fixed hit targets');
assert(styles.includes('padding:0!important'),'Top buttons cannot inherit oversized padding');
assert(styles.includes('border:0!important'),'Do not render a second border around top buttons');
assert(styles.includes('transform-box:view-box!important'),'SVG spinner should rotate around its own centre');
assert(styles.includes('animation:aurel-bold-spin 2.4s linear infinite!important'),
 'Reduced-motion must preserve slow functional loading feedback');
// All four secondary transport controls and all five action buttons must
// share the same responsive size token, regardless of per-button classes.
const shared='var(--aurel-small-control)!important';
const actions=styles.slice(styles.indexOf('#overlay .murglar-view .murglar-quick-actions button {'),styles.indexOf('#overlay .murglar-view .murglar-quick-actions button svg.ui-icon'));
const transport=styles.slice(styles.indexOf('#overlay .murglar-view .murglar-transport .murglar-control:not(.middle) {'),styles.indexOf('#overlay .murglar-view .murglar-transport .murglar-control:not(.middle) .ui-icon'));
for(const [name,block] of [['quick actions',actions],['transport',transport]]){
  assert(block.includes('width:'+shared),name+' width must use unified size');
  assert(block.includes('height:'+shared),name+' height must use unified size');
  assert(block.includes('min-width:0!important'),name+' must not overflow at narrow widths');
  assert(block.includes('padding:0!important'),name+' has no inherited button padding');
  assert(block.includes('aspect-ratio:1!important'),name+' remains square');
}
assert(styles.includes('--aurel-small-control:clamp(46px,calc((100vw - 80px)/5),62px)'));
assert(styles.includes('justify-items:center!important'),'Actions must be centered in five equal tracks');
// Keep the exact share button immune from all legacy CSS specificity.
assert(!olderPlayer.includes('.murglar-quick-actions .aurel-share-control{'),
 'Legacy player CSS must not add a separate Share control size');
assert(!olderShare.includes('display:flex!important;flex-direction:column!important;gap:5px!important;'),
 'Legacy Share CSS must not reapply a special overlay flex layout');
const shareSurface=styles.slice(styles.indexOf('#overlay .murglar-view .murglar-quick-actions > button.aurel-share-control {'));
assert(shareSurface.includes('width:var(--aurel-small-control)!important'));
assert(shareSurface.includes('height:var(--aurel-small-control)!important'));
assert(shareSurface.includes('border-radius:var(--aurel-small-radius)!important'));
assert(shareSurface.includes('background:#2d3036!important'));
assert(shareSurface.includes('display:grid!important'));
assert(shareSurface.includes('padding:0!important'));
assert(shareSurface.includes('width:32px!important'));
assert(shareSurface.includes('height:32px!important'));
assert(shareSurface.includes('width:29px!important'));
assert(shareSurface.includes('width:27px!important'));
assert(styles.includes('--aurel-small-control:42px'));
assert(styles.includes('gap:2px!important'), 'Ultra-narrow transport layout should not overlap');
assert(styles.includes('minmax(72px,1.3fr)'),'Small screens should retain a large central Play button');
console.log('Unified bold SVG icons, loading spinner, responsive player DOM PASS');
