/* AUREL 1.1.73 — bounded, private actionable application error journal.
 * No Android system-log access, audio samples, account data or telemetry.
 * Errors stay on this device; they leave only through explicit Copy. */
(function installAurelErrorJournal(){
 'use strict';
 const KEY='aurel_error_journal_v1',MAX=70,MAX_AGE=14*24*3600*1000;
 let entries=[],writing=false;
 function clean(input){
   return String(input==null?'':input).slice(0,1400)
     .replace(/https?:\/\/[^\s"'<>]+/gi,'[url]')
     .replace(/(?:bearer\s+)[^\s,;]+/gi,'Bearer [redacted]')
     .replace(/(?:password|passwd|token|secret|authorization|apikey|api_key|sessionid|cookie|credential)\s*[:=]\s*[^\s,;]+/gi,'[credential]')
     .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
     .replace(/(?:[A-Za-z0-9_-]{12,}\.){2}[A-Za-z0-9_-]{10,}/g,'[credential]')
     .replace(/\b[A-Za-z0-9_-]{38,}\b/g,'[identifier]')
     .replace(/\/storage\/[^\s"'<>]+/gi,'[local path]')
     .slice(0,260);
 }
 try{
   const data=JSON.parse(localStorage.getItem(KEY)||'[]');
   if(Array.isArray(data))entries=data.filter(x=>x&&typeof x==='object'&&
     typeof x.time==='string'&&typeof x.kind==='string'&&
     typeof x.message==='string'&&Date.parse(x.time)>Date.now()-MAX_AGE)
     .slice(-MAX).map(x=>({time:x.time.slice(0,32),kind:clean(x.kind).slice(0,48),message:clean(x.message)}));
 }catch(_){}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(entries));}catch(_){}}
 function refreshCount(){
   const target=document.querySelector?.('[data-aurel-error-count]');
   if(target)target.textContent=entries.length?
     String(entries.length)+' recent issue'+(entries.length===1?'':'s'):
     'No application errors recorded';
 }
 function capture(kind,message){
   if(writing)return;
   writing=true;
   try{
     const k=clean(kind).slice(0,48),m=clean(message);
     if(!m)return;
     const now=Date.now(),last=entries[entries.length-1];
     if(last&&last.kind===k&&last.message===m&&now-Date.parse(last.time)<12000)return;
     entries.push({time:new Date(now).toISOString(),kind:k,message:m});
     entries=entries.filter(x=>Date.parse(x.time)>now-MAX_AGE).slice(-MAX);
     persist();refreshCount();
   }catch(_){}finally{writing=false;}
 }
 function report(){
   return 'AUREL Hi-Res 1.1.73 | App error log\n'+
     'Local diagnostic only. No audio, account tokens, URLs or system logcat.\n'+
     JSON.stringify({version:'1.1.73',count:entries.length,errors:entries},null,2);
 }
 function clear(){entries=[];persist();refreshCount();refreshReport();}
 function refreshReport(){
   const display=document.querySelector?.('[data-aurel-error-report]');
   if(display&&!display.hidden)display.textContent=report();
 }
 window.AurelErrorLog={record:capture,report,clear,count:()=>entries.length};

 // Retain only the local asset NAME and line — never external origins, query
 // parameters, tokens, full stack traces, user filenames, or private paths.
 function safeSource(raw){
   const source=String(raw||'');
   if(!source)return '';
   const matched=source.match(/(?:^|\/)([A-Za-z0-9_.-]{1,95}\.(?:js|html|css))(?::[0-9]+)?(?:[?#]|$)/i);
   if(source.indexOf('file:///android_asset/')===0)
     return matched?matched[1]:'packaged asset';
   return '[external script]';
 }
 function diagnosticLocation(source,line,col){
   const name=safeSource(source);
   const ln=Number(line),cn=Number(col);
   const suffix=(Number.isInteger(ln)&&ln>0&&ln<1000000
      ? ':'+ln+(Number.isInteger(cn)&&cn>0&&cn<1000000?':'+cn:''):'');
   return name?name+suffix:'';
 }
 window.addEventListener('error',e=>{
   // Capture resource load errors too; these do not trigger window.onerror.
   const tag=String(e?.target?.tagName||'').toLowerCase();
   if(tag==='script'||tag==='link'){
     const source=tag==='script'?e.target.src:e.target.href;
     capture('resource',tag+' could not load: '+(safeSource(source)||'[unknown resource]'));
     return;
   }
   const message=String(e?.message||e?.error?.message||'Script error.');
   const location=diagnosticLocation(e?.filename,e?.lineno,e?.colno);
   if(/^Script error\.?$/i.test(message)&&!location&&!e?.error){
     capture('opaque-script','Script error. WebView withheld script name and line; source cannot be identified. This alone does not indicate an AUREL crash.');
     return;
   }
   capture('javascript',message+(location?' @ '+location:' (source unavailable)'));
 },true);
 window.addEventListener('unhandledrejection',e=>{
   const reason=e?.reason;
   const message=reason?.message||reason?.name||'Unhandled rejected promise';
   const stack=String(reason?.stack||'');
   const frame=stack.split('\n').find(x=>x.includes('file:///android_asset/'))||'';
   const loc=frame.match(/file:\/\/\/android_asset\/[^\s():]+\.(?:js|html):([0-9]+):([0-9]+)/);
   const source=frame.match(/file:\/\/\/android_asset\/[^\s():]+\.(?:js|html)/);
   const site=source?diagnosticLocation(source[0],loc?.[1],loc?.[2]):'';
   capture('promise',message+(site?' @ '+site:''));
 });
 function attach(){
   if(typeof nativeCall==='function'){
     const originalNative=nativeCall;
     nativeCall=function(action,data={}){
       let pending;
       try{pending=originalNative(action,data);}
       catch(error){capture('native:'+action,error?.message||error);throw error;}
       return Promise.resolve(pending).catch(error=>{
         capture('native:'+action,error?.message||error);
         throw error;
       });
     };
   }
   if(typeof window.AurelEvent==='function'){
     const originalEvent=window.AurelEvent;
     window.AurelEvent=function(kind,data){
       if(kind==='player'&&data?.error)capture('playback',data.error);
       if(kind==='beatStatus'&&data?.state==='unavailable')
         capture('visualizer','Android FFT capture unavailable');
       try{return originalEvent.apply(this,arguments);}
       catch(error){capture('event:'+kind,error?.message||error);throw error;}
     };
   }
   if(typeof renderSettings==='function'){
     const originalSettings=renderSettings;
     renderSettings=function(){
       const result=originalSettings.apply(this,arguments);
       installPanel();
       return result;
     };
   }
   installPanel();
 }
 function installPanel(){
   const root=document.getElementById?.('screen');
   if(!root?.querySelector('.aurel-settings-heading')||root.querySelector('[data-aurel-error-panel]'))return;
   const host=root.querySelector('[data-aurel-settings-group="app"] .aurel-settings-group-content')||
     root.querySelector('[data-aurel-pro-settings="performance"]')?.parentElement;
   if(!host)return;
   const panel=document.createElement('section');
   panel.className='panel aurel-error-panel';
   panel.setAttribute('data-aurel-error-panel','');
   const uk=window.AurelLanguage?.get?.()==='uk';
   panel.innerHTML='<h3>'+(uk?'Журнал помилок застосунку':'Application error log')+'</h3>'+
     '<p>'+(uk?'Записує лише помилки AUREL. Без аудіозаписів, паролів і надсилання на сервер.':
       'Records AUREL errors only. No audio, passwords or automatic uploads.')+'</p>'+
     '<small data-aurel-error-count role="status"></small>'+
     '<div class="aurel-error-actions"><button type="button" data-aurel-copy-errors>'+
       (uk?'Скопіювати журнал':'Copy error log')+'</button>'+
     '<button type="button" data-aurel-view-errors aria-expanded="false">'+
       (uk?'Переглянути':'View log')+'</button>'+ 
     '<button type="button" data-aurel-clear-errors>'+
       (uk?'Очистити журнал':'Clear log')+'</button></div>'+ 
     '<pre data-aurel-error-report hidden aria-label="Local application errors"></pre>';
   host.appendChild(panel);refreshCount();
 }
 document.addEventListener('click',async event=>{
   const button=event.target?.closest?.('[data-aurel-copy-errors],[data-aurel-clear-errors],[data-aurel-view-errors]');
   if(!button||button.disabled)return;
   event.preventDefault();event.stopPropagation();
   if(button.hasAttribute('data-aurel-clear-errors')){
     clear();return;
   }
   if(button.hasAttribute('data-aurel-view-errors')){
     const display=document.querySelector?.('[data-aurel-error-report]');
     if(display){
       display.hidden=!display.hidden;
       button.setAttribute('aria-expanded',String(!display.hidden));
       if(!display.hidden)display.textContent=report();
     }
     return;
   }
   button.disabled=true;
   try{
     const content=report();
     try{
       const reply=await nativeCall('copySupportLog',{report:content});
       if(reply?.copied!==true)throw Error('Android clipboard did not confirm copying');
     }catch(nativeError){
       // Prefer Android clipboard; fallback only to local WebView copy APIs.
       let copied=false;
       if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
         try{await navigator.clipboard.writeText(content);copied=true;}catch(_){}
       }
       if(!copied&&typeof document.execCommand==='function'){
         let field;
         try{
           field=document.createElement('textarea');
           field.value=content;field.setAttribute('readonly','');
           field.style.position='fixed';field.style.opacity='0';
           field.style.pointerEvents='none';
           (document.body||document.documentElement).appendChild(field);
           field.select();copied=!!document.execCommand('copy');
         }catch(_){}finally{field?.remove?.();}
       }
       if(!copied)throw nativeError;
     }
     showToast(window.AurelLanguage?.get?.()==='uk'?
       'Журнал помилок скопійовано':'Application error log copied',3500);
   }catch(error){
     capture('clipboard',error?.message||'Copy unavailable');
     refreshReport();
     showToast(window.AurelLanguage?.get?.()==='uk'?
       'Не вдалося скопіювати. Натисни «Переглянути», щоб прочитати журнал.':
       'Copy failed. Use View log to read local errors.',5000);
   }
   finally{if(button.isConnected)button.disabled=false;}
 });
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',attach,{once:true});
 else attach();
})();