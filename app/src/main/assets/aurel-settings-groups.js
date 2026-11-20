/* AUREL — five clear settings categories. All controls retain their original
 * delegated handlers and existing saved values. No duplicated input widgets.
 */
(function installAurelSettingsGroups(){
 'use strict';
 const KEY='aurel-settings-open-v1';
 const names={
  outputs:'Audio outputs',
  playback:'Playback',
  accounts:'Accounts',
  appearance:'Appearance',
  app:'App & data'
 };
 const glyphs={
  outputs:'<path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
  playback:'<path d="M6 7v10M12 3v18M18 7v10M3 11v2M21 11v2"/>',
  accounts:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  appearance:'<path d="M12 3a9 9 0 1 0 9 9c0-1.2-1-2.1-2.2-2.1h-2.1c-.9 0-1.7-.7-1.7-1.6V6.1C15 4.3 13.7 3 12 3Z"/><circle cx="8" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="14" r="1"/>',
  app:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>'
 };
 function readOpen(){
  try{
   const value=localStorage.getItem(KEY);
   if(value==='audio')return 'playback'; // migrate earlier accordion state
   return names[value]?value:'outputs';
  }catch(_){return 'outputs';}
 }
 function groupSettings(){
  const root=document.getElementById('screen');
  if(!root?.querySelector('.aurel-settings-heading')||
      root.querySelector('[data-aurel-settings-groups]'))return;
  const panels=Array.from(root.children).filter(n=>n.classList?.contains('panel'));
  const find=label=>panels.find(n=>n.querySelector('h3')?.textContent.trim()===label);
  const stream=find('Streaming account'),library=find('Personal Qobuz library');
  const quality=find('Streaming quality'),about=find('About AUREL');
  const logout=panels.find(n=>n.querySelector('[data-logout]'));
  const diagnostics=root.querySelector('[data-aurel-pro-settings="audio"]');
  const performance=root.querySelector('[data-aurel-pro-settings="performance"]');
  if(!stream||!library||!quality||!diagnostics||!performance)return;
  // Technical credentials stay collapsed under Accounts, away from playback.
  const secret=quality.querySelector('#newSecret')?.closest('div');
  if(secret){
   const advanced=document.createElement('details');
   advanced.className='aurel-settings-advanced';
   const title=document.createElement('summary');
   title.textContent='Advanced account credentials';
   advanced.append(title,secret);
   stream.appendChild(advanced);
  }
  // Additional account facts are available without overwhelming Settings.
  const infoRows=Array.from(stream.querySelectorAll('.info-row'));
  if(infoRows.length>2){
   const details=document.createElement('details');
   details.className='aurel-settings-advanced aurel-account-details';
   const heading=document.createElement('summary');
   heading.textContent='Account details';
   details.appendChild(heading);
   for(const row of infoRows.slice(2))details.appendChild(row);
   const actions=stream.querySelector('.aurel-account-actions');
   if(actions)actions.after(details);else stream.appendChild(details);
  }
  const blocks=Array.from(diagnostics.children)
   .filter(n=>n.classList?.contains('aurel-pro-feature'));
  const options=document.createElement('section');
  options.className='panel aurel-pro-settings aurel-playback-options';
  const optionsTitle=document.createElement('h3');
  optionsTitle.textContent='Playback options';
  options.appendChild(optionsTitle);
  for(const node of blocks.slice(2))options.appendChild(node);
  diagnostics.querySelector('.aurel-pro-intro')?.remove();
  // Movement, artwork palettes and language are appearance choices, not data.
  const motion=performance.querySelector('[data-aurel-motion]')?.closest('.aurel-pro-feature');
  const motionPanel=document.createElement('section');
  motionPanel.className='panel aurel-pro-settings aurel-motion-options';
  const motionTitle=document.createElement('h3');
  motionTitle.textContent='Motion';
  motionPanel.appendChild(motionTitle);
  if(motion)motionPanel.appendChild(motion);
  const perfHeading=performance.querySelector('h3');
  if(perfHeading)perfHeading.textContent='Cache & performance';
  const header=root.querySelector('.aurel-settings-heading h1 span');
  if(header)header.remove();

  const wrapper=document.createElement('div');
  wrapper.className='aurel-settings-groups';
  wrapper.setAttribute('data-aurel-settings-groups','');
  const stored=readOpen(),containers={};
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
  containers.outputs.append(diagnostics);
  containers.playback.append(quality,options);
  containers.accounts.append(stream,library);
  if(logout)containers.accounts.append(logout);
  for(const node of extras){
   if(node.id==='aurel-language-panel'||node.classList.contains('aurel-appearance-panel')){
    containers.appearance.appendChild(node);
   }else containers.app.appendChild(node);
  }
  // The appearance panel can be installed by any of the existing feature
  // layers; grouping by its own identity never depends on translated text.
  containers.appearance.appendChild(motionPanel);
  containers.app.appendChild(performance);
  if(about)containers.app.appendChild(about);
  root.querySelector('.aurel-settings-heading').after(wrapper);

  // One native accordion at a time; keep the last opened choice across visits.
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
  window.AurelLanguage?.refresh?.(wrapper);
 }
 const original=renderSettings;
 renderSettings=function(){
  const result=original.apply(this,arguments);
  groupSettings();
  return result;
 };
 if(app.nav==='settings')groupSettings();
})();
