'use strict';
/* One vector icon language for dynamically-rendered Qobuz discovery, library,
   album and downloads screens. Avoid loading external icon fonts or assets. */
(function(){
  const screen=document.querySelector('#screen');
  if(!screen||typeof screen.querySelectorAll!=='function')return;
  let scheduled=false;
  function replaceIfNeeded(node,svg,label){
    if(!node||node.dataset?.aurelIconified==='1'||node.querySelector('.ui-icon'))return;
    node.innerHTML=ic(svg,21)+(label?' '+label:'');
    node.dataset.aurelIconified='1';
  }
  function replaceChevrons(){
    screen.querySelectorAll('.artistrow .chevron,.library-album-row>b,.album-artist-button>span').forEach(el=>{
      if(el.dataset?.aurelIconified==='1')return;
      el.innerHTML=ic('chevron',20);
      el.dataset.aurelIconified='1';
    });
  }
  function polish(){
    scheduled=false;
    for(const b of screen.querySelectorAll('button[title="Add to favorites"],button[title="Play"],button[title="Play next"],button[data-refresh],button[data-back],button[data-download-refresh],button[aria-label="Settings"],button[aria-label="Library account"]')){
      if(b.matches('button[title="Add to favorites"]'))replaceIfNeeded(b,'heart');
      else if(b.matches('button[title="Play"]'))replaceIfNeeded(b,'play');
      else if(b.matches('button[title="Play next"]'))replaceIfNeeded(b,'plus');
      else if(b.matches('button[data-refresh],button[data-download-refresh]'))replaceIfNeeded(b,'refresh');
      else if(b.matches('button[data-back]'))replaceIfNeeded(b,'back','Back');
      else if(b.matches('button[aria-label="Settings"]'))replaceIfNeeded(b,'settings');
      else if(b.matches('button[aria-label="Library account"]'))replaceIfNeeded(b,'plus');
    }
    replaceChevrons();
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(polish);
    else polish();
  }
  if(typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.addedNodes&&Array.from(m.addedNodes).some(node=>node.nodeType===1)))schedule();
    });
    observer.observe(screen,{childList:true,subtree:true});
  }
  schedule();
})();
