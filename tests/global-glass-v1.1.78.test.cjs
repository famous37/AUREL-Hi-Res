'use strict';
/* Regression gates for the user-approved whole-app visual unification.
 * Content/style only: no Qobuz credentials or device needed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(__dirname+'/../'+p,'utf8');
const base='app/src/main/assets/';
const css=read(base+'aurel-gesture-safe.css');
const theme=read(base+'aurel-live-ui.js');
const html=read(base+'index.html');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');

assert(html.includes('href="aurel-gesture-safe.css"'));
assert.equal(html.lastIndexOf('<link rel="stylesheet"'),
 html.indexOf('<link rel="stylesheet" href="aurel-gesture-safe.css">'),
 'the shared design system must win over old CSS skins');
for(const rule of [
 ':root[data-aurel-palette] .app::after{',
 'var(--aurel-native-navigation-inset,0px)',
 'var(--aurel-seam-bg,#111214) 65%,transparent',
 'pointer-events:none',
 'z-index:80',
 'z-index:90!important',
 ':root[data-aurel-palette] .app .bottom-nav{',
 ':root[data-aurel-palette] .app .bottom-nav button.active',
 '.app:has(.mini:not(.hidden)) .main',
 'var(--aurel-mini-height,72px) + 38px',
 '.app .mini:not(.hidden){',
 '.murglar-view .murglar-track-data{',
 'margin-top:clamp(18px,2.15dvh,26px)',
 'margin-top:12px!important',
 '.murglar-view .murglar-quick-actions',
 'svg.ui-icon',
 'stroke-width:2.3!important',
 '.app #screen .track :is(',
 'width:44px!important;height:44px!important',
 '.app #screen .cover',
 '.tab.active,.chip.selected,.view-switch button.active',
 'prefers-reduced-motion:reduce',
 'data-aurel-motion="off"'
])assert(css.includes(rule),'Missing unified layout rule: '+rule);
assert(css.includes(':root[data-aurel-palette="artwork"] .app{'),
 'global background must derive from playing cover when opt-in enabled');
assert(css.includes('--aurel-seam-accent,#d5d7db'),
 'shared navigation and library controls need the same active colour token');
assert(theme.includes("artworkPalette?'artwork':'mono'"),
 'monochrome must stay explicitly reversible');
assert(theme.includes('themeByCover.get(next)||baseTheme'),
 'palette must be based on the current track and have a neutral fallback');
assert(theme.includes('setTheme(artworkPalette?(themeByCover.get(next)||baseTheme):baseTheme)'),
 'global theme must never turn on implicitly');
assert(native.includes('getWindow().setNavigationBarColor(Color.TRANSPARENT)'),
 'Android home gesture indicator must show app background');
assert(native.includes('systemInsetBottom/density'),
 'native gesture inset must not be used as raw CSS physical pixels');
assert(!/transition\\s*:\\s*all\\s*!important/.test(css),
 'never animate geometry in the finished player');
assert.equal((css.match(/\\{/g)||[]).length,(css.match(/\\}/g)||[]).length,
 'responsive CSS blocks must stay balanced');
console.log('AUREL unified global artwork/mono chrome, library icons, gesture glass, player separation PASS');
