/* AUREL settings navigation: real controls grouped without duplicating handlers. */
(function installAurelSettingsGroups(){
 'use strict';
 const KEY='aurel-settings-open-v1';
 const names={audio:'Audio',outputs:'Audio outputs',accounts:'Accounts & library',app:'Appearance & app'};
 function readOpen(){
   try{const value=localStorage.getItem(KEY);return names[value]?value:'outputs';}
   catch(_){return 'outputs';}
 }
 function groupSettings(){
   const root=document.getElementById('screen');
   if(!root?.querySelector('.aurel-settings-heading')||
      root.querySelector('[data-aurel-settings-groups]'))return;
   const panels=Array.from(root.children).filter(n=>n.classList?.contains('panel'));
   const find=(label)=>panels.find(n=>n.querySelector('h3')?.textContent.trim()===label);
   const stream=find('Streaming account'),library=find('Personal Qobuz library');
   const quality=find('Streaming quality'),about=find('About AUREL');
   const logout=panels.find(n=>n.querySelector('[data-logout]'));
   const diagnostics=root.querySelector('[data-aurel-pro-settings="audio"]');
   const performance=root.querySelector('[data-aurel-pro-settings="performance"]');
   if(!stream||!library||!quality||!diagnostics||!performance)return;
   // Keep advanced credentials with their account, not among audio preferences.
   const secret=quality.querySelector('#newSecret')?.closest('div');
   if(secret){
     const advanced=document.createElement('details');
     advanced.className='aurel-settings-advanced';
     const title=document.createElement('summary');
     title.textContent='Advanced account credentials';
     advanced.append(title,secret);
     stream.appendChild(advanced);
   }
   // Move already functional controls. Their delegated event handlers remain intact.
   const blocks=Array.from(diagnostics.children).filter(n=>n.classList?.contains('aurel-pro-feature'));
   const playback=document.createElement('section');
   playback.className='panel aurel-pro-settings aurel-playback-options';
   const playbackTitle=document.createElement('h3');
   playbackTitle.textContent='Playback controls';
   playback.appendChild(playbackTitle);
   for(const node of blocks.slice(2))playback.appendChild(node);
   const intro=diagnostics.querySelector('.aurel-pro-intro');
   if(intro)intro.textContent='Connected device and Android-reported capabilities.';
   const header=root.querySelector('.aurel-settings-heading h1 span');
   if(header)header.remove();
   const wrapper=document.createElement('div');
   wrapper.className='aurel-settings-groups';
   wrapper.setAttribute('data-aurel-settings-groups','');
   const stored=readOpen();
   const containers={};
   for(const [id,label] of Object.entries(names)){
     const section=document.createElement('details');
     section.className='aurel-settings-group';
     section.dataset.aurelSettingsGroup=id;
     section.open=id===stored;
     const summary=document.createElement('summary');
     const heading=document.createElement('span');
     heading.textContent=label;
     summary.appendChild(heading);
     const content=document.createElement('div');
     content.className='aurel-settings-group-content';
     section.append(summary,content);
     wrapper.appendChild(section);
     containers[id]=content;
   }
   const grouped=new Set([stream,library,quality,about,logout,diagnostics,performance]);
   const extras=panels.filter(n=>!grouped.has(n));
   containers.audio.append(quality,playback);
   containers.outputs.append(diagnostics);
   containers.accounts.append(stream,library);
   if(logout)containers.accounts.append(logout);
   containers.app.append(performance);
   if(about)containers.app.append(about);
   for(const node of extras)containers.app.append(node);
   const anchor=root.querySelector('.aurel-settings-heading');
   anchor.after(wrapper);
   // A native details accordion avoids animation/reflow from metadata refreshes.
   wrapper.addEventListener('toggle',event=>{
     const target=event.target;
     if(!target?.matches?.('details[data-aurel-settings-group]')||!target.open)return;
     wrapper.querySelectorAll('details[data-aurel-settings-group]').forEach(d=>{
       if(d!==target)d.open=false;
     });
     const id=target.dataset.aurelSettingsGroup;
     try{localStorage.setItem(KEY,id);}catch(_){}
     if(id==='outputs')window.AurelProSettings?.scanOutputs?.();
   },true);
   if(stored==='outputs')window.AurelProSettings?.scanOutputs?.();
 }
 const original=renderSettings;
 renderSettings=function(){
   const result=original.apply(this,arguments);
   groupSettings();
   return result;
 };
 if(app.nav==='settings')groupSettings();
})();
