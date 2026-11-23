'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const disc=read('app/src/main/assets/aurel-discography.js');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const fallback=read('app/src/main/java/com/aurel/hires/AurelArtistDiscoveryFallback.java');
const css=read('app/src/main/assets/aurel-discography.css');
const uk=read('app/src/main/assets/aurel-language.js');
const gradle=read('app/build.gradle');
new Function(disc);
new Function(uk);

// If official artist/page is not authorized, a separate public music chart
// can rank real Qobuz records; the audio engine must never receive Deezer IDs.
assert(native.includes('case "artistPublicFallback": {'));
assert(native.includes('new AurelArtistDiscoveryFallback('));
assert(fallback.includes('https://api.deezer.com/'));
assert(fallback.includes('artist/"+deezerId+"/top?limit=16'));
assert(fallback.includes('artist/"+deezerId+"/albums?limit=100'));
assert(fallback.includes('owner(record,ownerId,artistName)'));
assert(fallback.includes('if(chosen!=null&&seen.add(safeId(chosen)))matched.put(chosen)'));
assert(fallback.includes('matched.put(verified)'));
assert(!fallback.includes('new JSONObject().put("id",external.optString("id"'));
assert(!fallback.includes('track/getFileUrl'));
assert(!fallback.includes('download_url'));
assert(!fallback.includes('streamAppSecret'));
assert(disc.includes("action==='artistPublicFallback'?57000"));
assert(disc.includes('function startIndependentArtistCatalog(id,token)'));
assert(disc.includes("s.topSource='deezer'"));
assert(disc.includes("s.epSource='deezer'"));
assert(!disc.includes('<small class="aurel-artist-data-source">'), 'No visible caption should crowd Most popular heading');
assert(disc.includes('aria-label="Most popular (Deezer ranking, Qobuz playback)"'), 'Keep source information accessible without a visible label');
assert(disc.includes('Deezer categories · Qobuz albums'));
assert(!css.includes('.aurel-artist-data-source'));
assert(uk.includes('Рейтинг Deezer · відтворення через Qobuz'));

// 2026 reissues must never silently replace the verified 2006 original.
// Newer DISTINCT works still supersede older originals.
const start=disc.indexOf('  function canonicalLatestRelease(');
const end=disc.indexOf('  function detailFor(',start);
assert(start>=0&&end>start);
const code=disc.slice(start,end);
const safeId=o=>String(o?.id||'');
const releaseDate=o=>String(o?.release_date_original||o?.release_date_stream||o?.release_date||'').slice(0,10);
const canonicalLatestRelease=new Function('safeId','releaseDate',
 code+'\nreturn canonicalLatestRelease;')(safeId,releaseDate);
const fallen={id:'f',title:'Fallen',release_date_original:'2003-03-04'};
const doorOriginal={id:'d',title:'The Open Door',release_date_original:'2006-09-25'};
const doorReissue={id:'r',title:'The Open Door (Deluxe Edition)',
 release_date_original:'2026-01-01'};
assert.equal(canonicalLatestRelease([fallen,doorReissue,doorOriginal]).id,'d');
const newer={id:'n',title:'The Bitter Truth',release_date_original:'2021-03-26'};
assert.equal(canonicalLatestRelease([fallen,doorOriginal,doorReissue,newer]).id,'n');
assert(disc.includes('Latest listed release'));
assert.match(gradle,/versionCode\s+120/);
assert(gradle.includes("'1.2.3'"));
console.log('Independent chart -> Qobuz ID mapping, source disclosure, release-year accuracy PASS');
