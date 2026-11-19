/* AUREL 1.1.46 regression: language selection and account isolation. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const main=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const api=read('app/src/main/java/com/aurel/hires/QobuzApi.java');
const app=read('app/src/main/assets/app.js');
const language=read('app/src/main/assets/aurel-language.js');
const ui=read('app/src/main/assets/index.html');
const build=read('app/build.gradle');
assert(main.includes('retireMornyeForQobuz()'));
assert(main.includes('boolean leftMornye=retireMornyeForQobuz()'));
assert(main.includes('mornye.disconnect();'));
assert(main.includes('clearPreviousStreamingCredentials()'));
assert(main.includes('libraryMayStream'));
assert(main.includes('secure.put("streamValidation","verified")'));
assert(main.includes('for(String key:new String[]{"libraryAppId","libraryAppSecret"'));
assert(main.includes('if(connected&&!mornyeActive()&&!mornyeMode())return'));
assert(main.includes('if(!mornyeMode()&&!mornye.isConnected()&&secure.get("mornyePendingState").isEmpty())return'));
const caseStart=main.indexOf('case "loginToken": case "loginPassword": {');
const validatePos=main.indexOf('api.validateLiveToken(',caseStart);
const retirePos=main.indexOf('boolean leftMornye=retireMornyeForQobuz()',caseStart);
assert(validatePos>caseStart&&retirePos>validatePos,'Gateway must remain connected if login fails');
assert(api.includes('if(account.contains("@"))body.put("email",account)'));
assert(api.includes('else body.put("username",account)'));
assert(app.includes("app.libraryCache=Object.create(null)")&&app.includes('app.playlistsCache=null'));
assert(app.includes("navigate('library')"));
assert(app.includes("||app.session?.libraryConnected"));
assert(app.includes("app.session?.libraryConnected&&!app.session?.streamConnected"));
assert(app.includes('aurel-signin-advanced" open'));
assert(!/Скрипниківка|Skrypnykivka/.test(language),'Do not show language variant in the UI');
assert(language.includes('createLoginLanguageSwitch'));
assert(language.includes('data-aurel-locale="uk"'));
assert(language.includes("current==='uk'?'Англійська':'English'"));
assert(ui.includes('aurel-language.js')&&ui.includes('aurel-elegant.css'));
assert(/versionCode\s+100/.test(build) && build.includes("'1.1.81'"));
const body={nodeType:1,tagName:'BODY',firstChild:null,hasAttribute(){return false;}};
const document={
 documentElement:{lang:'en'},body,
 getElementById(){return null},querySelector(){return null},
 querySelectorAll(){return []},addEventListener(){}
};
const localStorage={getItem(){return null},setItem(){}};
class MutationObserver{observe(){}}
const window={};
const ctx=vm.createContext({document,localStorage,MutationObserver,window,renderSettings(){},console});
vm.runInContext(language,ctx,{filename:'aurel-language.js'});
const lang=window.AurelLanguage;
assert.equal(lang.get(),'en');
assert.equal(lang.translate('Qobuz email or username'),'Електронна пошта або ім’я користувача Qobuz');
assert.equal(lang.translate('Session token'),'Токен сеансу');
assert.equal(lang.translate('Personal Qobuz library'),'Особиста бібліотека Qobuz');
assert.equal(lang.translate('Account connected but streaming was not verified. You can browse your library; connect a compatible playback account to listen.'),
 'Обліковий запис під’єднано, проте відтворення не підтверджено. Ви можете переглядати бібліотеку; для прослуховування під’єднайте сумісний обліковий запис.');
lang.set('uk');assert.equal(lang.get(),'uk');assert.equal(document.documentElement.lang,'uk');
lang.set('en');assert.equal(lang.get(),'en');
assert.equal(lang.translate('Artist'), 'Виконавець');
assert.equal(lang.translate('Discography'), 'Дискографія');
console.log('Language and account-switch regression checks passed');
