/* AUREL 1.1.26 — single-track Qobuz availability.
 * An upcoming album may contain previously released, streamable singles.
 * Only explicit per-track restrictions or future dates are blocked. */
(function installTrackAccess(){
 'use strict';
 const truth=(o,k)=>o&&Object.prototype.hasOwnProperty.call(o,k)&&o[k]!==null;
 function futureDate(value){
   if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(value))return '';
   const iso=value.slice(0,10);
   const parsed=new Date(iso+'T00:00:00Z');
   if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==iso)return '';
   // Compare calendar dates in the user's device timezone; no guessed
   // midnight access before rights actually become available.
   const now=new Date();
   const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),
    String(now.getDate()).padStart(2,'0')].join('-');
   return iso>today?iso:'';
 }
 function status(track){
   if(!track||typeof track!=='object')return {playable:false,reason:'Track information is unavailable.',future:false};
   const release=track.release_date_stream;
   const next=futureDate(release);
   if(next)return {playable:false,reason:'Available for streaming from '+next+'.',future:true,date:next};
   if(truth(track,'streamable')&&track.streamable===false)
     return {playable:false,reason:'This track is not currently available for streaming.',future:false};
   if(truth(track,'released')&&track.released===false)
     return {playable:false,reason:'This track has not been released yet.',future:true};
   const explicitlyStreamable=track.streamable===true;
   if(!explicitlyStreamable&&!release){
     const original=futureDate(track.release_date_original);
     if(original)return {playable:false,reason:'Available for streaming from '+original+'.',future:true,date:original};
     const album=track.album||{};
     const albumDate=futureDate(album.release_date_stream||album.release_date_original);
     if(albumDate)return {playable:false,reason:'Available for streaming from '+albumDate+'.',future:true,date:albumDate};
   }
   return {playable:true,reason:'',future:false};
 }
 window.AurelTrackAccess={status,canPlay:track=>status(track).playable};
})();
