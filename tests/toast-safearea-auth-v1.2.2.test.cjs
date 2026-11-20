'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const css=read('app/src/main/assets/aurel-stable-detail.css');
const html=read('app/src/main/assets/index.html');
const app=read('app/src/main/assets/app.js');
const uk=read('app/src/main/assets/aurel-language.js');
new Function(app);new Function(uk);
assert(native.includes('systemInsetTop/density'),'Status inset must be converted to CSS pixels');
assert(native.includes('fullPlayerImmersive?cssInset:"0px"'),
 'Only immersive mode needs the extra status-bar offset');
assert(native.includes('JSONObject.quote("--aurel-toast-safe-top")'),
 'Native WebView must publish the exact toast inset');
assert(css.includes('var(--aurel-toast-safe-top,0px)'),
 'The notification must consume the native status-bar inset');
assert(css.includes('top:calc(max(env(safe-area-inset-top,0px),var(--aurel-toast-safe-top,0px)) + 12px)!important'));
assert(css.includes('grid-template-columns:minmax(0,1fr) 40px'),
 'Toast needs a separate column for the dismiss control');
assert(css.includes('.aurel-toast-message')&&css.includes('overflow-wrap:anywhere'),
 'Long rate-limit notices must wrap without escaping their viewport');
assert(html.lastIndexOf('<link rel="stylesheet"')===html.indexOf('<link rel="stylesheet" href="aurel-stable-detail.css">'),
 'Safe-area overrides must remain last in the style cascade');
assert(app.includes("loginMode:'password',loginTarget:'stream'"));
assert(app.includes('Email &amp; password')&&app.includes('Session token'));
assert(app.includes('data-login-mode="mornye"')&&app.includes('data-connect-mornye'),
 'Keep Mornye available without a third top-level auth tab');
assert(app.includes('<details class="aurel-signin-advanced">'));
assert(!app.includes('<details class="aurel-signin-advanced" open>'));
for(const id of ['appId','appSecret','userId','token','email','password'])
 assert(app.includes('id="'+id+'"'),'Required credential field disappeared: '+id);
assert(app.includes("nativeCall(passwordMode?'loginPassword':'loginToken',data)"),
 'Authentication must retain both native entry points');
assert(app.includes("if(input)input.value=''"),'Password input must still be wiped immediately');
assert(uk.includes("'Email & password':'Ел. пошта й пароль'"));
assert(uk.includes("'Qobuz sign-in expired':'Сеанс Qobuz завершився'"));
console.log('Toast safe-area, compact auth, token/login isolation and Ukrainian labels PASS');
