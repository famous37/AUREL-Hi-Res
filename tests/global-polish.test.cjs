'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../app/src/main/assets');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const html=read('index.html'), css=read('aurel-global-polish.css');
const motion=read('aurel-motion.js'),swipe=read('aurel-swipe-minimize.js');
const app=read('app.js'),murglar=read('murglar.js');
const discography=read('aurel-discography.js');
const styles=html.match(/<link rel="stylesheet" href="([^"]+)"/g)||[];
assert(styles.some(s=>s.includes('href="aurel-global-polish.css"')),
 'Global typography and motion stylesheet must remain loaded.');
assert(html.indexOf('aurel-global-polish.css')<html.indexOf('aurel-precision-ui.css'),
 'The precision icons layer must be loaded after the global typography layer.');
assert(html.indexOf('aurel-global-polish.css')>html.indexOf('aurel-icon-contrast.css'));
const screens=[
 'page-heading h1','aurel-settings-heading h1','aurel-artist-section-heading h2',
 '.album-title','.track-title','.artist-text strong','.playlist-entry strong',
 '.aurel-release-card strong','.album-artist','.track-meta','.sectionhead p',
 '.subline','.empty','.loading','.aurel-live-results-status',
 '.aurel-signin-subtitle','.field','.aurel-detail-drawer'
];
for(const x of screens)assert(css.includes(x),'Missing typography coverage: '+x);
for(const x of ['.screen button','.sidebar button','.bottom-nav button',
 '#overlay .murglar-view button','.screen svg.ui-icon','.aurel-share-control svg',
 '.aurel-favourite-control','.app .mini','.aurel-tab-icon svg',
 'stroke-width:2.45!important','stroke-width:2.5!important',
 'shape-rendering:geometricPrecision'])
 assert(css.includes(x),'Missing icon/button coverage: '+x);
assert(!/background-image\s*:\s*url\(/.test(css),'Do not rasterize icons');
assert(!/transition\s*:\s*all\b/.test(css),'Do not animate layout-wide properties');
assert(!/transition\s*:[^;]*(width|height|padding|margin|font-size)/.test(css),
 'Never animate element dimensions or typography');
assert(css.includes('prefers-reduced-motion:reduce'));
assert(css.includes('.aurel-token-input button:active'));
assert(css.includes('#overlay.aurel-swipe-dismissing .murglar-view'));
assert(css.includes('pointer-events:none!important'));
assert(motion.includes('duration:265')&&motion.includes('opacity:.82'));
assert(motion.includes('previous===next'));
assert(motion.includes('document.hidden||app.overlay'));
assert(swipe.includes("if(accepted)dismiss()"));
assert(swipe.includes("if(app.overlay)closePage()"));
assert(swipe.includes("window.AurelMinimizePlayer"));
assert(murglar.includes('murglar-progress-row'));
assert(app.includes('renderSearch')&&app.includes('renderSettings'));
assert(discography.includes('artist'),'Artist library modules remain loaded');
console.log('AUREL global typography, icon weights, route motion and swipe invariants PASS');
