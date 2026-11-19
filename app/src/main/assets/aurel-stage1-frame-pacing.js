/* AUREL Stage 1: dispatch real Android FFT frames at most once per screen frame.
 * Native audio, visualizer capture and bit-perfect policies stay untouched.
 * Preserve peak levels within each frame so short bass transients are not lost.
 */
(function installAurelStageOneFramePacing(){
 'use strict';
 if(typeof window.AurelBeatFrame!=='function')return;
 const deliver=window.AurelBeatFrame;
 let scheduled=false,requestId=0,queued=false,peak=0,delivered=0;
 function flush(){
   scheduled=false;requestId=0;
   if(!queued)return;
   const value=peak;queued=false;peak=0;
   if(document.hidden)return;
   deliver(value);
   delivered++;
 }
 window.AurelBeatFrame=function(level){
   const n=Number(level);
   if(!Number.isFinite(n)||document.hidden)return;
   const bounded=Math.max(0,Math.min(1,n));
   peak=queued?Math.max(peak,bounded):bounded;
   queued=true;
   if(scheduled)return;
   if(typeof requestAnimationFrame!=='function'){flush();return;}
   scheduled=true;
   try{requestId=requestAnimationFrame(flush);}
   catch(_){flush();}
 };
 document.addEventListener('visibilitychange',()=>{
   if(!document.hidden)return;
   queued=false;peak=0;
   if(scheduled&&typeof cancelAnimationFrame==='function'){
     try{cancelAnimationFrame(requestId);}catch(_){}
   }
   scheduled=false;requestId=0;
 });
 window.AurelStageOneFrames={status:()=>({scheduled,delivered})};
})();
