'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=file('app/src/main/assets/index.html');
const css=file('app/src/main/assets/aurel-precision-ui.css');
const modern=file('app/src/main/assets/modern.js');
const app=file('app/src/main/assets/app.js');
const favorites=file('app/src/main/assets/aurel-favourites.js');
const share=file('app/src/main/assets/aurel-share.js');
const live=file('app/src/main/assets/aurel-live-ui.js');

for(const source of [modern,app,favorites,share,live])new Function(source);
assert(html.includes('<link rel="stylesheet" href="aurel-precision-ui.css">'));
assert(html.indexOf('aurel-precision-ui.css')>html.indexOf('aurel-global-polish.css'));

for(const name of ['search','library','settings','refresh','arrow-right','heart','play','plus','chevron']){
 assert(app.includes(name+':')||app.includes("'"+name+"':"),
  'Missing vector icon map entry: '+name);
}
assert(modern.includes("ic('arrow-right',27)"));
assert(modern.includes('class="aurel-search-leading"'));
assert(modern.includes('class="quicklink-icon"'));
assert(modern.includes("ic('library',27)"));
assert(modern.includes("ic('search',27)"));
assert(modern.includes("ic('refresh',25)"));
assert(modern.includes("ic('settings',26)"));
assert(!modern.includes('>⌕ <strong>Search catalogue</strong>'));
assert(!modern.includes('aria-label="Search">→</button>'));
assert(live.includes("glyph.innerHTML=ic(kind,23)"));

for(const selector of [
  '#searchForm.qsearch','.search-submit svg','.aurel-search-leading svg',
  '.quicklinks button','.quicklink-icon svg','.quicklinks strong',
  '.quicklinks small','.disclaimer','.track .track-title',
  '.track .track-meta','.aurel-track-action','.aurel-share-icon',
  '.albumhero .album-artist-button','.actionbar .pill',
  '.aurel-favourite-control svg','.aurel-is-favourite'
])assert(css.includes(selector),'Missing UI style coverage: '+selector);

for(const action of [
 'data-like-track','data-play-next','data-play-index',
 'data-play-all','data-like-album','data-artist-from-album','data-back'
])assert(app.includes(action),'Action missing after vector conversion: '+action);
for(const key of ["ic('heart',24)","ic('plus',24)","ic('play',25)",
 "ic('chevron',20)","ic('back',20)","ic('play',20)"])
 assert(app.includes(key),'Missing vector action: '+key);
assert(app.includes('aurel-save-label'));
assert(favorites.includes("b.innerHTML=ic('heart',24)"));
assert(favorites.includes("if(!b.querySelector('svg')"));
assert(favorites.includes("b.querySelector('.aurel-save-label')"));
assert(share.includes('data-aurel-share-kind'));

assert(css.includes('stroke-width:2.7!important'));
assert(css.includes('shape-rendering:geometricPrecision'));
assert(!/transition\s*:\s*all\b/.test(css));
assert(!/transition\s*:[^;]*(width|height|padding|margin|font-size)/.test(css));
assert(css.includes('@media(max-width:375px)'));
assert(css.includes('prefers-reduced-motion:reduce'));
console.log('AUREL precise icons/search/quicklinks/album track regression PASS');
