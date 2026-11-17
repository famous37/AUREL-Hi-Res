/* AUREL settings navigation: real controls grouped without duplicating handlers. */
(function installAurelSettingsGroups(){
 'use strict';
 const KEY='aurel-settings-open-v1';
 const names={outputs:'Audio outputs',audio:'Playback',accounts:'Accounts & library',app:'Appearance & app'};
 const glyphs={
  outputs:'<path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
  audio:'<path d="M6 7v10M12 3v18M18 7v10M3 11v2M21 11v2"/>',
  accounts:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  app:'<path d="M12 3a9 9 0 1 0 9 9c0-1.2-1-2.1-2.2-2.1h-2.1c-.9 0-1.7-.7-1.7-1.6V6.1C15 4.3 13.7 3 12 3Z"/><circle cx="8" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="14" r="1"/>'
 };
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
   if(intro)intro.remove();
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
     const glyph=document.createElement('span');
     glyph.className='aurel-group-icon';
     glyph.setAttribute('aria-hidden','true');
     glyph.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'+glyphs[id]+'</svg>';
     const heading=document.createElement('span');
     heading.className='aurel-group-name';
     heading.textContent=label;
     summary.append(glyph,heading);
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
