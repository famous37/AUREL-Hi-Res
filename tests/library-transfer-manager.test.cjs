'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const src=name=>fs.readFileSync(path.join(root,name),'utf8');
const java=src('app/src/main/java/com/aurel/hires/AurelLibraryTransfer.java');
const native=src('app/src/main/java/com/aurel/hires/MainActivity.java');
const js=src('app/src/main/assets/aurel-library-transfer.js');
const css=src('app/src/main/assets/aurel-library-transfer.css');
const html=src('app/src/main/assets/index.html');
new Function(js);
assert(html.includes('aurel-library-transfer.css'));
assert(html.includes('<script src="aurel-library-transfer.js"></script>'));
assert(html.indexOf('aurel-library-transfer.js')>html.indexOf('aurel-stage2-library.js'),
  'Manager must extend the complete player interface last');
assert(css.includes('#aurel-library-transfer')&&!css.includes('.murglar-player{'));
assert(native.includes('case "libraryTransferSync":'));
assert(native.includes('case "libraryTransferImport":'));
assert(native.includes('case "libraryTransferExport":'));
assert(native.includes('case "libraryTransferStatus":'));
assert(native.includes('case "libraryTransferCancel":'));
assert(native.includes('case "libraryTransferBrowse":'));
assert(native.includes('case "libraryTransferPlaylist":'));
assert(native.includes('case "libraryTransferClear":'));
assert(native.includes('AurelLibraryTransfer.REQUEST_IMPORT'));
assert(native.includes('libraryTransfer.onActivityResult'));
assert(native.includes('if(libraryTransfer!=null)libraryTransfer.close()'));
assert(java.includes('AtomicFile'),'Settings and library must be crash-safe');
assert(java.includes('libraryFile.startWrite()'));
assert(java.includes('libraryFile.finishWrite(stream)'));
assert(java.includes('libraryFile.failWrite(stream)'));
assert(java.includes('Intent.ACTION_OPEN_DOCUMENT'));
assert(java.includes('Intent.ACTION_CREATE_DOCUMENT'));
assert(java.includes('MAX_BYTES=12*1024*1024'));
assert(java.includes('MAX_PLAYLIST_TRACKS=1500'));
assert(java.includes('format'));
assert(java.includes('aurel-library-transfer-v1'));
assert(java.includes('validate(new JSONObject('));
assert(java.includes('merge(old,incoming,TYPE_SET,"replace".equals(mode))'));
assert(java.includes('if(!replace||!selected.contains(type))'));
assert(java.includes('seen.put(row.getString("id"),row)'),
  'Global favourite records must be deduplicated by Qobuz ID');
assert(java.includes('Duplicate playlist occurrences are intentional'));
assert(java.includes('for(int i=0;i<raw.length();i++)'));
assert(java.includes('if(!TYPE_SET.contains(type))'));
assert(java.includes('if(!FORMAT.equals(json.optString("format")))'));
assert(java.includes('keys(item,type.equals("artists")?ARTIST_KEYS'));
assert(!java.includes('favorite/create'));
assert(!java.includes('favorite/delete'));
assert(!java.includes('playlist/create'));
assert(!java.includes('playlist/update'));
assert(!java.includes('stream_url'));
assert(!java.includes('X-User-Auth-Token'));
assert(java.includes('secure.get("libraryToken")'),
 'Remote sync must require a separately connected source account');
assert(java.includes('if(now.isEmpty()||!now.equals(token))'),
 'Never silently switch account partway through transfer');
assert(java.includes('Operation cancelled; existing library unchanged'));
assert(js.includes('Library Import / Export'));
assert(js.includes('Імпорт та експорт бібліотеки'));
assert(js.includes('window.AurelEvent=function(kind,data)'));
assert(js.includes("libraryTransferSync"));
assert(js.includes("libraryTransferBrowse"));
assert(js.includes("libraryTransferPlaylist"));
assert(js.includes("libraryTransferCancel"));
assert(js.includes("libraryTransferExport"));
assert(js.includes("libraryTransferImport"));
assert(js.includes("libraryTransferClear"));
assert(js.includes("confirm:'CLEAR LOCAL LIBRARY'"));
assert(js.includes("if(state.pending==='replace')"));
assert(js.includes("esc(item.id)"));
assert(js.includes("esc(name||'Untitled')"));
assert(js.includes("state.selected=new Set")===false);
assert(!js.includes('localStorage.setItem("libraryToken"'));
const listeners={},ctx={
 window:{},app:{nav:'home',session:null,selected:null},
 document:{getElementById(){return null;},addEventListener(name,fn){listeners[name]=fn;}},
 renderSettings(){},renderLibrary(){},html:val=>String(val).replaceAll('<','&lt;'),
 nativeCall:async()=>({}),drawOverlay(){},showToast(){},openArtist(){},openAlbum(){},
 setTimeout(){},console,Set,Map,Number,JSON
};
vm.runInNewContext(js,ctx);
assert(ctx.window.AurelLibraryTransfer);
assert.equal(ctx.window.AurelLibraryTransfer.status().busy,false);
console.log('AUREL Library Transfer — validated SAF, pagination, safe JSON, no remote mutation, UI PASS');
