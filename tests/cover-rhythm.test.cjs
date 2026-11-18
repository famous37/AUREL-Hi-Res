'use strict';
/* AUREL opt-in cover-rhythm regression checks: no PCM/USB path mutations. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const page=read('app/src/main/assets/index.html');
const script=read('app/src/main/assets/aurel-cover-rhythm.js');
const css=read('app/src/main/assets/aurel-cover-rhythm.css');
const monitor=read('app/src/main/java/com/aurel/hires/AurelBeatMonitor.java');
const activity=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const engine=read('app/src/main/java/com/aurel/hires/BitPerfectOutput.java');

assert.match(page,/aurel-cover-rhythm.css/);
assert.match(page,/aurel-cover-rhythm.js/);
assert.ok(page.indexOf('aurel-cover-rhythm.js')>page.indexOf('aurel-settings-groups.js'),
  'The opt-in module must wrap the final settings renderer');
assert.ok(page.indexOf('aurel-cover-rhythm.css')>page.indexOf('aurel-landscape-nav.css'),
  'The scoped player effect must load after latest landscape rules');

assert.match(script,/aurel_cover_rhythm_v1/);
assert.match(script,/localStorage\.setItem\(KEY,enabled\?'on':'off'\)/);
assert.match(script,/\[data-aurel-rhythm-toggle\]/);
assert.match(script,/renderSettings=function/);
assert.match(script,/drawOverlay=function/);
assert.match(script,/window\.AurelBeatFrame/);
assert.match(script,/app\.player\?\.playing/);
assert.match(script,/!app\.player\?\.buffering/);
assert.match(script,/!bitPerfect\(\)/);
assert.match(script,/prefers-reduced-motion: reduce/);
assert.match(script,/requestPermission:!!ask/);
assert.match(script,/aurel-beat-ambient/);

assert.match(css,/#overlay\.aurel-beat-live \.murglar-cover/);
assert.match(css,/#overlay\.aurel-beat-ambient \.murglar-cover/);
assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
assert.ok(!css.includes('left:')&&!css.includes('top:')&&!css.includes('padding:'),
  'The effect must not alter transport layout or player geometry');
assert.match(monitor,/new Visualizer\(session\)/);
assert.match(monitor,/if\(session<=0\)/);
assert.match(monitor,/setDataCaptureListener/);
assert.match(monitor,/onFftDataCapture/);
assert.doesNotMatch(monitor,/setVolume|setDataSource|setPreferredDevice|AudioTrack|MediaRecorder/);

assert.match(manifest,/android\.permission\.RECORD_AUDIO/);
assert.match(activity,/BEAT_CAPTURE_PERMISSION_REQUEST/);
assert.match(activity,/case "setBeatVisualization":/);
assert.match(activity,/Manifest\.permission\.RECORD_AUDIO/);
assert.match(activity,/if\(ask&&!allowed\)requestPermissions/);
assert.match(activity,/!bitPerfect\.isEnabled\(\)/);
assert.match(activity,/if\(beatMonitor!=null\)beatMonitor\.stop\(\)/);
assert.doesNotMatch(engine,/AurelBeatMonitor|Visualizer/);
console.log('Cover rhythm: opt-in, accessible, display-only, permission gated, no USB/audio mutation');
