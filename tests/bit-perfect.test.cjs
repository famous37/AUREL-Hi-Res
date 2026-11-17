'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const asset = (x) => fs.readFileSync(path.join(root,'app/src/main/assets',x),'utf8');
const java = fs.readFileSync(path.join(root,'app/src/main/java/com/aurel/hires/BitPerfectOutput.java'),'utf8');
const main = fs.readFileSync(path.join(root,'app/src/main/java/com/aurel/hires/MainActivity.java'),'utf8');
const manifest = fs.readFileSync(path.join(root,'app/src/main/AndroidManifest.xml'),'utf8');
const html = asset('index.html'), app = asset('app.js'), css = asset('aurel-bit-perfect.css');
const modern = asset('modern.js');

// Android must actually negotiate an optional USB bit-perfect mixer format.
// A visual toggle alone cannot establish bit-perfect audio.
for(const token of [
  'Build.VERSION.SDK_INT < 34',
  'getSupportedMixerAttributes(usbDevice)',
  'AudioMixerAttributes.MIXER_BEHAVIOR_BIT_PERFECT',
  'setPreferredMixerAttributes(attributes, usbDevice, matched)',
  'getPreferredMixerAttributes(attributes, usbDevice)',
  'clearPreferredMixerAttributes(attributes, old)',
  'mediaPlayer.setPreferredDevice(usbDevice)',
  'mediaPlayer.getRoutedDevice()',
  'phase = "unsupported_format"',
  'phase = "no_usb"',
  'result.put("endToEndVerified", false)'
]) assert(java.includes(token),'Missing native protection: '+token);
assert(manifest.includes('android.permission.MODIFY_AUDIO_SETTINGS'));
for(const token of [
  'new BitPerfectOutput(this,',
  'bitPerfectEnabled',
  'case "setBitPerfect"',
  'bitPerfect.setEnabled(wanted,player,fileInfo)',
  'player.setAudioAttributes(bitPerfect.audioAttributes())',
  'bitPerfect.apply(mp,fileInfo)',
  'bitPerfect.release()',
  'registerAudioDeviceCallback(usbCallback,ui)',
  'unregisterAudioDeviceCallback(usbCallback)',
  'state.put("bitPerfect",bitPerfect.status(player))',
  'j.put("bitPerfect",bitPerfect.status(player))'
]) assert(main.includes(token),'Missing integration: '+token);
assert(app.includes('data-bit-perfect-toggle'));
assert(app.includes("nativeCall('setBitPerfect',{enabled:wanted})"));
assert(app.includes('role="switch"'));
assert(app.includes('aria-checked='));
assert(app.includes('end-to-end') || app.includes('end-to-end'.replace('e','e')) || app.includes('bit-identical'));
assert(html.indexOf('aurel-bit-perfect.css') > html.indexOf('aurel-minimal-player.css'));
assert(css.includes('.aurel-bp-switch.is-on'));
assert(css.includes('prefers-reduced-motion:reduce'));
assert(modern.includes('USB mixer preference'));
assert(modern.includes('End-to-end bit identity'));

// There is no forced 44.1 -> 48 kHz fallback and no fake success for Bluetooth.
assert(!/setPreferredMixerAttributes\([^)]*MIXER_BEHAVIOR_DEFAULT/.test(java));
assert(!/usb\(device\).*TYPE_BLUETOOTH/s.test(java));
console.log('USB Bit-perfect negotiation, reporting and settings checks passed.');
