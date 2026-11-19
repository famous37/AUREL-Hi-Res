'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const asset=p=>source('app/src/main/assets/'+p);
const java=p=>source('app/src/main/java/com/aurel/hires/'+p);
const html=asset('index.html'),murglar=asset('murglar.js');
const lyrics=asset('aurel-stage2-lyrics.js'),library=asset('aurel-stage2-library.js');
const styles=asset('aurel-stage2.css'),continuity=asset('aurel-continuity.js');
const main=java('MainActivity.java'),client=java('AurelLyricsClient.java'),backup=java('AurelSafeBackup.java');
for(const [p,s] of Object.entries({'lyrics':lyrics,'library':library}))
  new Function(s);
assert(html.includes('aurel-stage2.css'));
assert(html.indexOf('aurel-stage2-lyrics.js')>html.indexOf('aurel-stage1-frame-pacing.js'));
assert(html.indexOf('aurel-stage2-library.js')>html.indexOf('aurel-stage2-lyrics.js'));
assert(murglar.includes('data-player-sheet="lyrics"'));
assert(murglar.includes("window.AurelStage2Lyrics?.panel?.(p)"));
assert(continuity.includes("['audio','credits','upnext','lyrics']"));
assert(asset('app.js').includes("lyrics:'<path"));
assert(styles.includes('.aurel-lyrics-line.is-current'));
assert(!styles.includes('.murglar-art-wrap{'));
assert(main.includes('case "lyrics":'));
assert(main.includes('case "stage2BackupExport":'));
assert(main.includes('case "stage2BackupImport":'));
assert(main.includes('AurelSafeBackup.REQUEST_EXPORT'));
assert(client.includes('https://lrclib.net'));
assert(client.includes('LRCLIB rate limit'));
assert(client.includes('Math.abs(candidate-seconds)>3'));
assert(client.includes('setInstanceFollowRedirects(false)'));
assert(!client.includes('X-User-Auth-Token'));
assert(backup.includes('Intent.ACTION_CREATE_DOCUMENT'));
assert(backup.includes('Intent.ACTION_OPEN_DOCUMENT'));
assert(backup.includes('aurel-safe-backup-v1'));
assert(backup.includes('aurel_listening_history_v1'));
assert(!backup.includes('"streamToken"'));
assert(!backup.includes('"libraryToken"'));
assert(asset('aurel-live-ui.js').includes('aurel_palette_colors_v1'));

const translations=new Map();
const events={};
const document={
 hidden:false,
 getElementById(id){return id==='overlay'?{querySelector(){return null;}}:null;},
 addEventListener(name,fn){events[name]=fn;},
 querySelector(){return null;}
};
const ctx=vm.createContext({
 console,window:{AurelLanguage:{get:()=> 'en'}},document,
 app:{overlay:false,player:null,playerSheet:'',nav:'library'},
 drawOverlay(){},
 nativeCall:async()=>({status:'missing'}),
 artistLabel:o=>o?.artist?.name||'Artist',
 html:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),
 requestAnimationFrame(){return 1;},cancelAnimationFrame(){},
 Date,Math,Number,JSON,Set,Map,
});
vm.runInContext(lyrics,ctx,{filename:'aurel-stage2-lyrics.js'});
const parse=ctx.window.AurelStage2Lyrics.parseLrc;
const timed=parse('[ar:Artist]\n[00:04.50][00:07.250]Hello world\n[offset:+100]\n[00:09.000]Next line');
assert.equal(timed.length,3);
assert.equal(timed[0].at,4600);
assert.equal(timed[1].at,7350);
assert.equal(timed[2].at,9100);
assert.equal(timed[0].text,'Hello world');
assert.equal(parse('[ar:Artist]\n[ti:Song]').length,0);
assert.equal(parse('[999:99.2]Invalid').length,0);
assert.equal(parse('[00:01.000]<script>x</script>')[0].text,'<script>x</script>');
assert(lyrics.includes('html(line.text)'),'LRC text must be escaped before innerHTML');

const stored=new Map(),eventListeners={};
const historyContext=vm.createContext({
 console,Date,Math,Number,JSON,Set,Map,
 window:{AurelLanguage:{get:()=> 'en'},AurelPersistNow(){}},
 document:{getElementById(){return null;},querySelector(){return null;},
  addEventListener(name,fn){eventListeners[name]=fn;}},
 localStorage:{getItem:key=>stored.has(key)?stored.get(key):null,
  setItem:(key,value)=>stored.set(key,value)},
 app:{nav:'library',overlay:false,playerSheet:''},
 renderSettings(){},renderHome(){},showToast(){},
 artistLabel:track=>track.artist?.name||'Artist',
 ic:()=>'',html:val=>String(val),nativeCall:async()=>({pickerOpened:true})
});
historyContext.window.AurelEvent=()=>{};
vm.runInContext(library,historyContext,{filename:'aurel-stage2-library.js'});
let player={playing:true,buffering:false,error:'',
 position:44000,track:{id:100,title:'Track A',artist:{name:'Singer'},album:{id:'A1',title:'An Album'}}};
historyContext.window.AurelEvent('player',player);
assert.equal(historyContext.window.AurelListeningHistory.get().length,1);
assert.equal(historyContext.window.AurelListeningHistory.get()[0].title,'Track A');
historyContext.window.AurelEvent('player',{...player,position:60000});
assert.equal(historyContext.window.AurelListeningHistory.get().length,1);
historyContext.window.AurelEvent('player',{...player,playing:false,
 track:{...player.track,id:101,title:'Paused'}}); // do not record
assert.equal(historyContext.window.AurelListeningHistory.get().length,1);
const exported=historyContext.window.AurelListeningHistory.makeBackup();
const json=JSON.parse(exported);
assert.equal(json.format,'aurel-safe-backup-v1');
assert(json.data.aurel_listening_history_v1);
assert(!/streamToken|authToken|libraryToken|appSecret|password/i.test(exported));
assert.throws(()=>historyContext.window.AurelListeningHistory.restoreBackup(
 JSON.stringify({format:'aurel-safe-backup-v1',data:{streamToken:'secret'}})));
historyContext.window.AurelListeningHistory.clear();
assert.equal(historyContext.window.AurelListeningHistory.get().length,0);
historyContext.window.AurelListeningHistory.restoreBackup(exported);
assert.equal(historyContext.window.AurelListeningHistory.get().length,1);
console.log('Stage 2 lyrics parser, safe native bridge, listening history, backup and palette PASS');
