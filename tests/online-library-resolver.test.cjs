'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const code=read('app/src/main/assets/aurel-online-library.js');
const java=read('app/src/main/java/com/aurel/hires/AurelLibraryTransfer.java');
const main=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const transfer=read('app/src/main/assets/aurel-library-transfer.js');
const css=read('app/src/main/assets/aurel-online-library.css');
const index=read('app/src/main/assets/index.html');
new Function(code);
assert(index.includes('aurel-online-library.js'));
assert(index.indexOf('aurel-online-library.js')>index.indexOf('aurel-library-transfer.js'));
assert(index.includes('aurel-online-library.css'));
assert(css.includes('#aurel-online-resolver'));
assert(!css.includes('.murglar-player{'));
assert(java.includes('Arrays.asList("id","name","linkedId")'));
assert(java.includes('Arrays.asList("id","title","artist","linkedId")'));
assert(java.includes('private static boolean validProviderId(String id,String type)'));
assert(java.includes('if(!isLocalId(id)||!validProviderId(linkedId,type))'));
assert(java.includes('synchronized JSONObject link(JSONObject options)'));
assert(java.includes('if(busy)throw new Exception("Finish the current library transfer first")'));
assert(java.includes('item.remove("linkedId")'));
assert(java.includes('commit(stored)'));
assert(java.includes('row.optString("linkedId")'));
assert(main.includes('case "libraryTransferLink":'));
assert(main.includes('data=libraryTransfer.link(p);'));
assert(main.includes('catalog("playlist/search"'));
assert(main.includes('api.library("playlist/getUserPlaylists"'));
assert(main.includes('data=api.library(endpoint,query);'));
assert(main.includes('data=catalog("playlist/get",args);'));
assert(transfer.includes('window.AurelOnlineLibraryResolver.open'));
assert(transfer.includes("data-ltm-relink"));
assert(!transfer.includes("Stored locally without a Qobuz ID. Find the artist"));
assert(code.includes("await nativeCall('libraryTransferLink'"));
assert(code.includes("const verified=entry.candidates.filter(row=>exact(entry.item,row,entry.type))"));
assert(code.includes("verified.length===1"));
assert(code.includes('entry.forceChoice'));
assert(code.includes("if(type==='artists')return openArtist"));
assert(code.includes("if(type==='albums')return openAlbum"));
assert(code.includes("if(type==='playlists')"));
assert(code.includes("if(type==='tracks')return onlineTrack"));
assert(!code.includes('favorite/create'));
assert(!code.includes('favoriteAdd'));
assert(!code.includes('stream_url'));
const localId='local_'+'a'.repeat(32);
const called=[];
const dom=new Map(),events={};
const body={appendChild(node){dom.set(node.id,node)}};
const doc={
 body,
 getElementById(id){return dom.get(id)||null},
 createElement(){
  return {
   id:'',innerHTML:'',setAttribute(){},
   remove(){dom.delete(this.id)}
  };
 },
 addEventListener(name,fn){events[name]=fn;}
};
const context={
 window:{AurelLanguage:{get:()=> 'uk'},AurelLibraryTransfer:{onLinked:()=>called.push(['refreshed'])}},
 document:doc,
 app:{selected:null,nav:'library',session:{streamConnected:true}},
 html:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;'),
 api:async(action,options)=>{
  called.push(['search',action,options.type,options.query]);
  if(action!=='search')throw Error('unexpected catalogue call');
  if(options.type==='artists')return {artists:{items:[{id:151,name:'Iron Maiden'}]}};
  if(options.type==='albums')return {albums:{items:[
   {id:'1234567890123',title:'Same',artist:{name:'Wrong'}}
  ]}};
  return {playlists:{items:[]}};
 },
 sliceItems:(payload,type)=>payload[type]?.items||[],
 nativeCall:async(action,payload)=>{
  called.push(['bridge',action,payload]);return {linkedId:payload.providerId};
 },
 openArtist:async id=>{called.push(['openArtist',id]);context.app.selected={id};},
 openAlbum:async id=>{called.push(['openAlbum',id]);context.app.selected={id};},
 openPlaylist:async id=>{called.push(['openPlaylist',id]);context.app.selected={id};},
 playFromTracks:async()=>true,navigate:async()=>{},
 renderSearch(){},search:async()=>{},showToast:()=>{},
 Set,Map,Number,String,JSON,console
};
vm.runInNewContext(code,context,{filename:'aurel-online-library.js'});
const resolver=context.window.AurelOnlineLibraryResolver;
assert(resolver);
assert(resolver.validProviderId('151','artists'));
assert(resolver.validProviderId('1234567890123','albums'));
assert(!resolver.validProviderId(localId,'artists'));
assert(!resolver.validProviderId('Qobuz','artists'));
assert(resolver.matchExact({name:'AC/DC'},{name:'ac/dc'},'artists'));
assert(!resolver.matchExact({name:'Metallica'},{name:'Metallica Tribute'},'artists'));
assert(!resolver.matchExact({title:'Same',artist:'Right'},
 {title:'Same',artist:{name:'Wrong'}},'albums'));
(async()=>{
 await resolver.open({id:localId,name:'Iron Maiden'},'artists');
 assert(called.some(v=>v[0]==='search'&&v[2]==='artists'));
 assert(called.some(v=>v[0]==='bridge'&&v[1]==='libraryTransferLink'&&v[2].providerId==='151'));
 assert(called.some(v=>v[0]==='openArtist'&&v[1]==='151'));
 assert(called.some(v=>v[0]==='refreshed'));
 called.length=0;
 await resolver.open({id:localId,name:'Iron Maiden',linkedId:'151'},'artists');
 assert(!called.some(v=>v[0]==='search'),'Saved match must open without another search');
 assert(called.some(v=>v[0]==='openArtist'&&v[1]==='151'));
 called.length=0;
 await resolver.open({id:localId,title:'Same',artist:'Right'},'albums');
 assert(!called.some(v=>v[0]==='bridge'),'Different-artist album must not bind automatically');
 assert(!called.some(v=>v[0]==='openAlbum'),'Different-artist album must not open automatically');
 resolver.close();
 console.log('Online library resolver: unique exact match, saved-ID shortcut and ambiguity protection PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
