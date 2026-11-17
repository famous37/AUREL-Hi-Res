'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..', 'app', 'src', 'main', 'assets');
const read = name => fs.readFileSync(path.join(base, name), 'utf8');
const css = read('aurel-minimal-player.css');
const html = read('index.html');
const nav = read('aurel-live-ui.js');
const player = read('murglar.js');

// This stylesheet must be last: preserve all earlier palettes and fit rules.
assert(html.includes('href="aurel-minimal-player.css"'));
assert(html.indexOf('aurel-minimal-player.css') > html.indexOf('aurel-release.css'));

// Five actions + five tabs, same-square hit targets and consistent glyphs.
assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))!important'));
assert(css.includes('--aurel-icon-control:clamp(44px,12.6vw,54px)'));
assert(css.includes('.murglar-quick-actions button > span'));
assert(css.includes('.bottom-nav button .aurel-tab-label'));
assert(css.includes('display:none!important'));
assert(css.includes('width:24px!important'));
assert(css.includes('height:24px!important'));
assert(css.includes('.aurel-nav-cover'));

// Visual-only captions must not remove accessible names.
assert(nav.includes('aria-label="'));
assert(nav.includes("'+entry[1]+'"));
assert(nav.includes('data-open-player-nav'));
assert(nav.includes('data-nav='));

// Do not remove or replace playback, queue, favourites or sharing hooks.
for (const token of [
  'data-player-sheet="upnext"', 'data-player-sheet="credits"',
  'data-player-sheet="audio"', 'data-like-track=',
  'data-aurel-share-kind="track"', 'data-full-toggle',
  'data-shuffle', 'data-repeat', 'data-prev', 'data-next',
  'data-open-playing-album'
]) assert(player.includes(token), 'Missing player action: '+token);

// Keep layout still during frequent stream/progress re-rendering.
assert(!/transition\s*:\s*(?:all|height|width|transform)/i.test(css));
assert(!/animation\s*:\s*aurel-/i.test(css));
console.log('AUREL icon-only player source invariants PASS');
