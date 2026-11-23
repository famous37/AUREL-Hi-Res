'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=source('app/src/main/java/com/aurel/hires/MainActivity.java');
const disc=source('app/src/main/assets/aurel-discography.js');
const lang=source('app/src/main/assets/aurel-language.js');
new Function(disc);new Function(lang);

// No fabricated ranking from artist names or arbitrary search ordering.
const artist= native.slice(native.indexOf('case "artistExtras": {'),
  native.indexOf('case "artistReleaseType": {'));
assert(artist.includes('.put("extra","topTracks")'));
assert(artist.includes('artistInformation("artist/page"'));
assert(artist.includes('extras.put("_topError"'));
assert(!artist.includes('artistTrackFallback('));
assert(!native.includes('private JSONObject artistOfficialTopTracks('));
assert(disc.includes("Qobuz did not provide a ranked track list for this connection"));
assert(!disc.includes('Tracks by artist'));

// A restricted Mornye catalogue is not a fully privileged Qobuz user session.
const releases=native.slice(native.indexOf('case "artistReleaseType": {'),
  native.indexOf('case "resolveArtist":'));
assert(releases.includes('mornyeActive()'));
assert(releases.includes('artistShortReleasePreview(artistId,p.optString("name",""))'));
assert(releases.includes('artistReleaseList(artistId,releaseType)'));
assert(native.includes('item.optString("album_type",album.optString("album_type"'));
assert(native.includes('item.optString("product_type",album.optString("product_type"'));
assert(native.includes('collectShortReleases(associatedAlbums,artistId,found,false)'));
assert(native.includes('if(artistId.equals(ownerId))associatedAlbums.put(album)'));
assert(native.includes('if(typed.length()==0)throw new Exception'));
assert(!disc.includes('No EPs or singles returned by Qobuz'));
assert(disc.includes('No verified EPs or singles available from this connection'));
assert(lang.includes('Це підключення Qobuz не має доступу'));

// The existing player and signed updates must be preserved.
assert(native.includes('case "play":')||native.includes('case "playTrack":'));
const gradle=source('app/build.gradle');
assert.match(gradle,/versionCode\s+120/);
assert(gradle.includes("'1.2.3'"));
console.log('Authorized Qobuz ranking, EP metadata fallback and truthful unavailable states PASS');
