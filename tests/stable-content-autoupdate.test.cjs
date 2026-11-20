'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const disco=read('app/src/main/assets/aurel-discography.js');
const native=read('app/src/main/java/com/aurel/hires/MainActivity.java');
const home=read('app/src/main/assets/modern.js');
const history=read('app/src/main/assets/aurel-stage2-library.js');
const styles=read('app/src/main/assets/aurel-stage2.css');
const update=read('app/src/main/assets/aurel-updates.js');
for(const code of [disco,home,history,update])new Function(code);
assert(disco.includes("const ep=loadTypedEps(id,token);"),
 'Typed EPs request stays independent from artist/related metadata');
assert(disco.includes("const section=b.dataset.artistRetry||'';")&&
       disco.includes("void loadTypedEps(id,requestToken);"),
 'Section-level retry should not reload the whole artist page');
assert(disco.includes('This Qobuz connection cannot access this release category.'),
 'Unavailable content must not be labelled as an empty discography');
assert(disco.includes("const img=document.createElement('img');")&&
       !disco.includes('rerender(ownerId);'),
 'Similar portraits should not trigger full-page reflow');
assert(native.includes('for(int offset=0;offset<400;offset+=100)')&&
       native.includes('if(albums.length()<100)break;'),
 'Qobuz albums fallback must page instead of silently truncating');
assert(native.includes('if(!typeFound)throw')&&
       native.includes('if(match&&!id.isEmpty()&&seen.add(id))typed.put(wrapper);'),
 'Type filtering must use genuine provider type/ID, never song count');
assert(history.includes("const anchor=root.querySelector('.new-section');")&&
       history.includes('if(anchor)anchor.before(section);'),
 'Recently played must appear before the release shelf so it is visible');
assert(history.includes("if(app.nav==='home')appendHome();"),
 'First played song should add home history immediately');
assert(styles.includes('#screen:has(.aurel-stage2-recent)')&&
       styles.includes('--aurel-native-navigation-inset')&&
       styles.includes('scroll-padding-inline:0 18px'),
 'History and artist shelves must accommodate mini player, navigation, scroll');
assert(home.includes('data-aurel-discovery-state')&&
       home.includes('data-nav="search"')&&
       home.includes('data-nav="library"'),
 'Discovery restrictions should present actionable authorised alternatives');
assert(update.includes("document.addEventListener('visibilitychange'")&&
       update.includes('if(!document.hidden)void dailyCheck()')&&
       update.includes('86400000')&&
       update.includes('checkInProgress'),
 'Automatic update checks should resume safely after returning to foreground');
assert(update.includes("nativeCall('checkUpdate')")&&
       !update.includes("nativeCall('downloadUpdate')"),
 'Automatic checks must not automatically download/install APKs');
console.log('Stable content, partial-load retry, safe bottom inset, and updater regression PASS');
