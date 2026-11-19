'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const java=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const policy=read('app/src/main/java/com/aurel/hires/AurelFocusPolicy.java');
const css=read('app/src/main/assets/aurel-player-scroll.css');
const html=read('app/src/main/assets/index.html');
const manifest=read('app/src/main/AndroidManifest.xml');
const gradle=read('app/build.gradle');
assert(/versionCode\s+98/.test(gradle) && gradle.includes("'1.1.79'"));
assert(html.indexOf('aurel-player-scroll.css')>html.indexOf('aurel-artist-info.css'),
 'Player scroll overrides must load after all legacy player skins');
assert(css.includes('#overlay:not(.hidden) .murglar-view'));
assert(css.includes('height:100%!important') && css.includes('max-height:100%!important'));
assert(css.includes('flex:1 1 0%!important') && css.includes('overflow-y:auto!important'));
assert(css.includes('scrollbar-width:none!important'));
assert(css.includes('.murglar-player-content::-webkit-scrollbar'));
assert(css.includes('display:none!important'));
assert(css.includes('html:has(#overlay:not(.hidden))') &&
 css.includes('body:has(#overlay:not(.hidden))'),
 'Lock the page beneath the fullscreen Now Playing sheet');
assert(!css.includes('overflow-y:hidden!important'),
 'Do not remove legitimate player scrolling on short or landscape displays');

assert(manifest.includes('android:foregroundServiceType="mediaPlayback"'));
assert(java.includes('import android.media.AudioFocusRequest;'));
assert(java.includes('new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)'));
assert(java.includes('.setWillPauseWhenDucked(true)'));
assert(java.includes('.setAcceptsDelayedFocusGain(true)'));
assert(java.includes('systemAudio.requestAudioFocus(audioFocusRequest)'));
assert(java.includes('AudioManager.AUDIOFOCUS_REQUEST_GRANTED'));
assert(java.includes('AudioManager.AUDIOFOCUS_REQUEST_DELAYED'));
assert(java.includes('systemAudio.abandonAudioFocusRequest(audioFocusRequest)'));
assert(java.includes('AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK'));
assert(java.includes('AudioManager.AUDIOFOCUS_LOSS_TRANSIENT'));
assert(java.includes('AudioManager.AUDIOFOCUS_LOSS'));
assert(java.includes('focusPolicy.focusLostPermanent()'));
assert(java.includes('focusPolicy.focusLostTransient()'));
assert(java.includes('focusPolicy.focusGained()'));
assert(java.includes('focusPolicy.shouldStartPrepared()'));
assert(java.includes('case "pause":ui.post(()->{pauseByUser();'));
assert(java.includes('if(focusPolicy.shouldStartPrepared())startWithAudioFocus(mp);'));
assert(java.includes('if(hasEngine()&&prepared)startSelectedWithAudioFocus();'));
assert(!java.includes('private void startDirectWithAudioFocus()'), 'Exclusive USB audio focus engine has been removed');
assert(java.includes('pauseByUser();bitPerfect.setEnabled(false,player,fileInfo);'));
assert(java.includes('focusPolicy.userPause();\n        abandonPlaybackFocus();'));
assert(!/if\(player!=null&&prepared&&!player\.isPlaying\(\)\)player\.start\(\)/.test(java),
 'No naked resume after another player takes focus');
assert(!/try\{mp\.start\(\);\}catch\(Exception ignored\)/.test(java),
 'Prepared playback must be gated on focus');
assert(java.includes('if(!mp.isPlaying())mp.start();'),
 'MediaPlayer.start must remain gated by audio focus');
assert(!java.includes('directPlayer'),
 'Only the Android MediaPlayer engine may handle audio focus');
assert(policy.includes('resumeOnGain = wantsPlayback;'));
assert(policy.includes('focusLostPermanent()'));
assert(policy.includes('userPause();'));
console.log('AUREL player overlay bounds, focus integration and foreground-service safety PASS');
