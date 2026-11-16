/* AUREL 1.1.21 — English default, optional Ukrainian (Skrypnykivka).
   UI-only translations; Qobuz catalogue metadata is never translated. */
(function installAurelLanguages(){
'use strict';
var STORAGE_KEY='aurel_locale_v1';
var current='en';
try {if(localStorage.getItem(STORAGE_KEY)==='uk')current='uk';}catch(_){}
document.documentElement.lang=current;
var dictionary={
 'Discover':'Відкриття','Home':'Головна','Magazine':'Часопис','Library':'Бібліотека',
 'Search':'Пошук','Settings':'Налаштування','Audio & Account':'Звук та обліковий запис',
 'Albums':'Альбоми','Album':'Альбом','Artists':'Виконавці','Artist':'Виконавець',
 'Tracks':'Треки','Track':'Трек','Playlists':'Плейлисти','Playlist':'Плейлист',
 'Releases':'Релізи','New releases':'Нові релізи','Fresh on Qobuz':'Новинки Qobuz',
 'Your library':'Ваша бібліотека','YOUR COLLECTION':'ВАША КОЛЕКЦІЯ',
 'Showing your separate library account':'Показано окремий обліковий запис бібліотеки',
 'Showing favourites from your streaming account':'Показано вибране з потокового облікового запису',
 'Everything you love,':'Уся ваша улюблена музика,','in one place.':'в одному місці.',
 'Explore saved music from your library account.':'Переглядайте збережену музику зі своєї бібліотеки.',
 'Open library ↗':'Відкрити бібліотеку ↗','Listen deeper.':'Слухайте глибше.',
 'Albums, artists and music worth your time.':'Альбоми, виконавці та музика, варта вашого часу.',
 'Explore music ↗':'Шукати музику ↗',
 'Recently released albums available in the catalogue':'Нещодавні релізи, доступні в каталозі',
 'Go your own way':'Оберіть свій шлях','Quick access to music that matters':'Швидкий доступ до важливої музики',
 'Your favourites':'Ваше вибране','Releases, artists, playlists':'Релізи, виконавці, плейлисти',
 'Search catalogue':'Пошук у каталозі','Tracks, artists and albums':'Треки, виконавці та альбоми',
 'AUREL is an independent client. Catalogue and streaming depend on Qobuz authorization.':'AUREL — незалежний застосунок. Каталог і потокове відтворення залежать від авторизації Qobuz.',
 'Go beyond':'Пізнайте більше, ніж','the recording.':'сам запис.',
 'Reviews, interviews and listening guides from Qobuz’s editorial magazine.':'Рецензії, інтерв’ю та поради для слухачів із часопису Qobuz.',
 "Reviews, interviews and listening guides from Qobuz's editorial magazine.":'Рецензії, інтерв’ю та поради для слухачів із часопису Qobuz.',
 'Read Qobuz Magazine ↗':'Читати часопис Qobuz ↗',
 'Music has a story':'Музика має історію',
 "Editorial articles open on Qobuz's official site":'Статті відкриваються на офіційному сайті Qobuz',
 'Interviews':'Інтерв’ю','Album stories':'Історії альбомів','Discoveries':'Відкриття',
 'The people behind the music':'Люди, які творять музику',
 'Context for deeper listening':'Контекст для глибшого слухання',
 'Genres, labels and recordings':'Жанри, лейбли та записи',
 'Articles are not mirrored or redistributed inside AUREL.':'Статті не копіюються й не поширюються в AUREL.',
 'Recent searches':'Нещодавні пошуки','Clear':'Очистити',
 'Searching catalogue…':'Пошук у каталозі…','Search catalogue…':'Пошук у каталозі…',
 'Artists, albums, tracks…':'Виконавці, альбоми, треки…',
 'Search tracks, albums, artists…':'Шукати треки, альбоми, виконавців…',
 'No releases have been returned by the connected account.':'Під’єднаний обліковий запис не повернув релізів.',
 'Loading your collection…':'Завантаження колекції…',
 'No playlists have been returned for this account.':'Для цього облікового запису плейлистів не знайдено.',
 'No artists found.':'Виконавців не знайдено.',
 'No results.':'Нічого не знайдено.',
 'Sort':'Сортувати','Recently added':'Нещодавно додані','Title':'Назва',
 'Grid view':'Плитки','List view':'Список','Library sort order':'Порядок сортування бібліотеки',
 'Back':'Назад','See all ›':'Переглянути всі ›','See all':'Переглянути всі',
 'Most popular':'Найпопулярніше','Popular':'Популярне','Latest release':'Останній реліз',
 'Similar artists':'Подібні виконавці','EPs & Singles':'Мініальбоми та сингли',
 'Compilations':'Збірки','Play popular':'Відтворити популярне',
 'Follow':'Стежити','Following':'Відстежується',
 'Load more releases':'Завантажити ще релізи',
 'Loading releases…':'Завантаження релізів…','Loading popular tracks…':'Завантаження популярних треків…',
 'Loading related artists…':'Завантаження подібних виконавців…',
 'Release information could not be loaded.':'Не вдалося завантажити інформацію про релізи.',
 'Popular tracks could not be loaded.':'Не вдалося завантажити популярні треки.',
 'Similar artists could not be loaded.':'Не вдалося завантажити подібних виконавців.',
 'No popular tracks returned by Qobuz':'Qobuz не повернув популярних треків',
 'No similar artists returned by Qobuz':'Qobuz не повернув подібних виконавців',
 'No albums available for this artist':'Для цього виконавця немає доступних альбомів',
 'No EPs or singles returned by Qobuz':'Qobuz не повернув мініальбомів чи синглів',
 'Retry':'Повторити',
 'Now Playing':'Зараз відтворюється','Now playing':'Зараз відтворюється',
 'Queue':'Черга','Play queue':'Черга відтворення','Info':'Відомості',
 'Credits':'Учасники запису','Audio':'Аудіо','Favourite':'Вибране','Favorites':'Вибране',
 'Track information':'Відомості про трек','Audio information':'Відомості про аудіо',
 'Audio details · source vs catalogue':'Аудіодані · потік і каталог',
 'Qobuz recording information':'Відомості Qobuz про запис',
 'Current stream':'Поточний потік','Quality verified by':'Джерело підтвердження якости',
 'Qobuz catalogue maximum':'Максимум у каталозі Qobuz',
 'Provider bitrate':'Бітрейт постачальника','Android track bitrate':'Бітрейт треку за даними Android',
 'MP3 sampled frame bitrate':'Бітрейт дослідженого кадру MP3',
 'Estimated average bitrate':'Оцінений середній бітрейт',
 'Provider':'Постачальник','Source provenance':'Походження потоку',
 'Source codec':'Кодек потоку','Android parsed codec':'Кодек за даними Android',
 'Android parsed sample rate':'Частота дискретизації за даними Android',
 'MediaPlayer channels':'Канали MediaPlayer','Android mixer property':'Параметр мікшера Android',
 'Media size':'Розмір медіа','Requested maximum':'Запитана максимальна якість',
 'Not reported':'Не повідомлено','Not exposed':'Недоступно',
 'Unavailable':'Недоступно','Format not available':'Формат недоступний',
 'No cover art available':'Обкладинка недоступна',
 'Checking actual stream quality…':'Перевірка фактичної якости потоку…',
 'Checking stream header…':'Перевірка заголовка потоку…',
 'Connecting to audio…':'З’єднання з аудіо…',
 'Stream metadata not reported':'Метадані потоку не повідомлено',
 'Direct media header':'Заголовок медіафайла',
 'Streaming provider metadata':'Метадані потокового сервісу',
 'Exact bit depth / rate not verified':'Точну розрядність і частоту не підтверджено',
 'Stream quality unavailable · tap Audio':'Якість потоку недоступна · відкрийте «Аудіо»',
 'Playing · exact stream format not reported':'Відтворення · точний формат не повідомлено',
 'Choose a track':'Оберіть трек','Untitled':'Без назви',
 'Add to favourites':'Додати до вибраного','Play':'Відтворити',
 'Pause':'Пауза','Shuffle':'Перемішати','Repeat':'Повторювати',
 'Previous track':'Попередній трек','Next track':'Наступний трек',
 'Minimize player':'Згорнути програвач','Play queue':'Черга відтворення',
 'Playback controls':'Керування відтворенням',
 'Playback options':'Параметри відтворення','Playback position':'Позиція відтворення',
 'Source quality details':'Відомості про якість потоку',
 'Track details':'Відомості про трек','Track actions':'Дії з треком',
 'Audio details':'Відомості про аудіо',
 'Close details':'Закрити відомості','Close information panel':'Закрити панель відомостей',
 'See audio source details':'Переглянути відомості про джерело аудіо',
 'Verify Mornye session':'Підтвердити сеанс Mornye',
 'PLAYING':'ВІДТВОРЮЄТЬСЯ','PAUSED':'ПАУЗА','BUFFERING':'БУФЕРИЗАЦІЯ',
 'UNAVAILABLE':'НЕДОСТУПНО',
 'Streaming account':'Обліковий запис для відтворення',
 'Streaming quality':'Якість потоку',
 'Maximum requested quality. Actual format depends on rights, availability and decoding support.':'Запитана максимальна якість. Фактичний формат залежить від доступности та підтримки декодування.',
 'Check Mornye gateway':'Перевірити шлюз Mornye',
 'Check Qobuz connection':'Перевірити з’єднання з Qobuz',
 'Connect separate library':'Під’єднати окрему бібліотеку',
 'Change library account':'Змінити обліковий запис бібліотеки',
 'Disconnect library':'Від’єднати бібліотеку',
 'App Secret (stream authorization)':'App Secret (авторизація потоку)',
 'Save secret':'Зберегти секретний ключ',
 'Saved · enter to replace':'Збережено · введіть новий для заміни',
 'Required for signed stream URLs':'Потрібен для підписаних адрес потоку',
 'About AUREL':'Про AUREL','Developer':'Розробник','Version':'Версія',
 'Sign out of all accounts':'Вийти з усіх облікових записів',
 'App updates':'Оновлення застосунку','Signed releases via GitHub':'Підписані релізи через GitHub',
 'Check GitHub Releases for permanently signed updates.':'Перевірка постійно підписаних оновлень у GitHub Releases.',
 'Checking signed GitHub releases…':'Перевірка підписаних релізів GitHub…',
 'You have the latest published version.':'Установлено найновішу опубліковану версію.',
 'A newer permanently signed version is available.':'Доступна новіша версія з постійним підписом.',
 'Downloading APK; audio playback stays available.':'Завантаження APK · відтворення музики триває.',
 'Verified APK downloaded. Ready for Android installation.':'Перевірений APK завантажено й підготовлено до встановлення.',
 'Update could not be completed.':'Не вдалося завершити оновлення.',
 'Check for new releases.':'Перевірити нові релізи.',
 'Check now':'Перевірити зараз','Download update':'Завантажити оновлення',
 'Install update':'Установити оновлення',
 'What’s new':'Що нового','Automatically check for updates once a day':'Автоматично перевіряти оновлення раз на день',
 'Before installation, Android verifies the AUREL package, version and permanent signing certificate. The download is checked against GitHub SHA-256. Installation always requires your confirmation.':'Перед установленням Android перевіряє пакет AUREL, версію та постійний сертифікат підпису. Контрольна сума SHA-256 звіряється з GitHub. Установлення завжди потребує вашого підтвердження.',
 'Preview has a separate Android package; its updates must be installed separately.':'Попередня версія має окремий пакет Android, тому її потрібно оновлювати окремо.',
 'Audio & account':'Звук та обліковий запис',
 'Search for music, albums, artists…':'Шукати музику, альбоми, виконавців…',
 'Clear recent searches':'Очистити історію пошуку',
 'Open album':'Відкрити альбом','Close':'Закрити',
 'Loading player…':'Завантаження програвача…',
 'MUSIC / STORIES / ARTISTS':'МУЗИКА / ІСТОРІЇ / ВИКОНАВЦІ',
 'AUREL / LOSSLESS LISTENING':'AUREL / АУДІО БЕЗ ВТРАТ',
 'New arrivals across the Qobuz catalogue':'Новинки з каталогу Qobuz',
 'Track number':'Номер треку','Disc':'Диск','Composer':'Композитор',
 'Performers / Credits':'Виконавці / Учасники запису','Label':'Лейбл',
 'Original release':'Перший реліз','Release':'Реліз','Duration':'Тривалість',
 'Copyright':'Авторське право',
 'Your queue is empty.':'Черга відтворення порожня.',
 'Language':'Мова інтерфейсу',
 'Choose the application language. Music metadata remains unchanged.':'Оберіть мову застосунку. Метадані музики залишаться без змін.',
 'Default':'Усталено','Ukrainian (Skrypnykivka)':'Українська (скрипниківка)',
 'English':'Англійська','Ukrainian':'Українська'
};
var skipContent='.album-title,.album-artist,.track-title,.track-meta,.shelf-card strong,.shelf-card>span:last-child,.aurel-popular-copy,.aurel-release-card,.aurel-similar-artist strong,.aurel-artist-bio,.aurel-artist-hero h1,.artist-hero h1,.murglar-track-data h1,.aurel-song-details h1,.mini .title,.mini .artist,.queue-text,.recents,.credit strong,.info-row strong,.playlist-entry strong,.library-album-row strong,.spotlight-stack,.track-details,.aurel-language-choice';
var originalText=new WeakMap(),originalAttributes=new WeakMap();
function translateEnglish(s){
 var key=String(s||'').trim();
 if(Object.prototype.hasOwnProperty.call(dictionary,key))return dictionary[key];
 var match=/^(\d+)\s+tracks$/i.exec(key);
 if(match)return match[1]+' треків';
 match=/^(\d+)\s+albums$/i.exec(key);
 if(match)return match[1]+' альбомів';
 match=/^(\d+)\s+playlists$/i.exec(key);
 if(match)return match[1]+' плейлистів';
 match=/^Version\s+(\d+\.\d+\.\d+)$/i.exec(key);
 if(match)return 'Версія '+match[1];
 return null;
}
function shouldSkip(node){
 var parent=node&&node.parentElement;
 return !parent||!!(parent.closest&&parent.closest(skipContent));
}
function translateNode(node){
 if(!node||node.nodeType!==3||shouldSkip(node))return;
 var value=node.nodeValue||'',baseline=originalText.get(node);
 if(baseline===undefined){baseline=value;originalText.set(node,baseline);}
 var previous=translateEnglish(baseline),previousValue=previous===null?baseline:baseline.replace(baseline.trim(),previous);
 if(value!==baseline&&value!==previousValue){baseline=value;originalText.set(node,baseline);}
 var translated=translateEnglish(baseline);
 var wanted=(current==='uk'&&translated!==null)?baseline.replace(baseline.trim(),translated):baseline;
 if(value!==wanted)node.nodeValue=wanted;
}
var attributeNames=['aria-label','title','placeholder'];
function translateAttribute(element,key){
 if(!element.hasAttribute(key))return;
 if(element.closest&&element.closest(skipContent))return;
 var map=originalAttributes.get(element);
 if(!map){map={};originalAttributes.set(element,map);}
 var value=element.getAttribute(key),original=map[key];
 if(original===undefined){original=value;map[key]=value;}
 var oldTranslation=translateEnglish(original);
 if(value!==original&&value!==(oldTranslation===null?original:oldTranslation)){original=value;map[key]=value;}
 var next=translateEnglish(original),wanted=current==='uk'&&next!==null?next:original;
 if(value!==wanted)element.setAttribute(key,wanted);
}
function visit(element){
 if(!element)return;
 if(element.nodeType===3){translateNode(element);return;}
 if(element.nodeType!==1)return;
 var tag=element.tagName;
 if(tag==='SCRIPT'||tag==='STYLE'||tag==='TEXTAREA'||tag==='NOSCRIPT')return;
 if(element.closest&&element.closest(skipContent))return;
 attributeNames.forEach(function(key){translateAttribute(element,key);});
 var child=element.firstChild;
 while(child){var next=child.nextSibling;visit(child);child=next;}
}
function syncLanguageButtons(){
 var choices=document.querySelectorAll('[data-aurel-locale]');
 for(var i=0;i<choices.length;i++){
  var b=choices[i],selected=b.getAttribute('data-aurel-locale')===current;
  b.setAttribute('aria-checked',String(selected));
 }
}
function createLanguagePanel(){
 var root=document.getElementById('screen');
 if(!root||!root.querySelector('.aurel-settings-heading')||root.querySelector('#aurel-language-panel'))return;
 var panel=document.createElement('section');
 panel.id='aurel-language-panel';
 panel.className='panel aurel-language-panel';
 panel.innerHTML='<h3>Language</h3>'+
  '<p class="aurel-language-intro">Choose the application language. Music metadata remains unchanged.</p>'+
  '<div class="aurel-language-options" role="radiogroup" aria-label="Language">'+
  '<button type="button" role="radio" class="aurel-language-choice" data-aurel-locale="en" aria-checked="true"><span><span class="aurel-language-name">English</span><small>Default</small></span><span class="aurel-language-check" aria-hidden="true">✓</span></button>'+
  '<button type="button" role="radio" class="aurel-language-choice" data-aurel-locale="uk" aria-checked="false"><span><span class="aurel-language-name">Українська</span><small>Скрипниківка</small></span><span class="aurel-language-check" aria-hidden="true">✓</span></button>'+
  '</div>';
 var first=root.querySelector('.panel');
 if(first)root.insertBefore(panel,first);else root.appendChild(panel);
 syncLanguageButtons();
 visit(panel);
}
function setLanguage(next){
 current=next==='uk'?'uk':'en';
 try{localStorage.setItem(STORAGE_KEY,current);}catch(_){}
 document.documentElement.lang=current;
 syncLanguageButtons();
 visit(document.body);
}
document.addEventListener('click',function(event){
 var button=event.target&&event.target.closest&&event.target.closest('[data-aurel-locale]');
 if(!button)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 setLanguage(button.getAttribute('data-aurel-locale'));
},true);
var oldRenderSettings=renderSettings;
renderSettings=function(){
 var result=oldRenderSettings.apply(this,arguments);
 createLanguagePanel();
 visit(document.getElementById('screen'));
 return result;
};
var observer=new MutationObserver(function(mutations){
 var settingsNeeded=false;
 for(var i=0;i<mutations.length;i++){
  var change=mutations[i];
  if(change.type==='characterData'){if(current==='uk')translateNode(change.target);continue;}
  if(change.type==='attributes'){if(current==='uk')translateAttribute(change.target,change.attributeName);continue;}
  var nodes=change.addedNodes;
  for(var j=0;j<nodes.length;j++){
   var n=nodes[j];
   if(current==='uk')visit(n);
   if(n.nodeType===1&&(n.id==='screen'||(n.querySelector&&n.querySelector('.aurel-settings-heading'))))settingsNeeded=true;
  }
 }
 if(settingsNeeded||document.querySelector('.aurel-settings-heading'))createLanguagePanel();
});
observer.observe(document.body,{childList:true,characterData:true,subtree:true});
createLanguagePanel();
if(current==='uk')visit(document.body);
window.AurelLanguage={get:function(){return current;},set:setLanguage,translate:translateEnglish};
})();
