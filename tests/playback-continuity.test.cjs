'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const mixer=read('app/src/main/java/com/aurel/hires/BitPerfectOutput.java');
const history=read('app/src/main/assets/aurel-continuity.js');
const pref=read('app/src/main/assets/aurel-preference-sync.js');
const ui=read('app/src/main/assets/app.js');
const gradle=read('app/build.gradle');
const before=(x,y)=>native.indexOf(x)>=0&&native.indexOf(y)>native.indexOf(x);

for(const s of [
 'PLAYBACK_PREFS="aurel_playback_continuity_v1"',
 'private void savePlaybackContinuity()',
 'private void restorePlaybackContinuity()',
 'private void clearPlaybackContinuity()',
 'safePlaybackTrack(queue.get(i))',
 'restoredPositionMs',
 'restoredTrackId.equals(current.optString("id",""))',
 'getSharedPreferences(PLAYBACK_PREFS,MODE_PRIVATE)',
 'savePlaybackContinuity();',
 'restorePlaybackContinuity();',
 'clearPlaybackContinuity();'
])assert(native.includes(s),'Missing native continuity: '+s);
assert(before('restorePlaybackContinuity();','web.loadUrl("file:///android_asset/index.html")'),
 'Queue must be restored before the WebView asks for playerState');
const snapshot=native.slice(native.indexOf('private void savePlaybackContinuity()'),
 native.indexOf('private void restorePlaybackContinuity()'));
assert(!snapshot.includes('streamUrl')&&!snapshot.includes('fileInfo')
 &&!snapshot.includes('getToken')&&!snapshot.includes('authToken'),
 'Never save signed media URLs or account credentials');
assert(native.includes('else if(!buffering&&queueIndex>=0&&!hasEngine())startAtCurrent()'),
 'Restored tracks must not automatically start on cold launch');
assert(history.includes("lastAction={type,at:Date.now()}"));
assert(history.includes('window.AurelHistoryClear='));
assert(history.includes("if(!started||restoring)return;"));
assert(history.includes("if(view.overlay&&app.player?.track?.id"));
assert(ui.includes('window.AurelHistoryClear?.()'));
// The default path MUST remain a normal Android mixer playback path.
assert(native.includes('new MediaPlayer()'));
assert(native.includes('configureAndroidUsb(player,false)'));
assert(native.includes('bitPerfect.setEnabled(wanted,player,fileInfo)'));
assert(native.includes('bitPerfect.apply(mp,format)'));
assert(!native.includes('usbHost'));
assert(mixer.includes('Standard Android MediaPlayer / AudioFlinger'));
assert(mixer.includes('setPreferredMixerAttributes('));
assert(!fs.existsSync(path.join(root,'app/src/main/java/com/aurel/hires/AurelUsbDacHost.java')),
 'Native USB driver must be absent from the repository');
assert(/versionCode\s+113/.test(gradle) && gradle.includes("'1.1.96'"));
console.log('Native resume, persisted navigation, signed-update safety and USB policy diagnoses validated.');
