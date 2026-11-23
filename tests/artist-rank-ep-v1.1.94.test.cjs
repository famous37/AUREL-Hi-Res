'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const disc=read('app/src/main/assets/aurel-discography.js');
const language=read('app/src/main/assets/aurel-language.js');
const gradle=read('app/build.gradle');
new Function(disc);new Function(language);
const ep=native.slice(native.indexOf('case "artistReleaseType": {'),
  native.indexOf('case "resolveArtist":'));
assert(ep.includes('data=artistReleaseList(artistId,releaseType)'), 'EPs must use Qobuz epSingle directly');
assert(!ep.includes('?artistReleaseFromAll(artistId,releaseType)'),
  'Do not first load all albums and guess EPs from incomplete per-item type metadata');
assert(native.includes('final int pageSize=kind.equals("epSingle")?50:100'));
assert(native.includes('final int maxPages=kind.equals("epSingle")?3:8'));
assert(native.includes('.put("release_type",kind)'));
assert(native.includes('.put("extra","topTracks")'), 'Request official artist/page ranking expansion');
assert(native.includes('artistInformation("artist/page"'), 'Preserve standard artist/page fallback');
assert(native.includes('extras.put("_topError"'), 'Explain unavailable official ranking');
assert(!native.includes('artistTrackFallback(artistId)'), 'Never run unranked track search to populate popularity');
assert(!native.includes('private JSONObject artistTrackFallback('), 'Delete misleading artist search ranking');
assert(disc.includes('function normalizedPopularTracks(collection,ownerId)'));
assert(disc.includes('const official=normalizedPopularTracks(data?.top_tracks||data?.topTracks,id)'));
assert(disc.includes('new Promise((_,reject)=>'));
assert(disc.includes("action==='artistReleaseType'?24000:28000"));
assert(disc.includes('if(timer!==null)clearTimeout(timer)'));
assert(disc.includes('if(token!==requestToken||!validSelection(id))return'));
assert(disc.includes('cached.epDone&&'));
assert(disc.includes('cached.pageDone&&cached.compDone'));
assert(disc.includes('state.epDone=false'));
assert(disc.includes("+'Most popular'+'</h2>'"));
assert(!disc.includes('Tracks by artist'), 'Never display generic artist tracks as popular');
assert(disc.includes("'+(i+1)+'</span>"), 'Qobuz ranking order is numbered');
assert(!disc.includes('topFallback'), 'Unranked popularity mode removed');
assert(language.includes("'Tracks by artist':'Треки виконавця'"));
assert(/versionCode\s+120/.test(gradle)&&gradle.includes("'1.2.3'"));

const start=disc.indexOf('  function normalizedPopularTracks(');
const end=disc.indexOf('  function loadExtras(',start);
assert(start>=0&&end>start);
const extracted=disc.slice(start,end);
const make=new Function('asList','safeId',extracted+'\nreturn normalizedPopularTracks;');
const asList=o=>Array.isArray(o)?o:Array.isArray(o?.items)?o.items:[];
const safeId=o=>o?.id==null?'':String(o.id);
const normalize=make(asList,safeId);
const example=[
  {track:{id:'1',title:'Qobuz top hit',artist:{id:'42'}}},
  {track:{id:'2',title:'Another artist song',artist:{id:'99'}}},
  {track:{id:'1',title:'Duplicate Qobuz hit',artist:{id:'42'}}},
  {id:'3',title:'Artist verified through album',album:{artist:{id:'42'}}},
  {id:'4',title:'Known unrelated album owner',album:{artist:{id:'101'}}}
];
assert.deepEqual(normalize({items:example},'42').map(t=>t.id),['1','3'],
 'Unrelated artists and duplicates must not appear in an artist popularity block');
assert.deepEqual(normalize({items:[]},'42'),[]);
console.log('Direct Qobuz EP type, bounded async loading and genuine ranked artist tracks PASS');