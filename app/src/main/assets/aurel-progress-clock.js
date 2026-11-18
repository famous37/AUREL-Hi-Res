/* Stable native playback position clock. No DOM rebuilding on transport ticks. */
(function(){
'use strict';
const s={id:'',position:0,at:0,playing:false,buffering:false,duration:0,pendingSeek:null};
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function read(p,t=now()){
 if(!p?.track?.id)return 0;
 const id=String(p.track.id);
 const total=Number(p.duration)||s.duration||0;
 if(id!==s.id)return clamp(Number(p.position)||0,0,total||Number.MAX_SAFE_INTEGER);
 const move=s.playing&&!s.buffering?Math.min(3000,Math.max(0,t-s.at)):0;
 return clamp(s.position+move,0,total||Number.MAX_SAFE_INTEGER);
}
function accept(p){
 if(!p?.track?.id){s.id='';s.position=0;s.at=0;s.playing=false;s.pendingSeek=null;return 0;}
 const t=now(),id=String(p.track.id),dur=Number(p.duration)||0;
 const raw=clamp(Number(p.position)||0,0,dur||Number.MAX_SAFE_INTEGER);
 const playing=!!p.playing,buffering=!!p.buffering;
 if(id!==s.id||!s.at){
   s.id=id;s.position=raw;s.at=t;s.playing=playing;s.buffering=buffering;s.duration=dur;s.pendingSeek=null;
   return s.position;
 }
 const estimated=read(p,t);
 let target=raw;
 if(s.pendingSeek && t-s.pendingSeek.at<3200){
   const requested=s.pendingSeek.position;
   if(Math.abs(raw-requested)>2500)target=requested;
   else s.pendingSeek=null;
 }else{
   s.pendingSeek=null;
   // Native USB URB counters may reset briefly on pause, device reconfigure
   // or buffering. Do not animate spurious backward or forward excursions.
   if(playing&&!buffering){
     if(raw<estimated-1100)target=estimated;
     else if(raw>estimated+2400)target=estimated+Math.min(650,raw-estimated);
     else target=Math.max(estimated,raw);
   }else if(raw<estimated-1100 && buffering){
     target=estimated;
   }
 }
 s.position=clamp(target,0,dur||Number.MAX_SAFE_INTEGER);
 s.at=t;s.playing=playing;s.buffering=buffering;
 if(dur>0)s.duration=dur;
 return s.position;
}
function markSeek(position){
 if(!s.id)return;
 s.position=Math.max(0,Number(position)||0);s.at=now();
 s.pendingSeek={position:s.position,at:s.at};
}
window.AurelProgressClock={accept,read,markSeek};
})();
