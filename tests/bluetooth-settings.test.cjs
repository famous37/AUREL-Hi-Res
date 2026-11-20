'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const assets=path.join(__dirname,'../app/src/main/assets');
const read=p=>fs.readFileSync(path.join(assets,p),'utf8');
const java=fs.readFileSync(path.join(__dirname,'../app/src/main/java/com/aurel/hires/BitPerfectOutput.java'),'utf8');
const html=read('index.html');
const pro=read('aurel-settings-pro.js');
const groups=read('aurel-settings-groups.js');
const css=read('aurel-settings-groups.css');
new Function(pro);new Function(groups);

assert(html.indexOf('aurel-settings-groups.js')>html.indexOf('aurel-settings-pro.js'),
 'Grouping must run after functional audio handlers');
assert(html.indexOf('aurel-settings-groups.css')>html.indexOf('aurel-studio.css'),
 'Settings layout CSS must override the old layout');
for(const section of ['Audio outputs','Playback','Accounts','Appearance','App & data']){
 assert(groups.includes(section),'Missing settings group: '+section);
}
assert(groups.includes('original.apply(this,arguments)'),'Original settings must remain intact');
assert(groups.includes('containers.playback.append(quality,options)'),'Playback controls should remain grouped');
assert(groups.includes('containers.outputs.append(diagnostics)'),'Diagnostics should be grouped');
assert(groups.includes('containers.accounts.append(stream,library)'),'Accounts should be grouped');
assert(groups.includes('window.AurelProSettings?.scanOutputs?.()'),'Output scanning must be functional');
for(const action of ['audioDiagnostics','setDigitalHeadroom','setMetadataPreload']){
 assert(pro.includes(action),'Lost native action '+action);
}
assert(pro.includes('d.currentlyRouted')&&pro.includes('d.bluetooth'),
 'Show actual routed and Bluetooth outputs');
assert(pro.includes('advertisedSampleRates')&&pro.includes('Android rates: '),
 'Keep correctly labelled Android-reported rates');
assert(!pro.includes('Active Bluetooth codec / bitrate:'),
 'Do not clutter the interface with unavailable codec explanations');
assert(java.includes('TYPE_BLUETOOTH_A2DP')&&
 java.includes('TYPE_BLE_HEADSET')&&
 java.includes('TYPE_BLE_SPEAKER'),
 'Bluetooth A2DP and LE output devices must be recognized');
assert(java.includes('item.put("negotiatedCodec",JSONObject.NULL)'),
 'Do not report a codec that standard Android cannot verify');
assert(!/\.getCodecStatus\s*\(/.test(java),'Do not call privileged hidden Bluetooth codec APIs');
assert(css.includes('min-height:62px')&&css.includes('font-size:18px'));
assert(!css.includes('transition:height'),'No jittering height animation');
console.log('AUREL Bluetooth routing and grouped settings checks PASS');
