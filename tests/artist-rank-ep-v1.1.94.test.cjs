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
assert(native.includes('.put("extra","topTracks")'), 'Prefer ranked Qobuz top_tracks');
assert(native.includes('artistInformation("artist/page"'), 'Preserve standard artist/page fallback');
assert(native.includes('extras.put("_topFallback",fallback.optBoolean("_fallback",true))'));
assert(native.includes('if(!artistId.equals(actual))continue'), 'Unranked track-search fallback must be artist ID-verified');
assert(disc.includes('function normalizedPopularTracks(collection,ownerId)'));
assert(disc.includes('s.top=normalizedPopularTracks(data?.top_tracks||data?.topTracks,id)'));
assert(disc.includes('new Promise((_,reject)=>'));
assert(disc.includes("action==='artistReleaseType'?24000:28000"));
assert(disc.includes('if(timer!==null)clearTimeout(timer)'));
assert(disc.includes('if(token!==requestToken||!validSelection(id))return'));
assert(disc.includes('cached.epDone&&'));
assert(disc.includes('cached.pageDone&&cached.compDone'));
assert(disc.includes('state.epDone=false'));
assert(disc.includes("fallback?'Tracks by artist':'Most popular'"));
assert(disc.includes("ranked?(i+1):'♪'"));
assert(disc.includes("state.topFallback?'Play tracks':'Play popular'"));
assert(language.includes("'Tracks by artist':'Треки виконавця'"));
assert(/versionCode\s+111/.test(gradle)&&gradle.includes("'1.1.94'"));

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