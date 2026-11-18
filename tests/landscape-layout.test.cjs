'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync('app/src/main/assets/'+p,'utf8');
const css=read('aurel-landscape.css');
const html=read('index.html');
const fit=read('aurel-player-fit.js');
const source=read('murglar.js');
const nav=read('aurel-bold-controls.css');

assert(css.trim().startsWith('/* AUREL 1.1.57'));
assert.equal((css.match(/@media\s*\(orientation:landscape\)\s*and\s*\(min-width:600px\)/g)||[]).length,2);
assert(!css.includes('@media (orientation:portrait)'), 'Portrait must use unchanged existing CSS');
assert(html.includes('<link rel="stylesheet" href="aurel-bold-controls.css"><link rel="stylesheet" href="aurel-landscape.css">'),
 'The isolated landscape stylesheet must load last');
assert(fit.includes("window.matchMedia('(orientation:landscape) and (min-width:600px)').matches"),
 'Portrait artwork-fit must not reapply while landscape grid is active');
assert(css.includes('grid-template-areas:'));
for(const area of ['cover metadata','cover actions','cover timeline','cover transport','cover source']){
 assert(css.includes('"'+area+'"'),area+' missing from grid areas');
}
for(const selector of ['.murglar-player-content','.murglar-art-wrap','.murglar-track-data',
 '.murglar-quick-actions','.murglar-progress-row','.murglar-transport','.murglar-source-line',
 '.murglar-header.aurel-listening-nav']){
 assert(css.includes(selector),'Missing actual Now Playing selector '+selector);
 assert(source.includes(selector.replace(/^\./,'').split('.')[0]) ||
   selector.includes('murglar-header') && source.includes('murglar-header') ||
   selector.includes('murglar-player-content') && source.includes('murglar-player-content'),
   'Not part of current player markup '+selector);
}
assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))!important'));
assert(css.includes('minmax(0,1fr)!important'));
assert(css.includes('overflow-y:auto!important'));
assert(css.includes('grid-column:2!important'));
assert(css.includes('grid-row:3!important'));
assert(css.includes('position:static!important'));
assert(css.includes('min-height:0!important'));
assert(css.includes('overscroll-behavior:contain!important'));
assert(css.includes('font-size:clamp(18px,2.6vw,26px)!important'));
assert(css.includes('var(--aurel-land-small)!important'));
assert(css.includes('var(--aurel-land-main)!important'));
assert(css.includes('var(--aurel-land-nav)'));
assert(css.includes('width:min(calc(100% - 24px),1000px)!important'));
assert(css.includes('(max-height:350px)'));
assert(css.includes('.aurel-recovery-inline'));
assert(css.includes('.aurel-detail-drawer'));
assert(source.includes('murglar-detail-sheet'));
assert(nav.includes('--aurel-small-control'),'Existing portrait control token must remain in place');
assert(!css.includes('murglar-quick-actions > button.aurel-share-control > svg.ui-icon {\n   width:24px'),
 'Share icon must not shrink to 24px');
assert(css.includes('> button.aurel-share-control > svg.ui-icon'));
assert(css.includes('width:29px!important'));
const nOpen=(css.match(/\{/g)||[]).length,nClose=(css.match(/\}/g)||[]).length;
assert.equal(nOpen,nClose,'Balanced CSS braces');
console.log('AUREL 1.1.57 isolated landscape media queries, two-column player, portrait guard and responsive controls PASS');
