'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = p => fs.readFileSync(p,'utf8');
const gradle=read('app/build.gradle');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const api=read('app/src/main/java/com/aurel/hires/QobuzApi.java');
const ui=read('app/src/main/assets/app.js');
const manifest=read('app/src/main/AndroidManifest.xml');
const updates=read('app/src/main/assets/aurel-updates.js');

// Three simultaneously installable application IDs, separate Android data directories.
assert(gradle.includes("'com.aurel.hires.clone'"));
assert(gradle.includes("'com.aurel.hires.preview'"));
assert(gradle.includes("'com.aurel.hires'"));
assert(gradle.includes("project.hasProperty('aurelClone')"));
assert(gradle.includes("'AUREL Clone'"));
assert(manifest.includes('android:authorities="${applicationId}.updates"'));

// Both the UI and native bridge must actually carry supplied credentials.
assert(native.includes('j.put("cloneBuild",getPackageName().endsWith(".clone"));'));
assert(ui.includes("const clone=!!app.session?.cloneBuild;"));
assert(ui.includes("data.token=$('#token')?.value?.trim()||'';"));
assert(ui.includes("appId:$('#appId')?.value?.trim()||''"));
assert(ui.includes("appSecret:$('#appSecret')?.value?.trim()||''"));
assert(ui.includes("userId:$('#userId')?.value?.trim()||''"));
assert(ui.includes("nativeCall(passwordMode?'loginPassword':'loginToken',data)"));
assert(native.includes('case "loginToken": case "loginPassword":'));
assert(native.includes('api.validateLiveToken(appId,token,p.optString("userId",""),secondary)'));
assert(api.includes('request("track/search"'));
assert(api.includes('request("favorite/getUserFavorites"'));
assert(native.includes('secure.put("streamToken",token);'));
assert(native.includes('secure.put("streamAppId",appId);'));
assert(!ui.includes('TOKEN_PLACEHOLDER_DO_NOT_COMMIT'));
assert(updates.includes('Clone and Preview use separate Android packages'));

// The original production APK and signature must remain unchanged.
assert(gradle.includes("'com.aurel.hires'"));
assert(gradle.includes('AUREL_RELEASE_KEYSTORE_PATH'));
assert(gradle.includes("keyAlias 'aurel-release'"));
console.log('PASS: AUREL Clone package isolation, account fields and validation.');
