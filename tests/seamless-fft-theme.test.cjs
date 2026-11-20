'use strict';
/* Regression gates for the 1.1.89 physical-device screenshot and JS error log. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync('app/src/main/assets/'+p,'utf8');
const app=read('app.js'),modern=read('modern.js');
const aurora=read('aurel-aurora.js'),rhythm=read('aurel-cover-rhythm.js');
const theme=read('aurel-live-ui.js'),css=read('aurel-seamless-theme.css');
const index=read('index.html'),native=fs.readFileSync('app/src/main/java/com/aurel/hires/MainActivity.java','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');
assert.match(gradle,/versionCode\s+106/);
assert.match(gradle,/versionName[^\n]*'1\.1\.89'/);
assert(app.indexOf('const ic=')>=0&&app.indexOf('const ic=')<app.indexOf('window.AurelEvent='),
  'Icon helper must exist before native can emit the first player event');
assert(app.indexOf('const aurelPlaybackIcon=')<app.indexOf('window.AurelEvent='),
  'Playback icon helper must exist before early player notifications');
assert.doesNotMatch(modern,/const ic=/,'Do not redeclare a global lexical icon helper');
assert.match(native,/typeof window\.AurelEvent==='function'/,'Native app events must be safe before JS load');
assert.match(native,/void onPageFinished\(/,'Artwork palette must replay after asset scripts load');
assert.match(native,/setWindowPalette\(String color\)/,'OS bar backing must follow selected theme');
assert.match(theme,/setWindowPalette\?\.\(colors\.bg\)/,'UI sends active verified dark palette');
assert.match(theme,/cachedPalette:url=>themeByCover\.get\(url\)/,'Artwork cache survives script startup');
assert.match(theme,/window\.AurelAurora\?\.refresh\?\.\(\)/,'Preference changes must refresh existing player');
assert.match(aurora,/artworkMode!==lastPaletteMode/,'Toggle applies even without changing cover');
assert.match(aurora,/wantCapture\(askPermission\)/,'Explicit glow opt-in must retry Android permission');
assert.match(aurora,/kind==='appResume'/,'Android foreground must resync animation');
assert.match(rhythm,/kind==='appResume'/,'Android foreground must resync FFT capture');
assert.match(aurora,/!motionAllowed\(\)\|\|bitPerfect\(\)/,'Never invent beats in bit-perfect');
assert.match(index,/aurel-universal-borderless\.css[^\n]*aurel-seamless-theme\.css/,
  'Seamless theme must override older fixed-color legacy styles');
assert.match(css,/#overlay:not\(\.hidden\) \.murglar-view/);
assert.match(css,/\.bottom-nav/);
assert.match(css,/data-aurel-palette="artwork"/);
assert.match(css,/data-aurel-palette="mono"/);
assert.match(css,/\.aurel-settings-group/);
assert.match(css,/\.aurel-error-panel/);
assert.match(css,/\.quality\.selected/);
assert.match(css,/pointer-events:none!important/,'Ambient layer must not block controls');
assert.doesNotMatch(css,/@keyframes|animation\s*:\s*infinite/,
  'Palette decoration must not replace real FFT with a fake rhythm');
new Function(app);new Function(modern);new Function(aurora);new Function(rhythm);new Function(theme);
console.log('AUREL 1.1.89 bridge, native bars, palette, FFT and CSS regression PASS');
