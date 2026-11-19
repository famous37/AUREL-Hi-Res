'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const java=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const recovery=read('app/src/main/java/com/aurel/hires/AurelMediaRecoveryPolicy.java');
const css=read('app/src/main/assets/aurel-player-scroll.css');
const app=read('app/src/main/assets/app.js');
const lang=read('app/src/main/assets/aurel-language.js');
const gradle=read('app/build.gradle');

assert(/versionCode\s+95/.test(gradle) && gradle.includes("'1.1.76'"));
for(const line of [
 'web.setVerticalScrollBarEnabled(false);',
 'web.setHorizontalScrollBarEnabled(false);',
 'web.setOverScrollMode(View.OVER_SCROLL_NEVER);'
])assert(java.includes(line),'Native WebView scrollbar fix missing: '+line);
assert(css.includes('overflow-y:auto!important'),
 'Must preserve real inner touch scrolling for long content');
assert(!java.includes('web.setOnTouchListener('),
 'Do not block touch gestures just to hide the native scrollbars');
assert(java.includes('private final AurelMediaRecoveryPolicy mediaRecovery='));
assert(java.includes('private void startAtCurrentInternal()'));
assert(java.includes('mediaRecovery.newSelection();'));
assert(java.includes('mediaRecovery.retryAfter(what,extra,'));
assert(java.includes('focusPolicy.shouldStartPrepared()'));
assert(java.includes('mediaRecoveryScheduledGeneration==generation'));
assert(java.includes('mediaRecovery.rememberPosition(lastPosition);'));
assert(java.includes('mediaRecovery.consumePosition(reliableDuration)'));
assert(java.includes('mp.seekTo(resumedAt,MediaPlayer.SEEK_CLOSEST_SYNC)'));
assert(java.includes('startAtCurrentInternal();'));
assert(java.includes('if(generation!=playGeneration)return;'));
assert(java.includes('ui.postDelayed(()->{'));
assert(java.includes('if(!focusPolicy.shouldStartPrepared()){'));
assert(java.includes('if(generation!=playGeneration||player!=mp)return;'));
assert(java.includes('cleanupPlayer();'));
assert(java.includes('final MediaPlayer obsolete=player;'));
assert(java.includes('try{obsolete.release();}catch(RuntimeException ignored){}'));
assert(java.includes('Log.w(MEDIA_TAG'));
assert(!java.includes('qualityProbePending=!sourceVerified&&!viaMornye;'),
 'Do not open a parallel ranged GET against any signed playback URL');
assert(recovery.includes('MAX_AUTO_RETRIES=1'));
assert(recovery.includes('what==1 && (extra==Integer.MIN_VALUE || extra==-1004 || extra==-110)'));
assert(!recovery.includes('extra==-1007'),'Malformed stream must not auto-retry');
assert(!recovery.includes('extra==-1010'),'Unsupported codec must not auto-retry');
assert(!java.includes('playerError="Media decoder error ("+what+" / "+extra+")"'),
 'Do not misdiagnose MEDIA_ERROR_SYSTEM as definite FLAC decoding failure');
assert(lang.includes("'Android audio system error. Tap Play to try again.'"));
assert(app.includes("if(kind==='player'){"));
console.log('AUREL v1.1.46 native scroll indicator and bounded recovery integration PASS');
