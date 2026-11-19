'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=__dirname+'/../';
const api=fs.readFileSync(root+'app/src/main/java/com/aurel/hires/QobuzApi.java','utf8');
const main=fs.readFileSync(root+'app/src/main/java/com/aurel/hires/MainActivity.java','utf8');
// A public Qobuz Web App ID is not a reusable partner credential.
// The old hard-coded widget and stream fallback IDs must never be sent.
assert.doesNotMatch(api,/"735532640"|"312369995"/);
assert.doesNotMatch(main,/DEFAULT_APP_ID="312369995"/);
assert.match(api,/resolveAppId\("")/);
assert.match(api,/Qobuz HTTP 405: App ID rejected by Qobuz/);
assert.match(api,/App ID is not configured/);
assert.match(main,/private static final String DEFAULT_APP_ID=""/);
// In connected gateway mode prefer the selected authorized catalogue first.
const info=main.slice(main.indexOf('private JSONObject artistInformation('),
                      main.indexOf('private JSONObject artistPageReleases('));
assert(info.indexOf('catalog(endpoint,parameters)') <
       info.indexOf('api.publicArtist(endpoint,parameters)'));
// A router notification must be tied to the same active MediaPlayer instance.
assert.match(main,/player!=routedPlayer/);
assert.match(main,/onActualRouteChanged\(routedPlayer\)/);
// The local playback log must contain only non-sensitive native error facts.
assert.match(main,/String facts="what="\+what\+", extra="\+extra/);
assert.match(main,/output="\+output/);
assert.match(main,/bitPerfect="\+/);
assert.doesNotMatch(main,/playerError=.*streamUrl/);
console.log('Qobuz App ID fallbacks and Android playback diagnostics PASS');
