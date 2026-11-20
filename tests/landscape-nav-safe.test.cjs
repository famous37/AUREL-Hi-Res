'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='app/src/main/assets/';
const read=name=>fs.readFileSync(base+name,'utf8');
const css=read('aurel-landscape-nav.css');
const html=read('index.html');
const legacy=read('aurel.css');
const player=read('aurel-landscape.css');
const tabs=read('aurel-live-ui.js');

assert(legacy.includes('.app .bottom-nav button span{display:grid;place-items:center;line-height:1;min-height:27px}'),
 'Root cause must remain documented: legacy 27px span minimum');
assert(css.includes('/* AUREL 1.1.58'));
assert(css.includes('@media (orientation:landscape) {'));
assert(!css.includes('@media (orientation:portrait)'));
assert(!css.includes('@media(max-width:820px)'));
const last=html.lastIndexOf('<link rel="stylesheet"');
assert(html.slice(last).startsWith('<link rel="stylesheet" href="aurel-seek-settings-polish.css">'),
 'Final seek/typography layer must load after proven landscape geometry');
assert(html.indexOf('aurel-gesture-safe.css')<html.indexOf('aurel-seek-settings-polish.css'),
 'Final seek styles must preserve existing gesture-safe geometry');
assert(html.indexOf('aurel-glass-polish.css')<html.indexOf('aurel-gesture-safe.css'),
 'Gesture-safe rules must not replace the established album glass');
assert(html.indexOf('aurel-landscape-nav.css')<html.indexOf('aurel-universal-borderless.css'));
assert(html.indexOf('aurel-universal-borderless.css')<html.indexOf('aurel-seamless-theme.css'));
assert(html.indexOf('aurel-seamless-theme.css')<html.indexOf('aurel-glass-polish.css'));
assert(!read('aurel-glass-polish.css').includes('grid-template-rows:'),'Glass styling cannot change landscape navigation grid');
assert(!read('aurel-universal-borderless.css').includes('grid-template-rows:'),
 'Final borderless layer must not damage landscape navigation grid');
assert(html.indexOf('aurel-landscape.css')<html.indexOf('aurel-landscape-nav.css'));
assert(player.includes('--aurel-land-nav:'),'Retain established landscape player hierarchy');
assert(tabs.includes("aria-label=") && tabs.includes('aurel-tab-label') && tabs.includes('aria-hidden="true"'),
 'Short landscape may visually hide captions but tab buttons must retain explicit accessible labels');
for(const p of [
 'grid-template-rows:26px 14px!important',
 'display:grid!important',
 'align-content:center!important',
 'min-height:0!important',
 'max-height:14px!important',
 'line-height:1.15!important',
 'font-size:clamp(10px,1.3vw,12px)!important',
 'height:min(48px,calc(100% - 2px))!important',
 'width:25px!important',
 'height:25px!important',
 'overflow:hidden!important',
 'overflow:visible!important',
 'outline-offset:-3px!important',
 '(max-height:350px)',
 '(max-width:599px)',
 'grid-template-rows:27px!important',
 'display:none!important',
 'prefers-reduced-motion:reduce',
 'transition:none!important'
])assert(css.includes(p),'Missing landscape nav protection '+p);
const body=css.slice(css.indexOf('@media (orientation:landscape) {'));
const transitions=body.match(/transition:[^;]+;/g)||[];
assert(transitions.length>=2,'Nav and player controls need paint-only transitions');
for(const t of transitions){
 assert(!/transform|width|height|margin|padding|top|left|bottom|right/.test(t),
  'Never animate dimensions, positioning or scale: '+t);
}
const opens=(css.match(/\{/g)||[]).length,closes=(css.match(/\}/g)||[]).length;
assert.equal(opens,closes,'Balanced landscape CSS blocks');
console.log('AUREL landscape navbar clipping, accessible labels, reduced-motion and paint-only transitions PASS');
