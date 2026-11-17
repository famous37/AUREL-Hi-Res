/* Native USB engine / Android-only OFF path / volume and progress regression. */
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
const host=read('app/src/main/java/com/aurel/hires/AurelUsbDacHost.java');
const svc=read('app/src/main/java/com/aurel/hires/AurelPlaybackService.java');
const source=read('app/src/main/assets/app.js');
const modern=read('app/src/main/assets/modern.js');

assert.match(manifest,/<activity-alias[^>]*android:name="\.UsbBitPerfectHandler"[\s\S]*?android:enabled="false"/);
assert.equal((manifest.match(/android\.hardware\.usb\.action\.USB_DEVICE_ATTACHED/g)||[]).length,2);
for(const token of ['setComponentEnabledSetting','COMPONENT_ENABLED_STATE_DISABLED',
                     'COMPONENT_ENABLED_STATE_ENABLED','updateUsbAttachHandler()',
                     'setUsbVolumePercent','dispatchKeyEvent','case "setUsbVolume"'])
 assert(main.includes(token),'Missing native USB volume or chooser: '+token);
assert(!main.includes('if(!playback.usbStreamActive()){'),
 'Never reject native USB before Media3 begins delivering PCM');
assert(direct.includes('firstPlayAt=SystemClock.elapsedRealtime()')&&
       direct.includes('host.directRoute()')&&direct.includes('7000L'),
 'The new USB transport needs bounded startup grace and stall recovery');
assert(host.includes('getVolumeRange()')&&host.includes('manager.setVolume(target)'),
 'When DAC hardware volume exists use Feature Unit, never PCM digital scaling');
assert(host.includes('return state!=null&&state.getVolumeRange()!=null?"hardware":"unity"'));
assert(host.includes('prefs.getEnabled() != enabled') && !host.includes('else manager.retryActivation()'),
 'USB enable must not double-activate the native DAC');
assert(host.includes('suspendForAndroidAudio()') && host.includes('submittedUrbs()'),
 'Android handoff and live USB stats must be available');
assert(direct.includes('lastUrbsSeen') &&
 direct.includes('Native USB packets stopped advancing') &&
 direct.includes('Direct USB unavailable; switching to Android playback'),
 'Native output must detect transport stalls and fail over to Android');
assert(main.includes('usbHost.suspendForAndroidAudio()') &&
 main.includes('final int switchGeneration=++playGeneration'),
 'Engine switch must reject stale callbacks and release DAC ownership');
assert(source.includes("const usbHardwareVolume=bp.usbVolumeMode==='hardware'") &&
 source.includes("${usbHardwareVolume?'':'disabled'}"),
 'A unity-gain USB DAC cannot offer a functional hardware volume slider');
assert(svc.includes('VolumeProvider.VOLUME_CONTROL_ABSOLUTE')&&
       svc.includes('setPlaybackToRemote')&&svc.includes('setPlaybackToLocal'));
assert(main.includes('configureAndroidUsb(player,false)'));
assert(!main.includes('if(mp.getPreferredDevice()!=null) mp.setPreferredDevice(null)'),
 'Standard Android route must never be repeatedly reset');
assert(main.includes('bitPerfect=new BitPerfectOutput(this,false)') &&
 main.includes('usbHost=null;') && main.includes('usbHost=AurelUsbDacHost.get('),
 'USB native driver should be initialized only after an explicit ON');
assert(main.includes('catch(RuntimeException | LinkageError failure)'),
 'Java native init errors must fail back to Android');
assert(host.includes('prefs = new Prefs(false)') &&
 host.includes('if(enabled) prefs.setEnabled(true)') &&
 !host.includes('if(enabled) manager.retryActivation()'),
 'Native USB should be activated once via the preference listener');
assert(source.includes('data-aurel-usb-volume')&&source.includes("nativeCall('setUsbVolume'"));
assert(modern.includes('mini-progress-fill')&&modern.includes('AurelProgressClock'));

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
