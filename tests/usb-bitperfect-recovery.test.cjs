'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const main=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const host=read('app/src/main/java/com/aurel/hires/AurelUsbDacHost.java');
const direct=read('app/src/main/java/com/aurel/hires/UsbDirectPlayback.java');
const ui=read('app/src/main/assets/app.js');
const gradle=read('app/build.gradle');

// The installed v1.1.50 had USB disabled for safety. Explicit opt-in may
// return, but cold launch must never claim the user's external DAC.
assert.match(main,/bitPerfect=new BitPerfectOutput\(this,false\)/);
assert.match(main,/usbHost=null;/);
assert.doesNotMatch(main,/if\(wanted\)throw new Exception\(/);
assert.match(main,/if\(wanted && usbHost==null\)/);
assert.match(main,/catch\(RuntimeException \| LinkageError failure\)/);
assert.match(main,/bitPerfect\.setEnabled\(false,null,fileInfo\)/);
assert.match(main,/usbHost\.releaseClaim\(\)/);
assert.doesNotMatch(main,/if\(mp\.getPreferredDevice\(\)!=null\) mp\.setPreferredDevice\(null\)/);

// Real native packet progress and real sample-rate matching are distinct
// from merely selecting USB or seeing a historical URB count.
assert.match(direct,/player\.isPlaying\(\) && host\.directTransportActive\(\)/);
assert.match(direct,/lastUrbsAdvanceAt<3500L/);
assert.match(direct,/active && rateMatches/);
assert.match(direct,/!host\.androidFallback\(\) && nowMs-firstPlayAt>12000L/);
assert.doesNotMatch(direct,/Direct USB unavailable; switching to Android playback/);
assert.match(host,/nativeUsbBitPerfectCapable/);
assert.match(host,/int androidMixerRate\(\)/);
assert.match(host,/prefs = new Prefs\(false\)/);
assert.match(host,/if\(enabled\) prefs\.setEnabled\(true\)/);
assert.match(ui,/data-bit-perfect-toggle class=/);
assert.doesNotMatch(ui,/data-bit-perfect-toggle disabled/);
assert.match(ui,/direct_usb_rate_mismatch/);
assert.match(gradle,/versionCode 70/);
console.log('AUREL 1.1.51 USB opt-in, Android isolation and native transport diagnostics passed.');
