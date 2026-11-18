'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const main=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const host=read('app/src/main/java/com/aurel/hires/AurelUsbDacHost.java');
const direct=read('app/src/main/java/com/aurel/hires/UsbDirectPlayback.java');
const ui=read('app/src/main/assets/app.js');

// OFF must not initialize the native USB manager, so Android normal playback
// cannot fail merely because the JNI driver is unavailable.
assert.match(main,/if\(bitPerfect\.isEnabled\(\) && ensureUsbDriver\(\)\)/);
assert.doesNotMatch(main,/usbHost=AurelUsbDacHost\.get\(this,bitPerfect\.isEnabled\(\)/);
assert.match(main,/catch\(RuntimeException \| LinkageError error\)/);
assert.match(main,/usbHost\.setEnabled\(false\)/);

// Native USB should release hardware for new audio-focus owners.
assert.match(main,/usbHost\.releaseClaim\(\)/);

// A supported Android fallback is a legitimate playback route, not an
// exception requiring the track to restart or lose an authorized stream URL.
assert.match(direct,/else if\(!host\.androidFallback\(\) && nowMs-firstPlayAt>12000L\)/);
assert.doesNotMatch(direct,/Direct USB unavailable; switching to Android playback/);

// Never count a stale USB packet counter after pause as bit-perfect playback.
assert.match(direct,/player\.isPlaying\(\) && host\.directTransportActive\(\)/);
assert.match(direct,/SystemClock\.elapsedRealtime\(\)-lastUrbsAdvanceAt<3500L/);
assert.match(direct,/active && rateMatches/);
assert.match(host,/int androidMixerRate\(\)/);
assert.match(host,/nativeUsbBitPerfectCapable/);
assert.match(ui,/direct_usb_rate_mismatch/);
assert.match(ui,/Direct USB is fixed gain/);
console.log('AUREL USB mode isolation, playback-liveness and truthful-status regressions passed.');
