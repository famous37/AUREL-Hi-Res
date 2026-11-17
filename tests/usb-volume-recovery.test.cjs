/* USB output control / native-chooser / monotonic player regression. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=read('app/src/main/AndroidManifest.xml');
const main=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const direct=read('app/src/main/java/com/aurel/hires/UsbDirectPlayback.java');
const svc=read('app/src/main/java/com/aurel/hires/AurelPlaybackService.java');
const source=read('app/src/main/assets/app.js');
const modern=read('app/src/main/assets/modern.js');
const setup=read('scripts/setup-usb-driver.sh');
const volume=read('scripts/add-usb-volume.py');

assert.match(manifest,/<activity-alias[^>]*android:name="\.UsbBitPerfectHandler"[\s\S]*?android:enabled="false"/);
assert.equal((manifest.match(/android\.hardware\.usb\.action\.USB_DEVICE_ATTACHED/g)||[]).length,2,
 'USB chooser action and its metadata should live only on the opt-in alias');
for(const token of ['setComponentEnabledSetting','COMPONENT_ENABLED_STATE_DISABLED',
                     'COMPONENT_ENABLED_STATE_ENABLED','updateUsbAttachHandler()',
                     'setUsbVolumePercent','dispatchKeyEvent','case "setUsbVolume"'])
 assert(main.includes(token),'Missing opt-in USB or volume control: '+token);
assert(direct.includes('sink.setUsbOutputLevel')&&direct.includes('usbVolumeMode'),
 'Direct USB level must be applied before opening a track and be reported');
assert(svc.includes('VolumeProvider.VOLUME_CONTROL_ABSOLUTE')&&
       svc.includes('setPlaybackToRemote')&&svc.includes('setPlaybackToLocal'),
 'Hardware volume keys must control native USB and revert to Android elsewhere');
for(const token of ['discoverHardwareVolume','setHardwareVolumePercent',
                     'nativeSetDigitalGain','applyUsbDigitalGain',
                     'hardwareVolumeActive','softwareGainActive'])
 assert(volume.includes(token),'Missing safe volume strategy: '+token);
assert(setup.includes('scripts/add-usb-volume.py'),'Native volume patch must run in CI');
assert(source.includes('data-aurel-usb-volume') &&
       source.includes("nativeCall('setUsbVolume'"),
 'Volume slider must be connected to the real native setter');
assert(modern.includes('mini-progress-fill')&&modern.includes('AurelProgressClock'),
 'Mini-player must preserve artwork and smooth the native progress');

let time=1000;
const context={window:{},performance:{now:()=>time}};
vm.runInNewContext(read('app/src/main/assets/aurel-progress-clock.js'),context);
const clock=context.window.AurelProgressClock;
const track={track:{id:'one'},position:1000,duration:200000,playing:true,buffering:false};
assert.equal(clock.accept(track),1000);
time=2000;track.position=500;
assert(clock.accept(track)>=1900,'A temporary USB clock reset must not rewind progress');
clock.markSeek(50000);
time=2100;track.position=1100;
assert.equal(clock.accept(track),50000,'Old frames after seeking must not bounce the slider');
time=2200;track.position=50010;
assert(clock.accept(track)>=50000,'Matching post-seek samples must restore timeline updates');
time=2400;track.track={id:'two'};track.position=0;
assert.equal(clock.accept(track),0,'A new song must reset monotonic state');
console.log('AUREL USB chooser, hardware volume and stable progress PASS');
