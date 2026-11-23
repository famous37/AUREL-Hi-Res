(function installCompactPlayer(){
  'use strict';
  let down=null;
  const mini=$('#mini');
  if(mini){
    mini.addEventListener('touchstart',e=>{
      if(e.touches&&e.touches.length===1)down={x:e.touches[0].clientX,y:e.touches[0].clientY};
    },{passive:true});
    mini.addEventListener('touchend',e=>{
      if(!down||!e.changedTouches?.length)return;
      const dx=e.changedTouches[0].clientX-down.x,dy=e.changedTouches[0].clientY-down.y;
      down=null;
      if(dy< -35&&Math.abs(dy)>Math.abs(dx)){app.overlay=true;drawOverlay();}
    },{passive:true});
  }
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('button');
    if(!b)return;
    if(b.hasAttribute('data-mini-prev')){
      ev.preventDefault();ev.stopImmediatePropagation();
      nativeCall('previous').catch(e=>showToast(e.message,5000));
      return;
    }
    if(b.hasAttribute('data-open-mini-player')){
      ev.preventDefault();ev.stopImmediatePropagation();
      app.overlay=true;drawOverlay();
    }
  },true);
})();
