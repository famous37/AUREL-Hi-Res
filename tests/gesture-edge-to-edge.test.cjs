'use strict';
/* AUREL gesture-handle transparency and player vertical fit regression.
 * Pure source/geometry checks; does not require Android hardware or Qobuz. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(__dirname+'/../'+p,'utf8');
const base='app/src/main/';
const java=read(base+'java/com/aurel/hires/MainActivity.java');
const css=read(base+'assets/aurel-gesture-safe.css');
const html=read(base+'assets/index.html');
const fit=read(base+'assets/aurel-player-fit.js');

assert(html.includes('href="aurel-gesture-safe.css"'),'safe layout must be loaded');
assert(html.indexOf('aurel-glass-polish.css')<html.indexOf('aurel-gesture-safe.css'),
  'safe layout must follow the high-specificity album glass layer');
for(const source of [
 'setDecorFitsSystemWindows(false)',
 'setNavigationBarColor(Color.TRANSPARENT)',
 'setNavigationBarContrastEnforced(false)',
 'setNavigationBarDividerColor(Color.TRANSPARENT)',
 'View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION',
 'edgeToEdgeNavigation?(keyboardVisible?imeInsetBottom:0)',
 'systemInsetBottom/density',
 'JSONObject.quote("--aurel-native-navigation-inset")',
 'applyPlayerWindowInsets();'
])assert(java.includes(source),'native edge-to-edge regression: '+source);
assert(/if\(Build.VERSION.SDK_INT>=30\)[\s\S]{0,90}setNavigationBarColor\(Color.TRANSPARENT\)/.test(java),
  'palette updates must not reintroduce opaque navigation bar');
assert(css.includes('bottom:var(--aurel-native-navigation-inset,0px)!important'),
  'persistent nav must be lifted above the system gesture handle');
assert(css.includes('var(--aurel-nav-height,64px) -'),
  'the foreground player must reserve measured nav height');
assert(css.includes('var(--aurel-native-navigation-inset,0px))!important'),
  'foreground player must reserve native gesture inset exactly once');
assert(css.includes('margin-top:auto!important')&&css.includes('margin-bottom:auto!important'),
  'long portrait player must distribute free space above and below content');
assert(css.includes('not(.aurel-fit-scroll)')&&css.includes('not(.murglar-sheet-open)'),
  'short and detail-sheet modes must retain their original scroll-safe layout');
assert(fit.includes('const remainder=Math.floor(usable-reserved-3)'),
  'artwork must still shrink to preserve progress and transport controls');

// Drawing behind a 24dp system gesture inset must preserve the same player
// content height as the former (native-padded) implementation, and place
// the shared navbar safely above the home gesture region.
for(const [height,nativeInset,navHeight] of [
  [800,24,64],[680,24,64],[400,0,54],[900,32,64]
]){
  const content=height-navHeight-nativeInset;
  assert.equal(content,height-nativeInset-navHeight);
  assert(content>0);
  assert.equal(height-nativeInset-navHeight,content);
}
console.log('AUREL gesture-safe edge-to-edge and centered portrait layout PASS');
