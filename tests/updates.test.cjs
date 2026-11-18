/* Security regression: AUREL signed updater, no network required. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const manager=read('app/src/main/java/com/aurel/hires/AurelUpdateManager.java');
const provider=read('app/src/main/java/com/aurel/hires/AurelUpdateProvider.java');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const html=read('app/src/main/assets/index.html');
const ui=read('app/src/main/assets/aurel-updates.js');
const manifest=read('app/src/main/AndroidManifest.xml');
const gradle=read('app/build.gradle');
const release=read('.github/workflows/release.yml');
const fingerprint='C9F57989C6622A55440F35CD426A5DC6830161EEB5AEAB299FDB3E69F94ED3CA';
for(const key of ['GET_SIGNING_CERTIFICATES','CERT_SHA256','verifyApk(tmp,target.version)',
 'verifyApk(apk,version)','MessageDigest.getInstance("SHA-256")',
 'archive.getLongVersionCode()','next<=current','PKG.equals(archive.packageName)',
 'PKG.equals(installed.packageName)','CERT_SHA256.equals(incoming)','CERT_SHA256.equals(existing)',
 'canRequestPackageInstalls','ACTION_MANAGE_UNKNOWN_APP_SOURCES',
 'Intent.FLAG_GRANT_READ_URI_PERMISSION','Intent.ACTION_VIEW',
 'SHA256SUMS.txt','MAX_APK','trustedHost','https']){
 assert(manager.includes(key),'Missing security step: '+key);
}
assert(manager.includes(fingerprint),'APK signature must be pinned to release key');
assert(manager.includes('releases?per_page=15'),'Must include signed prereleases');
assert(manager.includes('getCacheDir()'),'APK remains in private cache');
assert(provider.includes('if(info.exported||!info.grantUriPermissions)'),'Provider must be private');
assert(provider.includes('if(!"r".equals(mode))'),'Provider cannot write');
assert(provider.includes('"/apk".equals(uri.getPath())'),'Reject arbitrary paths');
assert(manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES'));
assert(manifest.includes('android:authorities="'+'$'+'{applicationId}.updates"'));
assert(manifest.includes('android:exported="false" android:grantUriPermissions="true"'));
for(const s of ['case "checkUpdate"','case "updateStatus"','case "downloadUpdate"',
 'case "installUpdate"','updateManager.onPermissionResult()'])assert(native.includes(s));
assert(html.includes('aurel-updates.js'));
for(const k of ['data-aurel-check-update','data-aurel-download-update',
 'data-aurel-install-update','86400000','data-aurel-auto-updates','progress','What’s new']){
 assert(ui.includes(k),'Missing update UI function: '+k);
}
assert(/versionCode\s+79/.test(gradle) && gradle.includes("'1.1.60'"),
 'New release must advance versionCode and versionName');
assert(release.includes('AUREL_RELEASE_KEYSTORE_BASE64')&&release.includes('apksigner'));
console.log('AUREL updater signing, checksum, permission, and UI regression checks passed.');
