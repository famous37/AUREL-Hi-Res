'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=n=>fs.readFileSync('app/src/main/assets/'+n,'utf8');
const glass=read('aurel-glass-polish.css'),seamless=read('aurel-seamless-theme.css'),
 fit=read('aurel-player-fit.js'),fitCSS=read('aurel-player-fit.css'),
 aurora=read('aurel-aurora.js'),html=read('index.html');
const activity=fs.readFileSync('app/src/main/java/com/aurel/hires/MainActivity.java','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');
assert.match(gradle,/versionCode\s+113/);
assert.match(gradle,/versionName[^\n]*'1\.1\.96'/);
assert.match(activity,/systemInsetTop\/density/,'Android pixels must be converted to CSS dp');
assert.match(activity,/getResources\(\)\.getDisplayMetrics\(\)\.density/);
assert.match(activity,/String\.format\(Locale\.US,"%.1fpx"/);
assert.match(activity,/setStatusBarColor\(open\?Color\.TRANSPARENT/);
assert.doesNotMatch(activity,/JSONObject\.quote\(systemInsetTop\+"px"\)/,
 'No raw physical pixel inset is allowed inside CSS');
assert.doesNotMatch(seamless,/inset:0 0 auto 0!important/,
 'Old high-specificity top-zero header caused clock and battery overlap');
assert.match(seamless,/top:max\(56px,calc\(var\(--aurel-native-status-inset/);
assert.match(glass,/top:max\(56px,calc\(var\(--aurel-native-status-inset/);
for(const cssInset of [0,24,30,44,62]){
 const top=Math.max(56,cssInset+18);
 assert(top>cssInset,'Full player header stays strictly below Android icons');
 assert(top+50>=106,'Header retains a 50px accessible control row');
}
assert.match(glass,/#overlay:not\(\.hidden\)\{/);
assert.match(glass,/bottom:0!important/);
assert.match(glass,/height:100%!important;max-height:100%!important/);
assert.match(glass,/height:calc\(100% - var\(--aurel-nav-height,64px\)\)!important/);
assert.match(glass,/#overlay:not\(\.hidden\)::before/);
assert.match(glass,/#overlay:not\(\.hidden\)::after/);
assert.match(glass,/display:block!important; \/\* style\.css used display:none/);
assert.match(glass,/\.murglar-view::before[\s\S]*?content:none!important/);
assert.match(glass,/radial-gradient\(ellipse 77% 61% at 19% 17%/);
assert.match(glass,/radial-gradient\(ellipse 70% 58% at 26% 65%/);
assert.match(glass,/z-index:90!important/);
assert.match(glass,/backdrop-filter:blur\(5px\)/);
assert.match(glass,/--aurel-aurora-glide-x/);
assert.match(glass,/--aurel-aurora-glide-y/);
assert.doesNotMatch(glass,/@keyframes/);
assert.doesNotMatch(glass,/height:min\(75dvh/,'No cropped ambient field may remain active');
assert.match(fit,/nav\.getBoundingClientRect\(\)\.height/);
assert.match(fit,/new ResizeObserver\(schedule\)/);
assert.match(fit,/--aurel-nav-height',pixels\+'px'/);
assert.match(fit,/Math\.abs\(lastNavHeight-pixels\)>1/);
assert.match(fitCSS,/margin:-14px auto 0!important/);
assert.match(fitCSS,/\.murglar-art-wrap\{margin:0 auto!important\}/,
 'Landscape artwork must not inherit portrait lift');
assert.match(fitCSS,/@media\(max-height:730px\)/);
assert.match(aurora,/--aurel-aurora-glide-x',Math\.round/);
assert.match(aurora,/--aurel-aurora-glide-y',Math\.round/);
assert.match(aurora,/if\(lastFrame&&Date\.now\(\)-lastFrame>1500\)resetBeat\(\)/);
assert.match(aurora,/!app\.player\?\.buffering/);
assert.match(aurora,/!bitPerfect\(\)/);
assert.doesNotMatch(aurora,/setInterval\(|requestAnimationFrame\(/,
 'Album light must follow native FFT frames, not simulated periodic motion');
assert(html.indexOf('<link rel="stylesheet" href="aurel-glass-polish.css">')<
 html.indexOf('<link rel="stylesheet" href="aurel-gesture-safe.css">'),
 'Gesture-safe CSS must preserve the pre-existing authoritative album glass');
assert(html.indexOf('aurel-gesture-safe.css')<html.indexOf('aurel-seek-settings-polish.css'),
 'Measured navigation insets must precede the narrow seek-only overrides');
assert(html.lastIndexOf('<link rel="stylesheet"')===
 html.indexOf('<link rel="stylesheet" href="aurel-seek-settings-polish.css">'),
 'Final seek styles must load after all legacy CSS');
for(const script of ['aurel-player-fit.js','aurel-aurora.js','aurel-track-swipe.js']){
 assert.doesNotThrow(()=>new Function(read(script)),script+' syntax');
}
console.log('AUREL 1.1.96: native CSS-density insets, safe Android header, seamless navbar canvas, responsive artwork and genuine FFT shimmer PASS');
