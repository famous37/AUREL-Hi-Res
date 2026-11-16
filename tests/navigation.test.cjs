/* Navigation contract: artist -> album -> player -> album -> artist -> library.
 * Runs without Qobuz credentials, network, Android or a browser dependency.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../app/src/main/assets/aurel-continuity.js','utf8');
const appCode=fs.readFileSync(__dirname+'/../app/src/main/assets/app.js','utf8');
const data=new Map();
const stored={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
const pause=()=>new Promise(resolve=>setTimeout(resolve,15));
function createHarness(){
 const listeners={};
 const nodes={
  'overlay':{dataset:{openTrack:'song1'},querySelector(s){return s.includes('murglar-player-content')?{scrollTop:85}:null;}},
  'toast':{classList:{remove(){},add(){}}}
 };
 let scrollTop=0;
 let rendered='';
 const document={
  scrollingElement:{get scrollTop(){return scrollTop},set scrollTop(v){scrollTop=v}},
  documentElement:{get scrollTop(){return scrollTop},set scrollTop(v){scrollTop=v}},
  body:{},
  getElementById:id=>nodes[id]||null,
  querySelector(s){if(s.includes('murglar-player-content'))return null;return null},
  addEventListener(type,fn){(listeners[type]||=[]).push(fn)},
  hidden:false
 };
 const window={
  scrollY:0,
  scrollTo(_x,y){scrollTop=y;this.scrollY=y},
  addEventListener(type,fn){(listeners['window:'+type]||=[]).push(fn)}
 };
 const app={
  nav:'library',libType:'artists',searchType:'tracks',searchQuery:'',
  session:{streamConnected:true,streamValidation:'verified'},
  selected:null,selectedTracks:[],selectedKind:'',
  overlay:false,playerSheet:'',player:{track:{id:'song1'}},
  libraryItems:[{id:'17',name:'Band'}],
  libraryCache:{artists:{items:[{id:'17',name:'Band'}],time:Date.now()}}
 };
 function render(){
  rendered=app.selected?app.selectedKind+':'+app.selected.id:app.nav+':'+app.libType;
  scrollTop=0;
 }
 function drawOverlay(){}
 async function openArtist(id){app.selected={id:String(id),name:'Band'};app.selectedKind='artist';app.selectedTracks=[];render()}
 async function openAlbum(id){app.selected={id:String(id),title:'Record'};app.selectedKind='album';app.selectedTracks=[{id:'song1'}];render()}
 async function openPlaylist(id){app.selected={id:String(id)};app.selectedKind='playlist';app.selectedTracks=[];render()}
 async function navigate(tab){app.selected=null;app.selectedKind='';app.selectedTracks=[];app.nav=tab;render()}
 async function loadLibrary(){render()}
 async function loadPlaylists(){render()}
 async function search(){render()}
 async function loadHome(){render()}
 async function api(action,p){return {id:p.id,name:'Recovered '+action,title:'Recovered record'}}
 const context=vm.createContext({
  app,document,window,localStorage:stored,console,Map,Set,Number,String,
  Date,Array,JSON,Promise,Math,
  setTimeout,clearTimeout,
  render,drawOverlay,openArtist,openAlbum,openPlaylist,navigate,
  hasAuth:()=>true,loadLibrary,loadPlaylists,loadHome,search,
  api,withAlbum:(items)=>items,sliceItems:()=>[],
  showToast:()=>{},
  requestAnimationFrame:fn=>fn()
 });
 vm.runInContext(code,context,{filename:'aurel-continuity.js'});
 function scroll(y){scrollTop=y;window.scrollY=y;(listeners.scroll||[]).forEach(fn=>fn({target:document}));}
 function backButton(){
  const button={hasAttribute:()=>true};
  const event={
    target:{closest:selector=>selector==='[data-back]'?button:null},
    preventDefault(){},stopImmediatePropagation(){}
  };
  (listeners.click||[]).forEach(fn=>fn(event));
 }
 return {context,app,window,scroll,backButton,rendered:()=>rendered,y:()=>scrollTop,
  save(){(listeners['window:pagehide']||[]).forEach(fn=>fn())}};
}
(async()=>{
 const h=createHarness(),x=h.context;
 vm.runInContext('render()',x);
 h.scroll(347);
 await vm.runInContext("openArtist('17')",x);
 assert.equal(h.rendered(),'artist:17');
 h.scroll(215);
 await vm.runInContext("openAlbum('92')",x);
 assert.equal(h.rendered(),'album:92');
 h.app.overlay=true;
 h.window.AurelBack();await pause();
 assert.equal(h.app.overlay,false,'first Android Back minimizes player');
 assert.equal(h.rendered(),'album:92','minimizing keeps the album');
 h.backButton();await pause();
 assert.equal(h.rendered(),'artist:17','album Back returns to artist');
 assert.equal(h.y(),215,'artist scroll position restored');
 h.window.AurelBack();await pause();
 assert.equal(h.rendered(),'library:artists','artist Back returns to library Artists tab');
 assert.equal(h.y(),347,'library scroll position restored');
 await vm.runInContext("openArtist('17')",x);
 await vm.runInContext("navigate('settings')",x);
 h.window.AurelBack();await pause();
 assert.equal(h.rendered(),'artist:17','Back from Settings returns to previous artist');
 h.save();
 const raw=data.get('aurel_navigation_v2')||'';
 assert(raw.includes('artist')&&!raw.includes('token')&&!raw.includes('password'),'history persists IDs without credentials');
 const h2=createHarness();
 vm.runInContext('render()',h2.context);
 await pause();
 assert.equal(h2.rendered(),'artist:17','process restart restores the last artist');
 const thumb=appCode.includes("size==='thumb'?['medium','small','thumbnail'") &&
             appCode.includes("image(o,hero?'full':'thumb')");
 assert(thumb,'list thumbnails must prefer medium images and full player keeps large art');
 console.log('Navigation regression passed: player -> album -> artist -> library, scroll, settings, restart, artwork.');
})().catch(e=>{console.error(e);process.exitCode=1;});
