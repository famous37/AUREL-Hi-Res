/* AUREL 1.1.26: pre-release rights and calm playback regression. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),source=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=source('app/src/main/assets/aurel-access.js');
const native=source('app/src/main/java/com/aurel/hires/MainActivity.java');
const java=source('app/src/main/java/com/aurel/hires/TrackAccess.java');
const app=source('app/src/main/assets/app.js');
const modern=source('app/src/main/assets/modern.js');
const player=source('app/src/main/assets/murglar.js');
const page=source('app/src/main/assets/index.html');
const css=source('app/src/main/assets/aurel-release.css');
const motion=source('app/src/main/assets/aurel-motion.js');
const gradle=source('app/build.gradle');
const language=source('app/src/main/assets/aurel-language.js');
assert(gradle.includes('versionCode 45')&&gradle.includes("'1.1.26'"));
assert(page.indexOf('aurel-access.js')<page.indexOf('app.js'));
assert(page.includes('aurel-release.css'));
assert(page.indexOf('aurel-smooth.css')<page.indexOf('aurel-release.css'));
assert(app.includes('data-play-index')&&app.includes('aurel-unavailable-track'));
assert(app.includes('aurel-track-unavailable')&&app.includes("access.future?'Coming soon':'Unavailable'"));
assert(app.includes('if(!state.playable){showToast(state.reason'));
assert(app.includes("const playable=[];let mapped=-1"));
assert(app.includes('if(i===index)mapped=playable.length'));
assert(app.includes("tracks.findIndex(t=>window.AurelTrackAccess?.canPlay(t)!==false)"));
assert(modern.includes("if(!access.playable){showToast(access.reason"));
assert(modern.includes("data-queue-play")&&modern.includes("state.playable?'':'disabled'"));
assert(native.includes('String deny=TrackAccess.reason(selected);'));
assert(native.includes('data=param("queued",eligible.size())'));
assert(native.includes('if(track!=null&&TrackAccess.playable(track))eligible.add(track);'));
assert(native.includes('if(!TrackAccess.playable(queue.get(index)))return;'));
assert(native.includes('final String denial=TrackAccess.reason(queue.get(queueIndex));'));
assert(native.includes('for(int checked=0;checked<total;checked++)'));
assert(native.includes('if(i!=queueIndex&&TrackAccess.playable(queue.get(i)))eligible.add(i);'));
assert(java.includes('LocalDate.now(ZoneId.systemDefault())'));
assert(java.includes('track.optBoolean("streamable",false)'));
assert(java.includes('track.optString("release_date_stream"'));
assert(java.includes('if(!trackStreamable&&!datedTrack)'));
assert(java.includes('return null; // Not known unavailable'));
assert(css.includes('.aurel-unavailable-track')&&css.includes('button[disabled]'));
assert(modern.includes('if(viewChanged)drawOverlay();'));
assert(modern.includes("if(badge&&badge.textContent!==text)badge.textContent=text;"));
assert(player.includes("if(toggle.dataset.icon!==mode)"));
assert(player.includes("if(repeatButton.dataset.mode!==String(p.repeat))"));
assert(motion.includes('duration:190'));
assert(language.includes('Доступно для прослуховування з '));
new Function(js);new Function(player);new Function(modern);new Function(motion);
const window={};const context=vm.createContext({window,Date});
vm.runInContext(js,context,{filename:'aurel-access.js'});
const status=window.AurelTrackAccess.status;
const past='2000-01-01',future='2099-12-31';
const upcoming={id:101,streamable:false,release_date_stream:future,
 album:{release_date_stream:future}};
assert.equal(status(upcoming).playable,false,'Unreleased track must be blocked');
assert.equal(status(upcoming).future,true);
assert.equal(status(upcoming).date,future);
assert.equal(status({id:2,streamable:false,previewable:true,album:{release_date_stream:past}}).playable,false,
 'Preview access is not full-track streaming');
assert.equal(status({id:3,streamable:true,album:{release_date_stream:future}}).playable,true,
 'Previously released single remains playable on upcoming album');
assert.equal(status({id:4,streamable:true,release_date_stream:future}).playable,false,
 'Future per-track streaming date must win over ambiguous streamable flag');
assert.equal(status({id:5,streamable:true,release_date_stream:past}).playable,true);
assert.equal(status({id:6,album:{release_date_stream:future}}).playable,false,
 'Future album and missing track entitlement should be blocked');
assert.equal(status({id:7,release_date_stream:past,album:{release_date_stream:future}}).playable,true,
 'A previously published song needs no upcoming-album lock');
assert.equal(status({id:8,album:{release_date_original:future}}).playable,false);
assert.equal(status({id:9,release_date_original:future}).playable,false);
assert.equal(status({id:10,streamable:true,release_date_original:future}).playable,true,
 'An actual early single entitlement must trump the album original date');
assert.equal(status({id:11,streamable:true}).playable,true);
assert.equal(status({id:12,title:'Unknown rights'}).playable,true,
 'Missing rights information alone must not deny released music');
assert.equal(status({id:13,release_date_stream:'invalid',album:{release_date_original:past}}).playable,true);
assert.equal(status(null).playable,false);
assert.equal(status({id:15,released:false}).playable,false);
const singles=[
 {id:'early',streamable:true,album:{release_date_stream:future}},
 {id:'later',streamable:false,album:{release_date_stream:future}},
 {id:'early2',streamable:true,album:{release_date_stream:future}}
];
assert.deepEqual(singles.filter(window.AurelTrackAccess.canPlay).map(x=>x.id),
 ['early','early2'],'Album playback must keep the two published singles');
const uk=source('app/src/main/assets/aurel-language.js');
assert(uk.includes("Доступно для прослуховування з "));
console.log('Qobuz pre-release, published singles, playlist rights and smooth player tests passed.');
