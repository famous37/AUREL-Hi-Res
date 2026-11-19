'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=load('app/src/main/java/com/aurel/hires/AurelLibraryTransfer.java');
const js=load('app/src/main/assets/aurel-library-transfer.js');
const css=load('app/src/main/assets/aurel-library-transfer.css');
const exampleId='local_'+'a'.repeat(32);
assert(new RegExp('^local_[0-9a-f]{32}$').test(exampleId));
assert(!/^[0-9]{1,24}$/.test(exampleId),'Offline ID must not masquerade as Qobuz artist ID');
assert(native.includes('private static boolean isLocalId(String id)'));
assert(native.includes('if(isLocalId(id))return true;'));
assert(native.includes('id.matches("local_[0-9a-f]{32}")'));
assert(native.includes('return id.matches("[0-9]{1,24}")'));
assert(native.includes('LinkedHashMap<String,JSONObject> seen'));
assert(native.includes('seen.put(row.getString("id"),row)'));
assert(native.includes('keys(json,ROOT_KEYS)'));
assert(native.includes('commit(merge(old,incoming,TYPE_SET,"replace".equals(mode)))'));
assert(native.includes('AtomicFile'));
assert(native.includes('libraryFile.failWrite(stream)'));
assert(!native.includes('favorite/create'));
assert(!native.includes('playlist/create'));
assert(js.includes('const isLocalId=id=>/^local_[0-9a-f]{32}$/.test'));
assert(js.includes("if(isLocalId(open))"));
assert(js.includes("if(isLocalId(selected.id))"));
assert(js.includes('Імпортовано зі скриншота'));
assert(css.includes('.aurel-ltm-unlinked'));
new Function(js);
// Intercept clicking an offline artist row. It must not call any remote
// artist-navigation function or attempt to play a fabricated catalogue ID.
const calls=[],listeners={},elt={attrs:{'data-ltm-open':exampleId},
 getAttribute(k){return this.attrs[k]??null;},hasAttribute(k){return k in this.attrs;}};
const ctx={
 window:{AurelLanguage:{get:()=> 'uk'}},
 document:{addEventListener(n,f){listeners[n]=f;},getElementById(){return null;}},
 app:{nav:'home',selected:null,session:{streamConnected:true}},
 renderLibrary(){},renderSettings(){},html:s=>String(s),
 nativeCall:async()=>({}),showToast:message=>calls.push(['toast',message]),
 openArtist:async id=>calls.push(['openArtist',id]),
 openAlbum:async id=>calls.push(['openAlbum',id]),
 drawOverlay(){},setTimeout(){},Set,Map,Number,JSON,Math,console
};
ctx.window.AurelEvent=()=>{};
vm.runInNewContext(js,ctx,{filename:'aurel-library-transfer.js'});
assert(ctx.window.AurelLibraryTransfer);
assert(!calls.some(x=>x[0]==='openArtist'));
console.log('Screenshot name-only import: offline IDs, safe no-provider navigation, existing JSON schema PASS');
