'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'../app/src/main/assets');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const css=read('aurel-unified.css');
const app=read('app.js');
const lang=read('aurel-language.js');
const html=read('index.html');
new Function(app);
new Function(lang);
assert(html.lastIndexOf('aurel-unified.css')>html.indexOf('aurel-clarity.css'),
  'Final stylesheet must apply contrast rules last');

const contrastMarker='selected controls must remain legible';
const contrast=css.slice(css.indexOf(contrastMarker));
assert(contrast.startsWith(contrastMarker),'Missing contrast fix');
for(const marker of [
 '.app #screen .selectrow button.quality.selected',
 '.app #screen .selectrow button.quality.selected strong',
 '.app #screen .selectrow button.quality.selected small',
 '.app #screen .selectrow button.quality.selected::after',
 '-webkit-text-fill-color:#ffffff!important;',
 '-webkit-text-fill-color:#e1e4e9!important;',
 ':focus-visible',
 '.app #screen .aurel-pro-choice button.is-selected',
 '.app #screen .aurel-language-choice[aria-checked="true"]'
])assert(contrast.includes(marker),'Contrast fix does not cover '+marker);
assert(/button\.quality\.selected[^}]+background:#3b3d42!important/s.test(contrast),
  'Selected tile must use dark background and strong white outline');
assert(/button\.quality\.selected strong[^}]+color:#ffffff!important/s.test(contrast),
  'Selected quality title must not inherit white-on-white styles');
assert(/button\.quality\.selected small[^}]+color:#e1e4e9!important/s.test(contrast),
  'Selected quality sublabel must remain readable');
const luminance=hex=>{
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
 const lin=rgb.map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));
 return .2126*lin[0]+.7152*lin[1]+.0722*lin[2];
};
const contrastRatio=(a,b)=>{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
assert(contrastRatio('#3b3d42','#ffffff')>=7,'Selected title must meet AAA contrast');
assert(contrastRatio('#3b3d42','#e1e4e9')>=7,'Selected subtitle must meet AAA contrast');
assert(contrastRatio('#303136','#d7dbe1')>=7,'Unselected subtitle must meet AAA contrast');
assert(app.includes('role="group" aria-label="Streaming quality"'));
assert(app.includes('aria-pressed="${app.session.quality===q}"'),
  'Selected quality must be announced to screen readers');
assert(app.includes('bpDescription')&&app.includes('Android USB bit-perfect'));
assert(!app.includes('<p>Android 14+ · compatible external USB DAC</p>'));
assert(!app.includes('${html(bp.detail||'),
  'User-facing USB detail must not show raw long native English text');
const start=lang.indexOf('var dictionary=');
const end=lang.indexOf('var skipContent=',start);
assert(start>=0&&end>start);
const dictionary=new Function(lang.slice(start,end)+'\nreturn dictionary;')();
const english=[
 'Android USB bit-perfect',
 'Android 14+ · AudioManager preferred mixer · no third-party USB driver',
 'Android bit-perfect unavailable',
 'Android bit-perfect preference accepted',
 'Android USB policy routed',
 'USB bit-perfect playback setting',
 'Digital headroom'
];
for(const key of english){
 const value=dictionary[key];
 assert(value&&/[А-Яа-яІіЇїЄєҐґ]/.test(value),'Missing Ukrainian interface string: '+key);
}
for(const state of ['off','android_version','no_usb','waiting_track',
 'unknown_format','unsupported_format','policy_unavailable','rejected','requested','usb_mixer_routed'])
 assert(new RegExp('\\b'+state+':').test(app),'USB state missing '+state);
console.log('AUREL contrast and Ukrainian USB settings regression PASS');
