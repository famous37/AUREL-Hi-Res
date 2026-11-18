/* AUREL 1.1.46: native public-link sharing and safe UI actions. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const app=read('app/src/main/assets/app.js');
const page=read('app/src/main/assets/index.html');
const share=read('app/src/main/assets/aurel-share.js');
const css=read('app/src/main/assets/aurel-share.css');
const lang=read('app/src/main/assets/aurel-language.js');
const build=read('app/build.gradle');
assert(/versionCode\s+84/.test(build) && build.includes("'1.1.65'"));
for(const fragment of [
 'private static String publicQobuzLink(JSONObject params)',
 'case "shareQobuzLink":','Intent.ACTION_SEND','Intent.EXTRA_TEXT',
 'send.setType("text/plain")','Intent.createChooser(send,chooser)',
 'https://open.qobuz.com/','Unsupported Qobuz share type',
 'id.matches("[0-9]{1,20}")','id.matches("[a-zA-Z0-9]{1,64}")'
 ])assert(native.includes(fragment),'Expected native public share contract: '+fragment);
const shareCase=native.slice(native.indexOf('case "shareQobuzLink":'),native.indexOf('case "openQobuzWeb":'));
assert(!/streamToken|libraryToken|streamUrl|AppSecret|password|secure\.get\(/i.test(shareCase),
 'Share must never export session credentials or media streaming URLs');
assert(!/window\.open|location\.href|navigator\.share/.test(share),
 'Sharing must use Android sharesheet instead of WebView navigation');
assert(page.includes('aurel-share.js')&&page.includes('aurel-share.css'));
assert(page.indexOf('aurel-favourites.js')<page.indexOf('aurel-share.js'),
 'Share should decorate artist/album wrappers after the favourites module');
assert(app.includes('data-aurel-track-id='),
 'Track lists must carry a real Qobuz ID, independent of sorted list indices');
assert(css.includes('repeat(5,minmax(0,1fr))!important'),
 'Player should have room for all 5 actions');
assert(css.includes('prefers-reduced-motion:reduce'));
assert(share.includes("screen.querySelectorAll('.albumcard[data-open-album]')"));
assert(share.includes("screen.querySelectorAll('.aurel-artist-item')"));
assert(share.includes("screen.querySelectorAll('.track[data-aurel-track-id]')"));
assert(share.includes("appendOnce(overlay.querySelector('.murglar-quick-actions')"));
assert(lang.includes('"Share track":"Поширити трек"') &&
       lang.includes('"Share album":"Поширити альбом"') &&
       lang.includes('"Share artist":"Поширити виконавця"'));
const callbacks={};
const document={
 addEventListener(event,handler){callbacks[event]=handler;},
 getElementById(){return null;},
 createElement(){throw new Error('No UI rendered in this harness');}
};
const called=[],errors=[];
const window={AurelLanguage:{get(){return 'uk';}}};
const runtime=vm.createContext({document,window,
 nativeCall:async(action,params)=>{called.push({action,params});return {requested:true};},
 showToast:message=>errors.push(message),
 setTimeout:()=>0,MutationObserver:undefined,console
});
vm.runInContext(share,runtime,{filename:'aurel-share.js'});
const api=window.AurelShare;
assert.equal(api.linkFor('track','426235024'),'https://open.qobuz.com/track/426235024');
assert.equal(api.linkFor('album','ydzn5sus5m1uk'),'https://open.qobuz.com/album/ydzn5sus5m1uk');
assert.equal(api.linkFor('artist','310938'),'https://open.qobuz.com/artist/310938');
assert.equal(api.linkFor('album','0001'),'https://open.qobuz.com/album/0001');
for(const [type,id] of [['track','ab'],['artist','1/2'],['album','../../password'],
 ['album','abc?token=secret'],['playlist','42'],['track',''],['track','1#frag']]){
 assert.throws(()=>api.linkFor(type,id),/Invalid Qobuz item ID/);
}
(async()=>{
 await api.share('track','426235024');
 assert.equal(called.length,1);
 assert.equal(called[0].action,'shareQobuzLink');
 assert.equal(called[0].params.locale,'uk');
 assert.equal(called[0].params.type,'track');
 assert.equal(called[0].params.id,'426235024');
 assert.equal(JSON.stringify(called[0].params).includes('token'),false);
 let prevented=false,stopped=false;
 const button={getAttribute:name=>name==='data-aurel-share-kind'?'artist':
 name==='data-aurel-share-id'?'310938':null};
 callbacks.click({
  target:{closest:selector=>selector.includes('data-aurel-share-kind')?button:null},
  preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}
 });
 assert(prevented&&stopped,'Sharing must not trigger playback or navigation');
 assert.equal(called.at(-1).params.type,'artist');
 assert.equal(called.at(-1).params.id,'310938');
 const count=called.length;
 await api.share('artist','../../oops');
 assert.equal(called.length,count,'Invalid IDs must never reach native bridge');
 assert(errors.length===1);
 console.log('AUREL Qobuz sharing tests passed: links, chooser, three kinds, locale, ID guard, navigation isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
