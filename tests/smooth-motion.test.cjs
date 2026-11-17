/* AUREL v1.1.29 smooth-motion regression: not connected to real Qobuz. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=source('app/src/main/assets/aurel-smooth.css');
const motion=source('app/src/main/assets/aurel-motion.js');
const fit=source('app/src/main/assets/aurel-player-fit.js');
const live=source('app/src/main/assets/aurel-live-ui.js');
const fav=source('app/src/main/assets/aurel-favourites.js');
const share=source('app/src/main/assets/aurel-share.js');
const murglar=source('app/src/main/assets/murglar.js');
const html=source('app/src/main/assets/index.html');
const gradle=source('app/build.gradle');
assert(gradle.includes('versionCode 48')&&gradle.includes("'1.1.29'"));
assert(html.includes('<link rel="stylesheet" href="aurel-smooth.css">'));
assert(html.indexOf('aurel-smooth.css')<html.indexOf('aurel-release.css'));
assert(html.includes('<script src="aurel-motion.js"></script>'));
assert(html.indexOf('aurel-graphite.css')<html.indexOf('aurel-smooth.css'));
assert(html.indexOf('aurel-share.css')<html.indexOf('aurel-smooth.css'));
assert(html.indexOf('aurel-share.js')<html.indexOf('aurel-motion.js'));
for(const marker of ['#screen > .panel','#screen > .aurel-artist-page',
 '#overlay .aurel-detail-drawer','animation:none!important',
 'transform:none!important','background-color .12s ease-out',
 '#overlay .murglar-cover','prefers-reduced-motion:reduce'])
 assert(css.includes(marker),'Missing motion stabilization: '+marker);
assert(fit.includes('observed=view')&&fit.includes('observer.observe(view)'),
 'ResizeObserver must watch stable viewport, not fit content');
assert(!fit.includes('observer.observe(content)'),'Content resize feedback-loop reintroduced');
assert(fit.includes('Math.abs(previous-pixel)>2'),'Fractional cover jitter guard missing');
assert(murglar.includes('data-aurel-share-kind="track"'),'Player share slot should be present at initial render');
assert(murglar.includes('class="aurel-share-control aurel-share-label"'));
assert(fav.includes('change.addedNodes').toString()&&fav.includes('n.nodeType===1'),
 'Favourites observer should ignore timer-only text mutations');
assert(share.includes('change.addedNodes')&&share.includes('n.nodeType===1'),
 'Sharing observer should ignore timer-only text mutations');
assert(live.includes("b.classList.contains('active')!==active"),
 'Navigation should skip stable state updates on playback ticks');
for(const file of [motion,fit,fav,share,murglar,live])new Function(file);
// Simulate same-route rerender, navigation, artist metadata refresh and
// accessibility reduced-motion without DOM or Qobuz credentials.
let reduced=false,animations=[],cancels=0;
const screen={animate(frames,opts){
 animations.push({frames,opts});
 return {cancel(){cancels++;}};
}};
const app={nav:'home',selected:null,selectedKind:'',loginMode:'token',session:{streamConnected:true}};
const noop=()=>{};
const ctx=vm.createContext({
 app,document:{getElementById(id){return id==='screen'?screen:null;}},
 window:{matchMedia(){return {matches:reduced};}},
 hasAuth(){return !!app.session?.streamConnected;},
 render:noop,renderArtist:noop,renderSearch:noop,
 renderLibrary:noop,renderSettings:noop,console
});
vm.runInContext(motion,ctx,{filename:'aurel-motion.js'});
ctx.render();
assert.equal(animations.length,0,'Initial load must not animate');
for(let i=0;i<15;i++){ctx.render();ctx.renderLibrary();}
assert.equal(animations.length,0,'Repeated catalogue/library redraw must not animate');
app.nav='library';ctx.render();
assert.equal(animations.length,1,'One animation for one route change');
assert.equal(animations[0].opts.duration,190);
for(let i=0;i<20;i++)ctx.renderLibrary();
assert.equal(animations.length,1,'Data updates should not replay animations');
app.selected={id:'1234'};app.selectedKind='artist';ctx.renderArtist();
assert.equal(animations.length,2,'Artist navigation should trigger one fade');
ctx.renderArtist();ctx.render();
assert.equal(animations.length,2,'Artist extras must not replay animation');
app.selected={id:'3456'};app.selectedKind='album';ctx.render();
assert.equal(animations.length,3,'Opening an album may fade');
assert.equal(cancels,2,'Previous route animation should be cancelled');
reduced=true;app.nav='settings';app.selected=null;app.selectedKind='';ctx.renderSettings();
assert.equal(animations.length,3,'System reduced motion must be respected');
reduced=false;app.nav='search';ctx.renderSearch();
assert.equal(animations.length,4,'Normal motion can resume after reduced motion');
console.log('AUREL smooth-motion checks passed: stable player viewport, no repeat fade, route-only opacity, reduced motion, no timer DOM scans.');
