/* Signed GitHub releases updater: automatic daily check; user-approved installation. */
(function installAurelUpdates(){
'use strict';
const AUTO_KEY='aurel_updates_auto_v1',LAST_KEY='aurel_updates_checked_v1';
let info=null,notified='';
const autoOn=()=>{try{return localStorage.getItem(AUTO_KEY)!=='off';}catch(_){return true;}};
const escapeText=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function panelMarkup(){
 const s=info||{},status=s.status||'idle',installed=escapeText(s.installedVersion||'1.1.26');
 const latest=escapeText(s.latestVersion||'—'),supported=s.supported!==false;
 const message={
  idle:'Check GitHub Releases for permanently signed updates.',
  checking:'Checking signed GitHub releases…',
  upToDate:'You have the latest published version.',
  available:'A newer permanently signed version is available.',
  downloading:'Downloading APK; audio playback stays available.',
  downloaded:'Verified APK downloaded. Ready for Android installation.',
  error:'Update could not be completed.'
 }[status]||'Check for new releases.';
 const progress=Math.min(100,Math.max(0,Number(s.progress)||0));
 const notes=s.available&&s.notes?String(s.notes).slice(0,1000):'';
 const disabled=status==='checking'||status==='downloading'?' disabled':'';
 let result='<div class="aurel-update-head"><div><h3>App updates</h3>'+
   '<p class="subline">Signed releases via GitHub</p></div>'+
   '<span class="aurel-update-version">v'+installed+'</span></div>'+
   '<p class="aurel-update-message" role="status">'+escapeText(message)+'</p>';
 if(s.available)result+='<div class="aurel-update-release"><strong>Version '+latest+'</strong>'+
   (s.fileBytes?'<small>'+(Number(s.fileBytes)/1048576).toFixed(1)+' MB</small>':'')+'</div>';
 if(status==='downloading')result+='<progress class="aurel-update-progress" max="100" value="'+progress+'"></progress>'+
   '<div class="aurel-update-percent">'+progress+'%</div>';
 if(notes)result+='<details class="aurel-update-notes"><summary>What’s new</summary><p>'+
   escapeText(notes)+'</p></details>';
 if(s.error)result+='<p class="aurel-update-error" role="alert">'+escapeText(s.error)+'</p>';
 if(!supported)result+='<p class="aurel-update-error">Preview has a separate Android package; its updates must be installed separately.</p>';
 result+='<div class="aurel-update-controls"><button type="button" class="pill secondary" data-aurel-check-update'+disabled+'>Check now</button>';
 if(supported&&s.available&&status!=='downloaded'&&status!=='downloading')
   result+='<button type="button" class="pill" data-aurel-download-update>Download update</button>';
 if(supported&&status==='downloaded')
   result+='<button type="button" class="pill" data-aurel-install-update>Install update</button>';
 result+='</div><label class="aurel-update-toggle"><input type="checkbox" data-aurel-auto-updates'+
   (autoOn()?' checked':'')+'/><span>Automatically check for updates once a day</span></label>'+
   '';
 return result;
}
function redraw(){
 if(app.nav!=='settings')return;
 const screen=document.getElementById('screen');
 if(!screen||!screen.querySelector('.aurel-settings-heading'))return;
 let panel=document.getElementById('aurel-updates-panel');
 if(!panel){
  panel=document.createElement('section');panel.id='aurel-updates-panel';
  panel.className='panel aurel-update-panel';
  const about=Array.from(screen.querySelectorAll('.panel'))
    .find(p=>p.querySelector('h3')?.textContent?.includes('About AUREL'));
  if(about)about.before(panel);else screen.appendChild(panel);
 }
 panel.innerHTML=panelMarkup();
}
const beforeRender=renderSettings;
renderSettings=function(){const result=beforeRender.apply(this,arguments);redraw();return result;};
function apply(data){
 if(!data||typeof data!=='object')return;
 info=data;redraw();
 const v=String(data.latestVersion||'');
 if(data.status==='available'&&v&&notified!==v){
  notified=v;showToast('AUREL v'+v+' available in Settings → App updates',5000);
 }
}
const prevEvent=window.AurelEvent;
window.AurelEvent=function(kind,data){
 const result=prevEvent.apply(this,arguments);
 if(kind==='update')apply(data);
 return result;
};
async function request(action){
 try{apply(await nativeCall(action));}
 catch(e){showToast(e?.message||'Update action failed',5500);}
}
document.addEventListener('click',event=>{
 const b=event.target?.closest?.('button');if(!b||b.disabled)return;
 const action=b.hasAttribute('data-aurel-check-update')?'checkUpdate':
  b.hasAttribute('data-aurel-download-update')?'downloadUpdate':
  b.hasAttribute('data-aurel-install-update')?'installUpdate':'';
 if(!action)return;
 event.preventDefault();event.stopPropagation();void request(action);
});
document.addEventListener('change',event=>{
 const e=event.target;
 if(!e?.hasAttribute?.('data-aurel-auto-updates'))return;
 try{localStorage.setItem(AUTO_KEY,e.checked?'on':'off');}catch(_){}
});
setTimeout(async()=>{
 if(!window.AurelNative)return;
 try{
  apply(await nativeCall('updateStatus'));
  if(!autoOn())return;
  let last=0;try{last=Number(localStorage.getItem(LAST_KEY))||0;}catch(_){}
  if(Date.now()-last<86400000)return;
  try{localStorage.setItem(LAST_KEY,String(Date.now()));}catch(_){}
  apply(await nativeCall('checkUpdate'));
 }catch(_){/* Offline startup must not interrupt playback. */}
},5500);
})();
