'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync('app/src/main/assets/'+name,'utf8');
const modern=read('modern.js');
const murglar=read('murglar.js');
const responsive=read('responsive.js');
const app=read('app.js');
const share=read('aurel-share.js');
const styles=read('aurel-bold-controls.css');
const html=read('index.html');

for(const name of ['modern.js','murglar.js','responsive.js','app.js','aurel-share.js'])
 assert.doesNotThrow(()=>new Function(read(name)),name+' must be valid JavaScript');
const begin=modern.indexOf('const aurelPlaybackMode=');
const end=modern.indexOf('const artistButton=',begin);
assert(begin>0&&end>begin,'Shared icon helpers must be defined before installed player overrides');
const context={};
vm.runInNewContext(
 'const ic=(name,size)=>"<svg data-name="+name+">";\n'+modern.slice(begin,end)+
 '\nglobalThis.glyphTests={aurelPlaybackMode,aurelPlaybackIcon,aurelPlaybackLabel};',
 context);
const {aurelPlaybackMode,aurelPlaybackIcon,aurelPlaybackLabel}=context.glyphTests;
assert.equal(aurelPlaybackMode({buffering:true,playing:false}),'loading');
assert.equal(aurelPlaybackMode({buffering:true,playing:true}),'loading');
assert.equal(aurelPlaybackMode({buffering:true,error:'Unavailable',playing:false}),'play');
assert.equal(aurelPlaybackMode({playing:true,buffering:false}),'pause');
assert.equal(aurelPlaybackMode({playing:false,buffering:false}),'play');
assert.match(aurelPlaybackIcon({buffering:true},33),/class="aurel-spinner"/);
assert.match(aurelPlaybackIcon({playing:true},33),/data-name=pause/);
assert.equal(aurelPlaybackLabel({buffering:true}),'Loading audio');
assert(modern.includes('stroke-width="2.55"'),'SVG renderer should use bold outlines');
assert(modern.includes("share:'<circle"),'Share must belong to the vector family');
assert(share.includes("ic('share',24)"),'Supplemental share control should use shared icon');
assert(murglar.includes("ic('share',25)"),'Now Playing share should use shared icon');
assert(!murglar.includes('stroke-width="1.85"'),'No thin standalone icons on Now Playing');
assert(murglar.includes("const loading=aurelPlaybackMode(p)==='loading'"));
assert(murglar.includes('toggle.innerHTML=aurelPlaybackIcon(p,39)'));
assert(murglar.includes('toggle.dataset.icon=mode'),'Avoid rerendering primary button on each tick');
assert(murglar.includes('aria-busy='),'Loader requires accessible status');
assert(responsive.includes('toggle.innerHTML=aurelPlaybackIcon(p,26)'));
assert(responsive.includes('m.dataset.miniPlaying=state'),'Keep mini-player DOM stable on every tick');
assert(app.includes('aurelPlaybackIcon(p,33)'),'Fallback full player must also display spinner');
assert(app.includes('1.1.53'),'Settings must show correct version');
assert(/@keyframes aurel-bold-spin/.test(styles));
assert(/prefers-reduced-motion:reduce/.test(styles));
assert(/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/.test(styles));
assert(/\.murglar-control\.middle/.test(styles));
assert(/\.bottom-nav button .*svg\.ui-icon/.test(styles));
const last=html.lastIndexOf('<link rel="stylesheet"');
assert(html.slice(last).startsWith('<link rel="stylesheet" href="aurel-bold-controls.css">'),
 'Bold controls stylesheet should load after legacy themes');
console.log('Unified bold SVG icons, loading spinner, responsive player DOM PASS');
