'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=__dirname+'/../';
const read=p=>fs.readFileSync(root+p,'utf8');
const java=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const service=read('app/src/main/java/com/aurel/hires/AurelPlaybackService.java');
const disco=read('app/src/main/assets/aurel-discography.js');
const mini=read('app/src/main/assets/modern.js');
const css=read('app/src/main/assets/aurel-media-progress.css');

// A failed artist/page must not discard reachable Qobuz artist tracks.
assert.match(java,/case "artistExtras":/);
assert.match(java,/artistTrackFallback\(artistId\)/);
assert.match(java,/case "artistReleaseType":/);
assert.match(java,/artistReleaseList\(artistId,releaseType\)/);
assert.match(java,/artistPageReleases\(artistId,releaseType\)/);
assert.match(java,/artistTypedAlbumsFallback\(artistId,releaseType\)/);
assert.match(java,/if\(!artistId\.equals\(actual\)\)continue/);
assert.match(java,/if\(!typeFound\)throw/);
assert.match(disco,/Tracks by artist/);
assert.match(disco,/s\.topFallback=!!data\?\._topFallback/);
assert.match(disco,/const groups=asList\(preview\)/);

// MediaSession must receive real duration in milliseconds and keep a stable seek bar.
assert.match(service,/Math\.round\(seconds\*1000d\)/);
assert.match(service,/METADATA_KEY_DURATION,duration/);
assert.match(service,/ACTION_SEEK_TO/);
assert.match(service,/setState\(status,position,playing\?1f:0f,SystemClock\.elapsedRealtime\(\)\)/);
assert.match(service,/lastMetadataSignature/);
assert.match(mini,/mini-progress-fill/);
assert.match(mini,/const total=Math\.max\(0,Number\(p\.duration\)\|\|Math\.max\(0,Number\(t\.duration\)\|\|0\)\*1000\)/);
assert.match(css,/\.mini-progress-fill/);
console.log('Artist catalogue and media progress regression invariants OK');
