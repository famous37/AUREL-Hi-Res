'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
const text=(file)=>fs.readFileSync(path.join(base,file),'utf8');
const assets='app/src/main/assets/';
const html=text(assets+'index.html');
const css=text(assets+'aurel-clarity.css');
const settings=text(assets+'aurel-settings-pro.js');
const groups=text(assets+'aurel-settings-groups.js');
const motion=text(assets+'aurel-motion.js');
const swipe=text(assets+'aurel-swipe-minimize.js');
const locale=text(assets+'aurel-language.js');
const foreground=text('app/src/main/res/drawable/aurel_launcher_foreground.xml');
const mono=text('app/src/main/res/drawable/aurel_launcher_monochrome.xml');
const gradle=text('app/build.gradle');
assert(/versionCode\s+78/.test(gradle) && gradle.includes("'1.1.59'"));
assert(html.includes('aurel-clarity.css') &&
 html.indexOf('aurel-clarity.css')>html.indexOf('aurel-settings-groups.css'));
assert(css.includes('stroke-width:2.8!important') &&
 css.includes('font-weight:800!important') &&
 css.includes('--aurel-clarity-accent'));
for(const section of ['Audio outputs','Playback','Accounts & library','Appearance & app'])
 assert(groups.includes(section),'Missing functional group '+section);
assert(groups.includes('aurel-group-icon') && groups.includes('glyphs[id]'));
for(const phrase of ['Audio engine limits','Gapless:','PEQ, Crossfeed and FIR:',
 'Reported rates are not measured output rates.',
 'Active Bluetooth codec / bitrate: unavailable to standard Android apps'])
 assert(!settings.includes(phrase),'Remove verbose setting: '+phrase);
assert(settings.includes('data-aurel-scan-dac') && settings.includes('audioDiagnostics'));
assert(settings.includes('data-aurel-headroom') && settings.includes('data-aurel-preload'));
assert(settings.includes('aurel-pro-disclosure'), 'Keep optional source inspector');
assert(motion.includes("previous===next"),'No animation on same route');
assert(motion.includes('duration:190'), 'Ease real navigation');
assert(swipe.includes('move=Math.min(320'), 'Swipe must follow pointer');
assert(swipe.includes("closest?.('[data-close-overlay]')"), 'Collapse button must animate');
assert(swipe.includes('window.AurelMinimizePlayer()'), 'Must preserve original navigation and scroll');
assert(foreground.includes('android:viewportWidth="108"') && foreground.includes('android:strokeColor="#FFFFFFFF"'));
assert(foreground.includes('android:strokeLineCap="round"'));
assert(mono.includes('#FFFFFFFF'));
assert(!foreground.includes('aurel_launcher_background'), 'Foreground should be resolution independent');
for(const key of ["'Audio outputs'","'Playback'","'Connected devices'",
 "'AVAILABLE'","'Refresh outputs'","'App updates'","'What’s new'"])
 assert(locale.includes(key),'Missing Ukrainian translation for '+key);
assert(locale.includes('var rates=/^Android rates:'), 'Dynamic sample rates must translate');
new Function(motion);new Function(swipe);new Function(locale);
console.log('AUREL 1.1.41 contrast, clean settings, adaptive icon, Ukrainian and smooth motion checks PASS');
