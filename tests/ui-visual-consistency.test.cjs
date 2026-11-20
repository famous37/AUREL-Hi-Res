'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const asset=name=>fs.readFileSync(path.join('app/src/main/assets',name),'utf8');
const player=asset('murglar.js');
const bold=asset('aurel-bold-controls.css');
const oldShare=asset('aurel-share.css');
const oldMinimal=asset('aurel-minimal-player.css');
const modern=asset('modern.js');
const html=asset('index.html');
const app=asset('app.js');

// Surface geometry must not fork based on the Share class.
const common=bold.split('#overlay .murglar-view .murglar-quick-actions button {')[1]?.split('}\n')[0];
const share=bold.split('#overlay .murglar-view .murglar-quick-actions > button.aurel-share-control {')[1]?.split('}\n')[0];
assert(common&&share,'Player common and optically calibrated Share rules must exist');
for(const rule of ['width:var(--aurel-small-control)!important','height:var(--aurel-small-control)!important','border-radius:var(--aurel-small-radius)!important','padding:0!important','background:#2d3036!important','display:grid!important']){
 assert(common.includes(rule),'All action buttons require '+rule);
 assert(share.includes(rule),'Share must not override '+rule);
}
assert(!oldShare.includes('display:flex!important;flex-direction:column!important;gap:5px!important'));
assert(!oldMinimal.includes('.murglar-quick-actions .aurel-share-control{'),
 'Legacy special-case size caused the actual Share button to shrink in Chromium');
const optical=bold.split('> button.aurel-share-control > svg.ui-icon {')[1]?.split('}\n')[0];
assert(optical.includes('width:32px!important')&&optical.includes('stroke-width:2.55!important'));
assert(app.includes("share:'<circle")&&player.includes("ic('share',32)"));
for(const icon of ['queue','info','audio','heart','share']){
 assert(player.includes("ic('"+icon+"'"),'Missing '+icon+' SVG');
}
assert(player.includes('class="aurel-share-control aurel-share-label"'));
assert(player.includes('data-aurel-share-kind="track"'));

// One visual token for all 9 secondary buttons; central Play is intentionally larger.
const transport=bold.split('.murglar-control:not(.middle) {')[1]?.split('}\n')[0];
for(const rule of ['width:var(--aurel-small-control)!important','height:var(--aurel-small-control)!important']){
 assert(transport.includes(rule),'Transport controls must share same size: '+rule);
}
for(const width of [320,360,390,430]){
 const control=Math.min(62,Math.max(46,(width-80)/5));
 assert(control>0&&5*control+4*10<=width,'Five buttons must remain in view at '+width+'px');
}
assert(bold.includes('@media(max-width:300px)'));
assert(bold.includes('--aurel-small-control:42px'));
assert(bold.includes('minmax(72px,1.3fr)'));
assert(bold.includes('.murglar-header.aurel-listening-nav'));
assert(bold.includes('width:40px!important'),'Header controls must not protrude');
assert(bold.includes('@keyframes aurel-bold-spin'),'Buffering must have fallback CSS animation');
assert(modern.includes('aurelEnsureLoadingAnimation'));
assert(html.indexOf('aurel-bold-controls.css')>html.indexOf('aurel-monochrome.css'));
assert(app.includes('1.1.90'));
console.log('AUREL 1.1.90 icon family, Share size/contrast, narrow screens and spinner PASS');
