/* AUREL 1.1.22 — English default, complete Ukrainian interface.
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
 'Default':'Усталено','Ukrainian':'Українська',
 'English':'Англійська','Ukrainian':'Українська'
};
Object.assign(dictionary,{
 'Accounts & library':'Облікові записи й бібліотека',
 'Advanced account credentials':'Додаткові дані облікового запису',
 'Audio outputs':'Аудіовиходи',
 'Connected outputs · USB & Bluetooth':'Під’єднані виходи · USB і Bluetooth',
 'Signal path':'Шлях аудіосигналу',
 'Refresh outputs':'Оновити виходи',
 'Digital headroom':'Цифровий запас гучности',
 'Playback controls':'Керування відтворенням',
 'Android-reported rates:':'Частоти за даними Android:',
 'USB bit-perfect mixer formats:':'Формати USB bit-perfect:',
 'No audio outputs reported.':'Android не повідомив аудіовиходів.',
 'Output diagnostics unavailable:':'Діагностика аудіовиходів недоступна:',
 'Reported rates are not measured output rates.':'Заявлені частоти не є виміряними частотами.',
 'Active Bluetooth codec / bitrate: unavailable to standard Android apps':'Активний кодек і бітрейт Bluetooth недоступні звичайним застосункам Android',
 'Connected device and Android-reported capabilities.':'Під’єднаний пристрій і його параметри за даними Android.',
 'Preload next track metadata':'Попередньо завантажувати відомості наступного треку',
 'Remember recently opened pages':'Запам’ятовувати нещодавно відкриті сторінки',
 'Transitions':'Переходи',
 'Appearance & app':'Вигляд і застосунок',
 'ACTIVE OUTPUT':'АКТИВНИЙ ВИХІД',
 'AVAILABLE · route not confirmed':'ДОСТУПНИЙ · маршрут не підтверджено',
 'Bluetooth A2DP':'Bluetooth A2DP',
 'Bluetooth LE audio':'Bluetooth LE Audio'
});
Object.assign(dictionary,{"HI-RES WITHOUT COMPROMISE":"HI-RES БЕЗ КОМПРОМІСІВ","Hear the music.":"Відчуйте музику.","Feel everything.":"Відчуйте кожну мить.","Uncompressed detail, thoughtful discovery and a listening space made for music lovers.":"Висока деталізація, музичні відкриття та простір для поціновувачів музики.","Explore music":"Відкрити музику","Nothing to show yet":"Поки немає що показати","Search for your favourite artists or explore another section.":"Шукайте улюблених виконавців або перейдіть до іншого розділу.","No tracks found.":"Треків не знайдено.","WELCOME TO YOUR LISTENING ROOM":"ЛАСКАВО ПРОСИМО ДО МУЗИЧНОГО ПРОСТОРУ","Discover something":"Відкрийте щось","extraordinary":"надзвичайне","Editorial warmth. Exceptional sound. Your music, your way.":"Виняткове звучання й музичні відкриття на ваш смак.","Fresh releases":"Нові релізи","LOSSLESS & HI-RES":"БЕЗ ВТРАТ ТА HI-RES","Your discovery feed":"Ваша стрічка відкриттів","Sign in with a working Qobuz token to load recent releases.":"Увійдіть із чинним токеном Qobuz, щоб побачити нові релізи.","Try again":"Спробувати ще раз","Streaming and available quality depend on your active Qobuz subscription, the catalogue and API access.":"Потокове відтворення та доступна якість залежать від підписки Qobuz і каталогу.","Artists, albums, and every track worth hearing.":"Виконавці, альбоми та треки, варті уваги.","Find your next favourite":"Знайдіть нову улюблену музику","Search Qobuz by artist, album or track.":"Шукайте в Qobuz за виконавцем, альбомом або треком.","No results. Try a different search.":"Нічого не знайдено. Змініть запит.","Artist · Discography":"Виконавець · дискографія","Your Qobuz favourites, always close.":"Ваша улюблена музика Qobuz завжди під рукою.","Loading favourites…":"Завантаження вибраного…","Made by you. Collected for every mood.":"Ваші добірки на будь-який настрій.","My playlists":"Мої плейлисти","Loading playlists…":"Завантаження плейлистів…","No Qobuz playlists returned by your account.":"Для облікового запису не знайдено плейлистів Qobuz.","‹ Back":"‹ Назад","Play album":"Відтворити альбом","Availability and stream quality are verified when playback is requested. Direct-file streaming only in this alpha build.":"Доступність і якість потоку перевіряються під час запуску відтворення.","ARTIST":"ВИКОНАВЕЦЬ","Browse albums and listen using your connected streaming account.":"Переглядайте альбоми та слухайте музику через під’єднаний обліковий запис.","Discography":"Дискографія","Show more releases":"Показати більше релізів","Connect with Mornye.":"Під’єднати Mornye","Direct Mornye signed session, with no Qobuz browser sign-in.":"Підписаний сеанс Mornye без входу через браузер Qobuz.","Sign-in method":"Спосіб входу","Session token":"Токен сеансу","Token":"Токен","Password":"Пароль","Connect Mornye session":"Під’єднати сеанс Mornye","Native signed session":"Підписаний сеанс","For personal playlists and favourites, connect a separate Qobuz account in Settings.":"Для особистих плейлистів і вибраного під’єднайте обліковий запис Qobuz у налаштуваннях.","Connect your Qobuz library.":"Під’єднати бібліотеку Qobuz","Welcome back to music.":"З поверненням до музики","Previous Qobuz authorization was rejected.":"Попередню авторизацію Qobuz відхилено.","Try the current web App ID automatically, a fresh token, or email/password sign-in. Your previous account data has not been erased.":"Спробуйте автоматично визначити App ID, використати новий токен або ввійти за логіном і паролем. Попередні дані збережено.","This Preview is installed separately and cannot read credentials stored by other AUREL installations.":"Попередня збірка встановлюється окремо й не має доступу до облікових даних інших збірок AUREL.","Qobuz email or username":"Електронна пошта або ім’я користувача Qobuz","Email or Qobuz username":"Електронна пошта або логін Qobuz","Enter Qobuz password":"Введіть пароль Qobuz","Qobuz session token":"Токен сеансу Qobuz","Paste X-User-Auth-Token":"Вставте X-User-Auth-Token","Advanced · App ID, App Secret & User ID":"Додатково · App ID, App Secret та User ID","Leave blank for automatic detection from Qobuz's current web player":"Залиште порожнім для автоматичного визначення через вебпрогравач Qobuz","Auto-detect from Qobuz website":"Визначити автоматично із сайту Qobuz","Optional for token/password login; only needed for compatible signed stream requests":"Необов’язково для входу; потрібно для сумісних підписаних запитів потоку","Optional App Secret":"Необов’язковий App Secret","Saved on device · leave blank to keep":"Збережено на пристрої · залиште порожнім, щоб не змінювати","Optional; leave blank unless needed by your Qobuz integration":"Необов’язково; заповнюйте лише за потреби інтеграції Qobuz","Optional account ID":"Необов’язковий ідентифікатор","Open official Qobuz sign-in":"Відкрити офіційну сторінку входу Qobuz","Use session token":"Увійти за токеном","Back to settings":"Назад до налаштувань","Connect library account":"Під’єднати бібліотеку","Sign in & load library":"Увійти та завантажити бібліотеку","Connected":"Під’єднано","● Saved":"● Збережено","Not connected":"Не під’єднано","Session verification":"Перевірка сеансу","Mornye catalogue verified · playback depends on Zarz":"Каталог Mornye підтверджено · відтворення залежить від Zarz","Verified by Qobuz":"Підтверджено Qobuz","Playback confirmed":"Відтворення підтверджено","Not verified · test playback":"Не підтверджено · перевірте відтворення","Rejected · check token and App ID":"Відхилено · перевірте токен та App ID","Not checked":"Не перевірено","Not verified":"Не підтверджено","Profile":"Профіль","Subscription":"Підписка","Connection type":"Тип з’єднання","Mornye signed gateway":"Підписаний шлюз Mornye","Qobuz account":"Обліковий запис Qobuz","Gateway-managed":"Керується шлюзом","Reverify Mornye":"Повторно підтвердити Mornye","Change streaming account":"Змінити обліковий запис для відтворення","Connect streaming account":"Під’єднати обліковий запис для відтворення","Personal Qobuz library":"Особиста бібліотека Qobuz","Library account":"Обліковий запис бібліотеки","Uses streaming account":"Використовується обліковий запис відтворення","Streaming verification needed":"Потрібна перевірка відтворення","The Zarz gateway rejected audio playback. Catalogue access alone does not confirm streaming authorization.":"Шлюз Zarz відхилив відтворення. Доступ до каталогу не підтверджує доступ до музичного потоку.","CD Lossless":"CD без втрат","Max Hi-Res":"Максимальна Hi-Res","/ Audio & Account":"/ Звук та обліковий запис","Signing in securely…":"Безпечний вхід…","Verifying token…":"Перевірка токена…","Qobuz library connected · loading your collection":"Бібліотеку Qobuz під’єднано · завантаження колекції","Qobuz connected · loading your library":"Qobuz під’єднано · завантаження бібліотеки","Qobuz refused the login. Check credentials and try again.":"Qobuz відхилив вхід. Перевірте дані й спробуйте знову.","Connecting to Mornye gateway…":"З’єднання зі шлюзом Mornye…","Complete the Zarz verification in the app window to continue.":"Пройдіть перевірку Zarz у вікні застосунку.","Mornye signed session was not authorized.":"Підписаний сеанс Mornye не авторизовано.","Mornye signed session verified":"Підписаний сеанс Mornye підтверджено","Mornye signed session failed":"Помилка підписаного сеансу Mornye","Mornye gateway did not authorize the session.":"Шлюз Mornye не дозволив сеанс.","Mornye session verified":"Сеанс Mornye підтверджено","Mornye gateway session verified":"Сеанс шлюзу Mornye підтверджено","Mornye verification did not complete":"Перевірку Mornye не завершено","Requesting a fresh Zarz session grant…":"Запит нового дозволу Zarz…","Mornye verification could not start":"Не вдалося розпочати перевірку Mornye","Show password":"Показати пароль","Hide password":"Приховати пароль","Show token":"Показати токен","Hide token":"Приховати токен","Show App Secret":"Показати App Secret","Hide App Secret":"Приховати App Secret","Refresh releases":"Оновити релізи","Verify":"Підтвердити","Dismiss notification":"Закрити сповіщення","Using primary library":"Використовується основна бібліотека","Quality preference saved":"Якість збережено","Enter a new secret":"Введіть новий секретний ключ","Secret encrypted and saved":"Секретний ключ зашифровано та збережено","Added to your Qobuz favourites ♡":"Додано до вибраного Qobuz ♡","Opening artist…":"Відкриття виконавця…","Opening album…":"Відкриття альбому…","Opening playlist…":"Відкриття плейлиста…","No cover art available":"Обкладинка недоступна","Play next":"Відтворити наступним","Add to favorites":"Додати до вибраного","Remove track":"Вилучити трек","Move up":"Перемістити вгору","Move down":"Перемістити вниз","Track progress":"Поступ відтворення","Seek within track":"Перейти до позиції треку","Fields come from Qobuz catalogue metadata when available. The catalogue's maximum audio quality is not proof of the currently decoded stream.":"Поля заповнюються метаданими Qobuz. Максимальна якість у каталозі не підтверджує фактичний формат потоку.","FLAC bit depth and sample rate can be verified from STREAMINFO using a short ranged read of the existing media URL. MP3 frame bitrate may vary. Qobuz catalogue maximum and Android mixer / DAC output are different measurements.":"Розрядність і частоту FLAC можна перевірити за STREAMINFO. Бітрейт MP3 може змінюватися. Якість у каталозі Qobuz та параметри ЦАП Android — різні вимірювання.","Session saved, not verified":"Сеанс збережено, але не підтверджено","The Qobuz API did not confirm this token. Try playing a track to check streaming access.":"API Qobuz не підтвердив токен. Запустіть трек, щоб перевірити відтворення."});
Object.assign(dictionary,{"Account connected but streaming was not verified. You can browse your library; connect a compatible playback account to listen.":"Обліковий запис під’єднано, проте відтворення не підтверджено. Ви можете переглядати бібліотеку; для прослуховування під’єднайте сумісний обліковий запис."});
Object.assign(dictionary,{"Appearance":"Вигляд","Use album artwork colours":"Використовувати кольори обкладинки","Off by default · neutral dark theme":"Усталено вимкнено · нейтральна темна тема","Add to favourites":"Додати до вибраного","Remove from favourites":"Вилучити з вибраного","Removed from favourites":"Вилучено з вибраного","Added to favourites":"Додано до вибраного","No favourites in this category.":"У цій категорії немає вибраного.","Saved":"Збережено","Favourite":"Вибране","Connect a personal Qobuz library in Settings to manage favourites.":"Щоб керувати вибраним, під’єднайте особисту бібліотеку Qobuz у налаштуваннях.","Could not update favourites":"Не вдалося змінити вибране","Could not load Qobuz favourites.":"Не вдалося завантажити вибране Qobuz.","Qobuz did not return a complete favourites list.":"Qobuz не повернув повного списку вибраного.","Account changed; try again.":"Обліковий запис змінено. Спробуйте знову.","♡ Save":"♡ Зберегти","♥ Saved":"♥ Збережено"});
Object.assign(dictionary,{"Share":"Поширити","Share track":"Поширити трек","Share album":"Поширити альбом","Share artist":"Поширити виконавця","Invalid Qobuz item ID for sharing":"Некоректний ідентифікатор Qobuz для поширення","Unable to share Qobuz link":"Не вдалося поширити посилання Qobuz"});
Object.assign(dictionary,{"Coming soon":"Незабаром","Unavailable":"Недоступно","Not available for streaming":"Недоступно для потокового відтворення","Unavailable for streaming":"Недоступно для прослуховування","No released tracks available for streaming":"Немає опублікованих треків, доступних для відтворення","No tracks available for streaming":"Немає треків для відтворення","Track information unavailable":"Відомості про трек недоступні","Track information is unavailable.":"Відомості про трек недоступні.","This track is not currently available for streaming.":"Цей трек поки недоступний для прослуховування.","This track has not been released yet.":"Цей трек іще не опубліковано."});
/* Remaining settings, diagnostics, controls and action strings. */
Object.assign(dictionary,{
 'Playback':'Відтворення',
 'Audio':'Аудіо',
 'Audio outputs':'Аудіовиходи',
 'Connected devices':'Під’єднані пристрої',
 'Signal path':'Шлях сигналу',
 'Source':'Джерело',
 'Decoder':'Декодер',
 'Android / DAC':'Android / ЦАП',
 'Audio device':'Аудіопристрій',
 'Android output':'Аудіовихід Android',
 'USB DAC / USB audio':'USB-ЦАП / USB-аудіо',
 'Built-in speaker':'Динамік пристрою',
 'Analog headphones':'Дротові навушники',
 'Bluetooth call audio':'Bluetooth для розмов',
 'Bluetooth hearing aid':'Слуховий апарат Bluetooth',
 'HDMI audio':'HDMI-аудіо',
 'Other output':'Інший вихід',
 'AVAILABLE':'ПІД’ЄДНАНО',
 'ACTIVE OUTPUT':'АКТИВНИЙ ВИХІД',
 'Refresh outputs':'Оновити виходи',
 'Scanning…':'Перевірка…',
 'Not reported':'Не повідомлено',
 'No audio outputs reported.':'Аудіовиходів не знайдено.',
 'Source PCM not independently verified':'Формат джерела не підтверджено',
 'Android did not report decoder format':'Формат декодера невідомий',
 'Playback output not confirmed':'Аудіовихід не підтверджено',
 'Digital headroom':'Цифрове зниження рівня',
 'Off':'Вимкнено',
 'Preload next track metadata':'Попереднє завантаження відомостей треку',
 'Performance & motion':'Швидкодія й анімації',
 'Remember recently opened pages':'Запам’ятовувати відкриті сторінки',
 'Cache capacity':'Місткість кешу',
 'Clear cache':'Очистити кеш',
 'Transitions':'Переходи',
 'Soft':'Плавні',
 'None':'Без анімації',
 'Advanced account credentials':'Додаткові дані облікового запису',
 'Accounts & library':'Облікові записи й бібліотека',
 'Appearance & app':'Вигляд і застосунок',
 'App updates':'Оновлення застосунку',
 'Signed releases via GitHub':'Підписані релізи GitHub',
 'Check now':'Перевірити',
 'Download update':'Завантажити оновлення',
 'Install update':'Встановити оновлення',
 'Automatically check for updates once a day':'Щодня перевіряти оновлення',
 'What’s new':'Що нового',
 'Check GitHub Releases for permanently signed updates.':'Перевірити наявність оновлень.',
 'Checking signed GitHub releases…':'Перевірка оновлень…',
 'You have the latest published version.':'Установлено найновішу версію.',
 'A newer permanently signed version is available.':'Доступне нове оновлення.',
 'Downloading APK; audio playback stays available.':'Завантаження APK…',
 'Verified APK downloaded. Ready for Android installation.':'Оновлення завантажено.',
 'Update could not be completed.':'Не вдалося оновити застосунок.',
 'Output diagnostics unavailable:':'Діагностика аудіовиходів недоступна:',
 'Stream quality':'Якість потоку',
 'Bit-perfect USB':'USB без зміни бітів',
 'Standard playback':'Звичайне відтворення',
 'Waiting for USB DAC':'Очікування USB-ЦАП',
 'Waiting for a track':'Очікування треку',
 'Track format unknown':'Формат треку невідомий',
 'Format not supported':'Формат не підтримується',
 'Mixer request rejected':'Android відхилив налаштування',
 'USB mixer requested':'Запитано USB-мікшер',
 'USB mixer routed':'USB-мікшер активний',
 'Connect a compatible USB DAC to test mixer support.':'Під’єднайте сумісний USB-ЦАП.',
 'Audio & account':'Аудіо й обліковий запис',
 'About AUREL':'Про AUREL',
 'Sign out of all accounts':'Вийти з усіх облікових записів',
 'Page buffer cleared':'Кеш сторінок очищено',
 'Digital headroom off':'Цифрове зниження рівня вимкнено'
});
/* Additional end-user strings, including media information, device labels and
 * miniplayer controls. Streaming/cataloque titles are intentionally untouched. */
