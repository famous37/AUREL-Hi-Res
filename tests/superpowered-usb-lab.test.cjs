'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=require('node:path').join(__dirname,'..');
const read=p=>fs.readFileSync(require('node:path').join(root,p),'utf8');
const settings=read('settings.gradle');
const production=read('app/build.gradle');
const c=read('superpoweredUsbLab/src/main/cpp/SuperpoweredUsbBridge.cpp');
const cmake=read('superpoweredUsbLab/src/main/cpp/CMakeLists.txt');
const java=read('superpoweredUsbLab/src/main/java/com/aurel/usblab/SuperpoweredUsbLabActivity.java');
const gradle=read('superpoweredUsbLab/build.gradle');
const manifest=read('superpoweredUsbLab/src/main/AndroidManifest.xml');
const docs=read('docs/SUPERPOWERED_PRIVATE_LAB.md');
const ignore=read('.gitignore');
assert(settings.includes("providers.gradleProperty('aurelSuperpoweredLab').isPresent()"));
assert(settings.includes("include ':superpoweredUsbLab'"));
assert(settings.includes("include ':app'"));
assert(gradle.includes("applicationId 'com.aurel.usblab'"));
assert(gradle.includes("abiFilters 'arm64-v8a'"));
assert(gradle.includes("AUREL_SUPERPOWERED_DIR"));
assert(cmake.includes('SuperpoweredAndroidUSB.h'));
assert(cmake.includes('libSuperpoweredAndroid'));
for(const token of [
  'Superpowered::Initialize(', 'Superpowered::AndroidUSB::initialize(',
  'Superpowered::AndroidUSB::onConnect(', 'Superpowered::AndroidUSB::onDisconnect(',
  'Superpowered::AndroidUSBAudio::easyIO(', 'Superpowered::AndroidUSBAudio::stopIO(',
  'Superpowered::AdvancedAudioPlayer', 'processStereo(',
  'PlayerEvent_Opened', 'player->play()', 'MaxFrames'
])assert(c.includes(token),'Actual Superpowered native integration missing: '+token);
for(const token of [
  'requestPermission(selected,pi)', 'UsbDeviceConnection',
  'new Intent(this,UsbPermissionReceiver.class)',
  'getRawDescriptors()', 'PendingIntent.FLAG_MUTABLE',
  'Context.RECEIVER_NOT_EXPORTED','private int pendingFilePickerUsbId',
  'if(connection==null&&reopenId>=0',
  'onStop()', 'releaseDevice();',
  'AudioFocusRequest.Builder', 'ACTION_OPEN_DOCUMENT',
  'File.createTempFile(', '300L*1024*1024',
  'getContentResolver().openInputStream(uri)'
])assert(java.includes(token),'Safe Android USB lab control missing: '+token);
const receiver=read('superpoweredUsbLab/src/main/java/com/aurel/usblab/UsbPermissionReceiver.java');
assert(receiver.includes('new Intent("com.aurel.usblab.USB_PERMISSION_CALLBACK")'));
assert(manifest.includes('android:name=".UsbPermissionReceiver"') &&
       manifest.includes('android:exported="false"'));
assert(manifest.includes('android.hardware.usb.host') &&
       manifest.includes('android.permission.INTERNET'));
assert(ignore.includes('/vendor/superpowered-sdk/'));
assert(docs.includes('private R&D') || docs.includes('private/internal'));
assert(docs.includes('does not list') || docs.includes('does NOT list'));
assert(docs.includes('July 31, 2027'));
assert(!production.includes('superpoweredUsbLab'));
assert(!production.includes('SuperpoweredAndroidUSB'));
console.log('AUREL Superpowered USB Lab: native API, private build isolation and device safety source checks PASS.');
