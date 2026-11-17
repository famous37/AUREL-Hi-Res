'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const assets=p=>read('app/src/main/assets/'+p);
const app=assets('app.js'),modern=assets('modern.js');
const responsive=assets('responsive.js'),live=assets('aurel-live-ui.js');
const swipe=assets('aurel-swipe-minimize.js'),css=assets('aurel-unified.css');
const html=assets('index.html'),locale=assets('aurel-language.js');
const java=read('app/src/main/java/com/aurel/hires/AurelPlaybackService.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const res='app/src/main/res/';
const launcher=read(res+'drawable/aurel_launcher_foreground.xml');
const mono=read(res+'drawable/aurel_launcher_monochrome.xml');
const stat=read(res+'drawable/ic_stat_aurel.xml');
const fallback=read(res+'mipmap-anydpi/ic_launcher.xml');

assert(html.indexOf('aurel-unified.css')>html.indexOf('aurel-clarity.css'),
 'Monochrome stylesheet must override legacy colourful themes');
assert(css.includes('--accent:#f4f5f7') && css.includes('background:#16171b'));
assert(!/eac184|#DEA8B9|#[a-fA-F0-9]{6}.*gold/.test(css));
for(const d of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'])
 assert(!fs.existsSync(path.join(base,res,'mipmap-'+d+'/ic_launcher.png')),
 'Old launcher icon must be removed from '+d);
assert(fs.existsSync(path.join(base,res,'mipmap-anydpi-v26/ic_launcher.xml')));
assert(manifest.includes('android:icon="@mipmap/ic_launcher"'));
assert(launcher.includes('strokeColor="#FFF8FAFC"') && mono.includes('#FFFFFFFF'));
assert(fallback.includes('android:fillColor="#FF101114"'));
assert(stat.includes('strokeColor="#FFFFFFFF"') && stat.includes('M3.5,21 L10.4,3.5'));
assert(html.includes('aurel-brand-svg') && !html.includes('class="mark">a'));
assert(live.includes('stable queue glyph') || live.includes('stable vector'));
assert(!live.includes('icon.innerHTML=url?'), 'No album art in the vector navigation tab');
assert(responsive.includes('const fingerprint=id+\'|\'+cover'));
assert(!responsive.includes('!!p.playing].join'), 'Playback state must not recreate mini DOM');
for(const t of ['data-mini-prev','data-mini-next','data-mini-toggle','data-open-mini-player'])
 assert(responsive.includes(t),'Lost functional mini action '+t);
assert(responsive.includes('trackTitle(t)') && responsive.includes('artistLabel(t)'));
assert(css.includes('.app .mini .mini-track-open :is(strong,small)'));
assert(css.includes('text-overflow:ellipsis!important'));
assert(swipe.includes('Math.max(960,(window.innerHeight||720)*1.18)'));
assert(swipe.includes('},385)'));
assert(java.includes('static String humanName(Object value,String fallback)'));
assert(java.includes('new JSONObject(str)') && java.includes('new org.json.JSONArray(str)'));
assert(java.includes('METADATA_KEY_DISPLAY_TITLE')&&java.includes('METADATA_KEY_DISPLAY_SUBTITLE'));
assert(java.includes('title=humanName(track,"Music")'));
assert(java.includes('artist=humanName(performer,"Artist")'));
assert(java.includes('R.drawable.ic_stat_aurel'));

const a=app.indexOf('const nameOf='),b=app.indexOf('const artistChoices=',a);
assert(a>=0&&b>a);
const meta=vm.runInNewContext(app.slice(a,b)+';({nameOf,trackTitle})');
assert.equal(meta.nameOf('{"display":"Benny Benassi"}'),'Benny Benassi');
assert.equal(meta.nameOf({display:{display:'Benny Benassi'}}),'Benny Benassi');
assert.equal(meta.nameOf([{name:'A'},{display:'B'}]),'A, B');
assert(app.includes('artistChoices(o).map(v=>nameOf(v))'),
 'Artist mapper must never pass an array index as recursion depth');
assert.equal(meta.nameOf('{"display"'),'', 'Malformed JSON must not leak to UI');
assert.equal(meta.trackTitle({title:'Cinema'}),'Cinema');
assert.equal(meta.trackTitle({title:'{"display":"Cinema"}'}),'Cinema');
assert(locale.includes("'Connected devices'") && locale.includes("'Main navigation'"));
console.log('AUREL v1.1.39 media metadata, mini player, full collapse, grayscale and unified icon checks PASS');