Object.assign(dictionary,{
 'Main navigation':'Основна навігація',
 'Now Playing':'Зараз грає',
 'Now playing':'Зараз грає',
 'Discover':'Головна',
 'Queue':'Черга',
 'Play queue':'Черга відтворення',
 'Credits':'Учасники запису',
 'Share':'Поширити',
 'Favourite':'Вибране',
 'Skip previous':'Попередній трек',
 'Skip next':'Наступний трек',
 'Previous':'Назад',
 'Next':'Далі',
 'Resume playback':'Продовжити відтворення',
 'Minimize player':'Згорнути програвач',
 'Close player':'Закрити програвач',
 'Close details':'Закрити відомості',
 'Track actions':'Дії з треком',
 'Track information':'Відомості про трек',
 'Audio information':'Відомості про аудіо',
 'Source quality details':'Деталі якости аудіо',
 'Source format not confirmed':'Формат потоку не підтверджено',
 'Source format · Qobuz metadata':'Формат потоку · дані Qobuz',
 'Media track format · Android':'Формат аудіопотоку · Android',
 'Audio quality pending':'Перевіряємо якість аудіо',
 'AUDIO QUALITY PENDING':'ПЕРЕВІРЯЄМО ЯКІСТЬ',
 'Connecting to audio…':'Під’єднання до аудіо…',
 'Playback unavailable':'Відтворення недоступне',
 'Media size':'Розмір медіафайла',
 'Source codec':'Кодек джерела',
 'Source provenance':'Походження потоку',
 'Requested maximum':'Запитана максимальна якість',
 'USB output routing':'Маршрут USB-виходу',
 'USB mixer status':'Стан USB-мікшера',
 'USB bit-perfect preference':'Налаштування USB без зміни бітів',
 'End-to-end bit identity':'Повна незмінність бітів',
 'Not independently measurable via MediaPlayer':'MediaPlayer не дозволяє підтвердити',
 'No bit-perfect status':'Немає даних про USB-вихід',
 'Routed to selected USB DAC':'Спрямовано на вибраний USB-ЦАП',
 'Not confirmed':'Не підтверджено',
 'Requested by Android':'Запитано через Android',
 'Enabled · not engaged':'Увімкнено · неактивне',
 'Android mixer property':'Параметр мікшера Android',
 'Android parsed codec':'Кодек за даними Android',
 'Android parsed sample rate':'Частота за даними Android',
 'MediaPlayer channels':'Канали MediaPlayer',
 'Actual audio output':'Фактичний аудіовихід',
 'Active output':'Активний аудіовихід',
 'Available output':'Доступний аудіовихід',
 'Output routing':'Маршрут аудіо',
 'Bluetooth A2DP':'Bluetooth A2DP',
 'Bluetooth LE audio':'Bluetooth LE Audio',
 'Bluetooth call audio':'Bluetooth для викликів',
 'Bluetooth hearing aid':'Слуховий апарат Bluetooth',
 'Android output':'Аудіовихід Android',
 'Audio device':'Аудіопристрій',
 'Built-in speaker':'Вбудований динамік',
 'Analog headphones':'Дротові навушники',
 'Other output':'Інший аудіовихід',
 'No audio outputs reported.':'Android не повідомив аудіовиходів.',
 'No audio outputs found':'Аудіовиходів не знайдено',
 'Output diagnostics unavailable:':'Діагностика аудіовиходів недоступна:',
 'Scan outputs':'Знайти аудіовиходи',
 'Refresh outputs':'Оновити аудіовиходи',
 'Connected devices':'Під’єднані пристрої',
 'Signal path':'Шлях сигналу',
 'Playback':'Відтворення',
 'Audio outputs':'Аудіовиходи',
 'Accounts & library':'Облікові записи й бібліотека',
 'Appearance & app':'Вигляд і застосунок',
 'Appearance':'Вигляд',
 'Use album artwork colours':'Використовувати кольори обкладинки',
 'Off by default · neutral dark theme':'Усталено вимкнено · чорно-біла тема',
 'Default':'Усталено',
 'Active':'Активно',
 'AVAILABLE':'ДОСТУПНО',
 'ACTIVE OUTPUT':'АКТИВНИЙ ВИХІД',
 'Off':'Вимкнено',
 'Soft':'Плавні',
 'None':'Без анімації',
 'Audio formats':'Аудіоформати',
 'Digital headroom':'Цифрове зниження рівня',
 'Preload next track metadata':'Завантажувати дані наступного треку',
 'Cache capacity':'Обсяг кешу',
 'Clear cache':'Очистити кеш',
 'Remember recently opened pages':'Зберігати відкриті сторінки',
 'Performance & motion':'Швидкодія й анімації',
 'Transitions':'Переходи',
 'Language':'Мова',
 'Ukrainian':'Українська',
 'English':'Англійська',
 'Update':'Оновити',
 'Check now':'Перевірити',
 'Checking…':'Перевірка…',
 'Installing…':'Встановлення…',
 'Up to date':'Актуальна версія',
 'App updates':'Оновлення застосунку',
 'Download update':'Завантажити оновлення',
 'Install update':'Встановити оновлення',
 'Automatically check for updates once a day':'Перевіряти оновлення щодня',
 'Qobuz artist':'Виконавець Qobuz',
 'Streaming account':'Обліковий запис відтворення',
 'Sign out of all accounts':'Вийти з усіх облікових записів',
 'Advanced account credentials':'Додаткові дані облікового запису',
 'Personal Qobuz library':'Особиста бібліотека Qobuz',
 'Album cover':'Обкладинка альбому',
 'Album art':'Обкладинка альбому'
});
/* Audio settings strings must be translated before they enter the DOM.
 * Keep the technical meaning: a requested mixer format is not a verified DAC sample. */
