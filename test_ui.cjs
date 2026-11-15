const fs=require('fs'),vm=require('vm'),assert=require('assert');
const base=__dirname+'/app/src/main/assets/';
const elem=()=>({
 innerHTML:'',value:'',type:'password',textContent:'',dataset:{},scrollTop:0,
 classList:{add(){},remove(){},toggle(){}},addEventListener(){},
 querySelector(){return null},querySelectorAll(){return[]},
 setAttribute(){},style:{setProperty(){}}
});
const nodes=new Map(),listeners={};
const doc={
 querySelector(s){if(!nodes.has(s))nodes.set(s,elem());return nodes.get(s)},
 querySelectorAll(){return[]},
 addEventListener(n,fn){(listeners[n]??=[]).push(fn)}
};
const values=new Map();
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const win={AurelNative:null};
const ctx=vm.createContext({document:doc,window:win,localStorage,console,URL,Map,Promise,setTimeout,clearTimeout,JSON,Error});
for(const f of ['app.js','modern.js','murglar.js','responsive.js','polish.js']){
 const source=fs.readFileSync(base+f,'utf8');
 assert(!/data-download-|downloadTrack|downloadDiscography|openSafImport|downloadState/.test(source),f+' still has download controls');
 vm.runInContext(source,ctx,{filename:f});
}
const run=s=>vm.runInContext(s,ctx);
const cover='https://static.qobuz.com/images/covers/fl/al/123_600.jpg';
assert.strictEqual(run(`image({album:{image:{large:'${cover}'}}})`),cover);
assert.strictEqual(run("artist({artists:[{id:44,name:'Black Sabbath'}]})"),'Black Sabbath');
run("app.session={loggedIn:false,streamConnected:false,previewBuild:true,appId:'312369995',hasSecret:false};app.loginTarget='stream';renderLogin()");
const login=nodes.get('#screen').innerHTML;
assert(login.includes('Qobuz session token'));
assert(login.includes('type="password" id="token"'));
assert(login.includes('data-toggle-token'));
assert(login.includes('aurel-signin-advanced'));
assert(login.includes('App ID &amp; App Secret'));
assert(login.includes('value="312369995"'));
assert(login.includes('id="appSecret"'));
assert(login.includes('Connect Qobuz'));
assert(login.includes('This Preview is installed separately'));
assert(!login.includes('Email / password'));
assert(!login.includes('data-login-unverified'));
run("app.loginTarget='library';renderLogin()");
const libraryLogin=nodes.get('#screen').innerHTML;
assert(libraryLogin.includes('Connect library account'));
assert(libraryLogin.includes('favourites, playlists'));
assert(!libraryLogin.includes('id="appSecret"'));
run("app.session={loggedIn:true,streamConnected:true,libraryConnected:true,quality:27,appId:'312369995',streamValidation:'unverified',profile:{displayName:'Test'},libraryProfile:{displayName:'Separate'}};app.nav='settings';renderSettings()");
assert(nodes.get('#screen').innerHTML.includes('Additional library account'));
assert(nodes.get('#screen').innerHTML.includes('Separate'));
assert(nodes.get('#screen').innerHTML.includes('Not verified'));
run("app.nav='home';app.albums=[{id:'100',title:'Album',artist:{name:'Black Sabbath'}}];renderHome()");
assert(nodes.get('#screen').innerHTML.includes('Album'));
run("app.nav='search';app.searchQuery='Black Sabbath';renderSearch()");
assert(nodes.get('#screen').innerHTML.includes('Black Sabbath'));
run("app.player={track:{id:55,title:'War Pigs',artist:{name:'Black Sabbath'}},position:20000,duration:480000,playing:true,index:0,queue:[]};updateMini()");
const mini=nodes.get('#mini').innerHTML;
assert(mini.includes('War Pigs'));
assert(mini.includes('data-mini-prev'));
assert(mini.includes('data-mini-toggle'));
assert(mini.includes('data-mini-next'));
assert(mini.includes('mini-progress'));
run("app.overlay=true;app.playerSheet='';drawOverlay()");
const overlay=nodes.get('#overlay').innerHTML;
assert(overlay.includes('murglar-cover'));
assert(overlay.includes('murglar-quick-actions'));
assert(overlay.includes('Queue'));
assert(overlay.includes('Favourite'));
assert(overlay.includes('Audio'));
assert(!overlay.includes('Download'));
assert(overlay.includes('murglar-footer'));
assert(overlay.includes('data-player-nav="library"'));
assert(overlay.includes('data-player-nav="settings"'));
assert(!overlay.includes('data-player-nav="downloads"'));
const html=fs.readFileSync(base+'index.html','utf8');
assert(html.includes('aurel.css'));
assert(!html.includes('responsive.css'));
assert(!html.includes('polish.css'));
assert(!html.includes('finish.css'));
assert(!html.includes('data-nav="downloads"'));
const css=fs.readFileSync(base+'aurel.css','utf8');
assert(css.includes('prefers-reduced-motion'));
assert(css.includes('max-width:365px'));
assert(css.includes('orientation:landscape'));
assert(css.includes('min-width:700px'));
assert(css.includes('murglar-footer{flex:0 0 67px'));
assert(css.includes('aurel-token-input'));
const java=fs.readFileSync(__dirname+'/app/src/main/java/com/aurel/hires/MainActivity.java','utf8');
const api=fs.readFileSync(__dirname+'/app/src/main/java/com/aurel/hires/QobuzApi.java','utf8');
const media=fs.readFileSync(__dirname+'/app/src/main/java/com/aurel/hires/AurelPlaybackService.java','utf8');
assert(java.includes('DEFAULT_APP_ID="312369995"'));
assert(java.includes('raw=api.verifyToken(appId,token,p.optString("userId",""),true)'));
assert(java.includes('secure.put("libraryToken",token)'));
assert(java.includes('secure.put("streamToken",token)'));
assert(java.includes('secure.put("libraryAppId",appId)'));
assert(java.includes('secure.put("streamAppId",appId)'));
assert(!java.includes('AuthorizedDownloadManager'));
assert(!java.includes('openSafImport'));
assert(!java.includes('downloadTrack'));
assert(!java.includes('playDownloaded'));
assert(!api.includes('purchasedFileInfo'));
assert(!api.includes('saveDownloadConfiguration'));
assert(!fs.existsSync(__dirname+'/app/src/main/java/com/aurel/hires/AuthorizedDownloadManager.java'));
assert(api.includes('streamInfo('));
assert(api.includes('libraryPost('));
assert(media.includes('new MediaSession(this'));
console.log('AUREL v1 UI checks passed — token-only login, separate library, no downloads, responsive player and Android media controls.');
