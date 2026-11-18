/* AUREL favourites / graphite regression. Does not require Qobuz credentials. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const qobuz=read('app/src/main/java/com/aurel/hires/QobuzApi.java');
const favCode=read('app/src/main/assets/aurel-favourites.js');
const themeCode=read('app/src/main/assets/aurel-live-ui.js');
const css=read('app/src/main/assets/aurel-graphite.css');
const html=read('app/src/main/assets/index.html');
const disco=read('app/src/main/assets/aurel-discography.js');
for(const term of ['case "favoriteIds"','case "favoriteRemove"','case "favoriteAdd"',
 'favorite/getUserFavoriteIds','favorite/getUserFavorites','favorite/delete','favorite/create',
 'new JSONObject().put("track_ids","")','return api.libraryPost(remove?"favorite/delete":"favorite/create",body)']){
 assert(native.includes(term),'Missing native favorite contract: '+term);
}
assert(native.includes('if(!type.equals("albums")&&!type.equals("tracks")&&!type.equals("artists"))'));
assert(native.includes('if(!id.matches("[A-Za-z0-9_-]{1,80}"))'));
assert(native.includes('private JSONObject favoriteIdentifiers()'));
assert(native.includes('offset+=items.length()')&&native.includes('if(items.length()==0||offset>=total)break'));
assert(qobuz.includes('JSONObject libraryPost('));
assert(disco.includes("window.AurelFavoriteToggle('artists',id,b)"));
assert(html.includes('href="aurel-graphite.css"'),'Graphite theme must remain enabled');
assert(html.indexOf('aurel-graphite.css')<html.indexOf('aurel-share.css'),'Share tweaks load after graphite');
assert(html.includes('<script src="aurel-favourites.js"></script>'),'Favourites must remain enabled');
assert(html.indexOf('aurel-favourites.js')<html.indexOf('aurel-share.js'),'Sharing loads after favourites');
assert(themeCode.includes("artworkPalette=localStorage.getItem(PALETTE_KEY)==='on'"));
assert(themeCode.includes("const baseTheme={bg:'#111214',surface:'#202124',accent:'#D5D7DB',"));
assert(themeCode.includes("one:'#82878D'"),'Monochrome theme has neutral ambient color defaults');
assert(themeCode.includes("setTheme(artworkPalette?(themeByCover.get(next)||baseTheme):baseTheme)"));
assert(themeCode.includes("if(artworkPalette&&coverNow()===url)"));
assert(css.includes('prefers-reduced-motion:reduce')&&css.includes('aurel-soft-enter'));
assert(css.includes('.aurel-shelf-shell')&&css.includes('.aurel-artist-item'));
assert(css.includes('font-size:15.6px!important')&&css.includes('font-size:14.3px!important'));
assert(!/downloadTrack|downloadDiscography/.test(favCode),'No download feature added.');
let controlState={pressed:null,classes:new Set(),text:'♡'};
const control={
 dataset:{likeTrack:'11'},
 hasAttribute:k=>k==='data-like-track',
 getAttribute:k=>k==='data-like-track'?'11':null,
 setAttribute(k,v){if(k==='aria-pressed')controlState.pressed=v;},
 removeAttribute(){},
 classList:{
  toggle(name,on){if(on)controlState.classes.add(name);else controlState.classes.delete(name);},
  contains(name){return controlState.classes.has(name);}
 },
 querySelector(){return null},
 get textContent(){return controlState.text},
 set textContent(t){controlState.text=t},
 closest(){return null}
};
const document={
 querySelectorAll(selector){return selector.includes('data-like-track')?[control]:[];},
 getElementById(){return null},
 addEventListener(){},
};
const app={
 nav:'home',libType:'tracks',session:{
   streamConnected:true,mornyeConfigured:false,streamUserId:'100',appId:'111111'
 },libraryItems:[],libraryCache:Object.create(null)
};
const history=[];
let failRemove=false;
let user=1;
const nativeCall=async(action,data)=>{
 history.push({action,data});
 if(action==='favoriteIds')return user===1?
  {tracks:['11'],albums:['00022'],artists:['7']}:
  {tracks:['99'],albums:[],artists:[]};
 if(action==='favoriteRemove'&&failRemove)throw new Error('HTTP 403');
 if(action==='favoriteRemove'||action==='favoriteAdd')return {status:'success'};
 throw new Error('Unsupported native request '+action);
};
const notices=[];
const win={};
const sandbox=vm.createContext({
 window:win,document,app,nativeCall,showToast:t=>notices.push(t),
 like:async()=>{},console,setTimeout:()=>0,clearTimeout:()=>{},
 Date,Set,Promise,String,Object,Array
});
vm.runInContext(favCode,sandbox,{filename:'aurel-favourites.js'});
(async()=>{
 const f=win.AurelFavourites;
 assert.equal(f.isSaved('tracks','11'),false,'State not guessed before provider fetch');
 await f.ensureLoaded();
 assert.equal(f.isSaved('tracks','11'),true);
 assert.equal(f.isSaved('albums','00022'),true,'Keep leading zeros on album ID');
 assert.equal(f.isSaved('artists','7'),true);
 assert.equal(controlState.pressed,'true');
 assert.equal(controlState.text,'♥');
 await f.toggle('tracks','11');
 assert.equal(f.isSaved('tracks','11'),false);
 assert.equal(controlState.pressed,'false');
 assert.equal(controlState.text,'♡');
 assert.equal(history.at(-1).action,'favoriteRemove');
 await f.toggle('tracks','11');
 assert.equal(f.isSaved('tracks','11'),true);
 assert.equal(history.at(-1).action,'favoriteAdd');
 failRemove=true;
 const failed=await f.toggle('tracks','11');
 assert.equal(failed,false,'Failed removal should be reported');
 assert.equal(f.isSaved('tracks','11'),true,'Failed removal must roll back');
 assert.equal(controlState.pressed,'true');
 assert(notices.some(s=>String(s).includes('HTTP 403')));
 failRemove=false;
 app.session.streamUserId='200';user=2;
 await f.ensureLoaded();
 assert.equal(f.isSaved('tracks','11'),false,'Do not leak prior account favourites');
 assert.equal(f.isSaved('tracks','99'),true);
 assert.equal(f.isSaved('albums','00022'),false);
 app.session={streamConnected:false,mornyeConfigured:true,libraryConnected:false};
 const invalid=await f.toggle('tracks','11');
 assert.equal(invalid,false,'Mornye-only sessions cannot mutate another user library');
 assert(notices.some(s=>String(s).includes('Connect a personal Qobuz library')));
 console.log('AUREL favourites tests passed: add, remove, rollback, album IDs, cross-screen state, account isolation, Mornye guard, theme.');
})().catch(err=>{console.error(err);process.exitCode=1;});