Object.assign(dictionary,{
 'Android 14+ · USB DAC required':'Android 14+ · потрібен USB-ЦАП',
 'Connect a compatible USB DAC.':'Під’єднайте сумісний USB-ЦАП.',
 'Android 14 or newer required.':'Потрібен Android 14 або новіший.',
 'Play a lossless track to check USB output.':'Запустіть трек без втрат для перевірки USB.',
 'Track audio format cannot be verified.':'Не вдалося перевірити формат треку.',
 'Android offers no matching bit-perfect USB mixer format.':'Android не повідомив відповідного USB-режиму без зміни бітів.',
 'USB mixer controls are unavailable on this device.':'Керування USB-мікшером недоступне на цьому пристрої.',
 'Android rejected the USB mixer request.':'Android відхилив запит до USB-мікшера.',
 'USB mixer preference accepted; PCM bit identity unverified.':'USB-мікшер прийняв запит; незмінність PCM не підтверджено.',
 'USB audio routed; PCM bit identity unverified.':'Звук спрямовано на USB; незмінність PCM не підтверджено.',
 'USB DAC detected. Start a lossless track to request the mixer format.':'USB-ЦАП виявлено. Запустіть трек без втрат.',
 'Connect a USB DAC. Speaker, wired analog and Bluetooth are not bit-perfect targets.':'Під’єднайте USB-ЦАП. Bluetooth і звичайні виходи не підтримують цей режим.',
 'Requires Android 14 (API 34) or newer.':'Потрібен Android 14 (API 34) або новіший.',
 'Standard Android playback':'Стандартне відтворення Android',
 'Waiting for an audio stream.':'Очікування аудіопотоку.',
 'Stream PCM sample rate or bit depth is not confirmed.':'Частоту або розрядність PCM не підтверджено.',
 'Only mono and stereo PCM can be matched by this mode.':'Режим підтримує лише моно та стерео PCM.',
 'USB DAC disconnected. Normal Android routing may continue.':'USB-ЦАП від’єднано. Відтворення через Android може тривати.',
 'Android AudioManager is unavailable.':'AudioManager Android недоступний.',
 'Android accepted the USB bit-perfect mixer preference. Decoder PCM and DAC samples are not independently verified.':'Android прийняв запит USB-мікшера, але PCM і дані ЦАП не підтверджено.',
 'USB routing and Android bit-perfect mixer preference are active. End-to-end decoded PCM identity is not measured.':'USB-маршрут активний. Незмінність декодованого PCM не виміряно.',
 'Streaming quality':'Якість потоку',
 'Max Hi-Res':'Максимальна Hi-Res',
 'CD Lossless':'CD без втрат',
 'Enable bit-perfect USB output':'Увімкнути USB без зміни бітів',
 'Toggle bit-perfect USB output':'Перемкнути режим USB без зміни бітів',
 'USB bit-perfect playback setting':'Налаштування USB без зміни бітів',
 'Checking USB output':'Перевірка USB-виходу',
 'Mixer request rejected':'Запит до мікшера відхилено',
 'USB mixer requested':'Запит до USB-мікшера',
 'USB mixer routed':'Маршрут USB-мікшера активний',
 'Track format unknown':'Формат треку невідомий',
 'Format not supported':'Формат не підтримується',
 'Waiting for USB DAC':'Очікування USB-ЦАП',
 'Waiting for a track':'Очікування треку',
 'Standard playback':'Стандартне відтворення',
 'Android 14+ required':'Потрібен Android 14+'
});
var skipContent='.album-title,.album-artist,.track-title,.track-meta,.shelf-card strong,.shelf-card>span:last-child,.aurel-popular-copy,.aurel-release-card,.aurel-similar-artist strong,.aurel-artist-bio,.aurel-artist-hero h1,.artist-hero h1,.murglar-track-data h1,.aurel-song-details h1,.mini .title,.mini .artist,.queue-text,.recents,.credit strong,.playlist-entry strong,.library-album-row strong,.spotlight-stack,.track-details,.aurel-language-choice';
var originalText=new WeakMap(),originalAttributes=new WeakMap();
function translateEnglish(s){
 var key=String(s||'').trim();
 var upcoming=/^Available for streaming from (\d{4}-\d{2}-\d{2})\.$/.exec(key);
 if(upcoming)return 'Доступно для прослуховування з '+upcoming[1]+'.';
 if(Object.prototype.hasOwnProperty.call(dictionary,key))return dictionary[key];
 // Dynamic Android outputs are data, not fixed labels; translate the status only.
 var output=/^(.*?) · (ACTIVE OUTPUT|AVAILABLE)$/.exec(key);
 if(output){
   var category=dictionary[output[1]]||output[1];
   return category+' · '+dictionary[output[2]];
 }
 var rates=/^Android rates: (.+)$/.exec(key);
 if(rates)return 'Частоти Android: '+rates[1].replace(/ kHz/g,' кГц').replace(/ Hz/g,' Гц');
 var mixer=/^USB mixer: (.+)$/.exec(key);
 if(mixer)return 'USB-мікшер: '+mixer[1].replace(/ Hz/g,' Гц');
 var cache=/^(\d+) \/ (\d+) pages · (\d+) KB · (\d+) quick opens$/.exec(key);
 if(cache)return cache[1]+' із '+cache[2]+' сторінок · '+cache[3]+' КБ · '+cache[4]+' повторних відкриттів';

 var match=/^(\d+)\s+tracks$/i.exec(key);
 if(match)return match[1]+' треків';
 match=/^(\d+)\s+albums$/i.exec(key);
 if(match)return match[1]+' альбомів';
 match=/^(\d+)\s+playlists$/i.exec(key);
 if(match)return match[1]+' плейлистів';
 match=/^Open (.+) album$/i.exec(key);
 if(match)return 'Відкрити альбом «'+match[1]+'»';
 match=/^Cover art for (.+)$/i.exec(key);
 if(match)return 'Обкладинка: '+match[1];
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
  var name=b.querySelector('.aurel-language-name'),small=b.querySelector('small');
  if(name&&b.getAttribute('data-aurel-locale')==='en')
   name.textContent=current==='uk'?'Англійська':'English';
  if(small&&b.getAttribute('data-aurel-locale')==='en')
   small.textContent=current==='uk'?'Усталено':'Default';
 }
}
function createLoginLanguageSwitch(){
 var root=document.querySelector('#screen .aurel-signin');
 if(!root||root.querySelector('.aurel-auth-language'))return;
 var wrap=document.createElement('div');
 wrap.className='aurel-auth-language';
 wrap.setAttribute('role','radiogroup');
 wrap.setAttribute('aria-label','Language');
 wrap.innerHTML='<button type="button" data-aurel-locale="en" role="radio" aria-checked="false">English</button>'+
  '<button type="button" data-aurel-locale="uk" role="radio" aria-checked="false">Українська</button>';
 root.insertBefore(wrap,root.firstChild);
 syncLanguageButtons();
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
  '<button type="button" role="radio" class="aurel-language-choice" data-aurel-locale="uk" aria-checked="false"><span><span class="aurel-language-name">Українська</span></span><span class="aurel-language-check" aria-hidden="true">✓</span></button>'+
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
 var settingsNeeded=false,loginNeeded=false;
 for(var i=0;i<mutations.length;i++){
  var change=mutations[i];
  if(change.type==='characterData'){if(current==='uk')translateNode(change.target);continue;}
  if(change.type==='attributes'){if(current==='uk')translateAttribute(change.target,change.attributeName);continue;}
  var nodes=change.addedNodes;
  for(var j=0;j<nodes.length;j++){
   var n=nodes[j];
   if(current==='uk')visit(n);
   if(n.nodeType===1){
     if(n.id==='screen'||n.matches?.('.aurel-settings-heading')||n.querySelector?.('.aurel-settings-heading'))settingsNeeded=true;
     if(n.id==='screen'||n.matches?.('.aurel-signin')||n.querySelector?.('.aurel-signin'))loginNeeded=true;
   }
  }
 }
 if(settingsNeeded)createLanguagePanel();
 if(loginNeeded)createLoginLanguageSwitch();
});
observer.observe(document.body,{childList:true,characterData:true,subtree:true});
createLanguagePanel();
createLoginLanguageSwitch();
if(current==='uk')visit(document.body);
window.AurelLanguage={get:function(){return current;},set:setLanguage,translate:translateEnglish};
})();
