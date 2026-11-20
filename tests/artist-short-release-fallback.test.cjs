'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const js=read('app/src/main/assets/aurel-discography.js');
const css=read('app/src/main/assets/aurel-discography.css');
new Function(js);
const start=native.indexOf('private JSONObject artistReleaseList(');
const end=native.indexOf('private JSONObject artistReleaseFromAll(',start);
const subset=native.slice(start,end);
assert(start>=0&&end>start,'Native artist releases and short previews must exist');
assert(subset.includes('.put("sort","release_date_by_priority")'),
 'Qobuz releasesList uses the documented sort parameter');
assert(subset.includes('gridParams.put("sort","release_date")'),
 'Grid sorting must be separate from releasesList ordering');
assert(subset.indexOf('artist/getReleasesList')<subset.indexOf('artist/getReleasesGrid'),
 'The documented list endpoint precedes the grid fallback');
assert(native.includes('artistShortReleasePreview(artistId,p.optString("name",""))'),
 'When official category is denied, artist-owned short metadata is attempted');
assert(native.includes('collectShortReleases(artistItems(info,"albums"),artistId,found,true)'));
assert(native.includes('collectShortReleases(artistItems(response,"albums"),artistId,found,false)'));
assert(native.includes('if(!artistSource&&!artistId.equals(linked))continue;'),
 'Search cannot introduce similarly named artists');
assert(native.includes('if(type.contains("compilation")||type.equals("album")||type.equals("live"))'),
 'Explicit album/compilation/live designation overrides short track counts');
assert(!subset.includes('int count=album.optInt("tracks_count"'),
 'A partial album count must never prove EP/single classification');
assert(native.includes('found.put(id,album)'), 'Only actual Qobuz releases are displayed');
assert(native.includes('String[] queries=new String[]{name+" #ByMainArtist",name};'),
 'Two bounded search queries may recover short releases from the permitted catalogue');
assert(js.includes("name:artistName(app.selected||{})"),
 'Selected artist name remains available even if legacy artist/get is limited');
assert(native.includes('"_shortPreview",true'), 'Approximate results must carry a disclosure flag');
assert(native.includes('safeReleaseError('), 'Sensitive API details must not enter diagnostic messages');
assert(js.includes('s.epShortPreview=!!data?._shortPreview;'));
assert(js.includes("section('EPs & Singles',eps"));
assert(js.includes('EPs and singles identified by Qobuz release metadata.'));
assert(js.includes("kind&&kind!=='single'&&kind!=='epsingle'&&kind!=='ep'"));
assert(css.includes('.aurel-release-preview-note'));
console.log('Qobuz typed endpoint contracts, accurate short-release labels and privacy PASS');
