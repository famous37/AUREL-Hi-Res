'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const asset=name=>fs.readFileSync(path.join(root,'app/src/main/assets',name),'utf8');
const html=asset('index.html');
const discography=asset('aurel-discography.js');
const modal=asset('aurel-artist-info.js');
const theme=asset('aurel-live-ui.js');
const css=asset('aurel-artist-info.css');
const locale=asset('aurel-language.js');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');

assert(gradle.includes('versionCode 58')&&gradle.includes("'1.1.39'"));
assert(html.includes('href="aurel-artist-info.css"'));
assert(html.includes('src="aurel-artist-info.js"'));
assert(html.indexOf('aurel-artist-info.css')>html.indexOf('aurel-unified.css'));
assert(html.indexOf('aurel-artist-info.js')>html.indexOf('aurel-settings-groups.js'));
for(const key of ['window.AurelArtistInfoData','data-artist-info-open',
 'window.AurelArtistInfoRefresh?.(id)','s.biography=biographyText(biography)',
 'fullBio.slice(0,260)']){
 assert(discography.includes(key),'Missing artist biography hook: '+key);
}
for(const key of ['aria-modal="true"','aria-labelledby="aurel-artist-info-title"',
 'data-artist-info-close','window.AurelBack=function()','if(close())return',
 'layer.classList.add(\'is-closing\')']){
 assert(modal.includes(key),'Missing modal accessibility/Back hook '+key);
}
assert(theme.includes("document.documentElement.setAttribute('data-aurel-palette',artworkPalette?'artwork':'mono')"));
assert(theme.includes("root.setAttribute('data-aurel-palette',artworkPalette?'artwork':'mono')"));
assert(theme.includes("artworkPalette=localStorage.getItem(PALETTE_KEY)==='on'"));
assert(css.includes('html[data-aurel-palette="mono"] .app .screen :is('));
assert(css.includes('.aurel-artist-hero'));
assert(css.includes('background-image:linear-gradient(160deg,#25262b 0%,#191a1e 100%)!important'));
assert(css.includes('html[data-aurel-palette="mono"] #overlay'));
assert(css.includes('.aurel-artist-info-dialog'));
assert(css.includes('.aurel-artist-info-overlay.is-closing'));
assert(css.includes('prefers-reduced-motion:reduce'));
assert(locale.includes("'About artist':'Про виконавця'"));
assert(locale.includes('.aurel-artist-info-biography'), 'Source Qobuz biography must not be translated as UI');

const match=discography.match(/const biographyText=value=>\{[\s\S]*?\n  \};/);
assert(match,'Full biography sanitizer must be available');
const normalized=vm.runInNewContext(match[0]+'\nbiographyText({content:"<p>First sentence</p><p>Second sentence</p>"});');
assert.equal(normalized,'First sentence\n\nSecond sentence');

let live=null,prevBack=0,dialogFocused=false;
const listeners={};
const classList=()=>{const items=new Set();return {
 add(x){items.add(x)},remove(x){items.delete(x)},contains(x){return items.has(x)}
};};
const makeLayer=()=>{
 const name={textContent:''};
 const body={textContent:'',dataset:{},scrollTop:0,hidden:false};
 const status={textContent:''};
 const dialog={focus(){dialogFocused=true}};
 const layer={id:'',className:'',innerHTML:'',classList:classList(),isConnected:false,
   querySelector(key){
     return ({
      '[data-aurel-artist-name]':name,
      '[data-aurel-biography]':body,
      '[data-aurel-artist-info-status]':status,
      '.aurel-artist-info-dialog':dialog
     })[key]||null;
   },
   remove(){this.isConnected=false;if(live===this)live=null;}
 };
 layer._name=name;layer._body=body;layer._status=status;
 return layer;
};
const document={
 documentElement:{classList:classList(),dataset:{}},
 activeElement:{isConnected:true,focus(){}},
 body:{appendChild(node){node.isConnected=true;live=node;}},
 getElementById(id){return id==='aurel-artist-info-modal'?live:null},
 createElement(name){assert.equal(name,'div');return makeLayer()},
 addEventListener(type,fn){(listeners[type]||=[]).push(fn)}
};
let ready=false;
const biography='Led Zeppelin pioneered an influential sound. Full, untruncated Qobuz biography.';
const app={selectedKind:'artist',selected:{id:'87'}};
const window={
 AurelArtistInfoData(id){assert.equal(id,'87');return {
  name:'Led Zeppelin',biography:ready?biography:'',loading:!ready,error:false
 }},
 AurelBack(){prevBack++},
 matchMedia(){return {matches:true}},
 setTimeout(fn){fn()}
};
vm.runInNewContext(modal,{document,window,app,Array,String,Set,console},{filename:'aurel-artist-info.js'});
window.AurelArtistInfo.open();
assert(live&&dialogFocused,'Artist modal opens and focuses dialog');
assert.match(live._status.textContent,/Loading biography/);
ready=true;
live._body.scrollTop=29;
window.AurelArtistInfoRefresh('87');
assert.equal(live._body.textContent,biography,'Full source text shown');
assert.equal(live._body.scrollTop,29,'Async refresh keeps reading position');
window.AurelBack();
assert.equal(live,null,'Android Back closes info sheet');
assert.equal(prevBack,0,'Back should not navigate away from current artist');
window.AurelBack();
assert.equal(prevBack,1,'Second Back preserves underlying history handler');
console.log('AUREL artist biography modal, back navigation, verified source, monochrome and animation PASS');
