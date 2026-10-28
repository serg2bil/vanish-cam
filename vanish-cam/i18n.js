// Popup language. English is the source text; RU maps it to Russian. A missing entry stays English.
const RU = {
  'Back': 'Назад',
  'Source code on GitHub': 'Исходный код на GitHub',
  'Advanced settings': 'Расширенные настройки',
  'Settings': 'Настройки',
  'Language': 'Язык',
  'Checking the tab…': 'Проверяю вкладку…',
  'Vanish': 'Исчезнуть',
  'Appear': 'Появиться',
  'Remember background': 'Запомнить фон',
  'Step out of frame…': 'Выйди из кадра…',
  'Gesture': 'Жест',
  'Vanish sound': 'Звук исчезновения',
  'Appear sound': 'Звук появления',
  'Play the vanish sound': 'Проиграть звук исчезновения',
  'Play the appear sound': 'Проиграть звук появления',
  'Panel on the call page': 'Панель на странице звонка',
  'Alt+Shift+H: vanish or appear from the keyboard': 'Alt+Shift+H: исчезнуть или появиться с клавиатуры',
  'Compute': 'Вычисления',
  "If the GPU doesn't work, the extension falls back to the CPU.": 'Если видеокарта не работает, расширение переключится на процессор.',
  'Cutout model': 'Модель вырезания',
  'On the CPU the quality model is very slow; pick the fast one.': 'На процессоре качественная модель очень медленная, выбери быструю.',
  'My sounds': 'Мои звуки',
  'The extension ships no sounds. Add your own files (mp3, wav, up to 3 MB each), then pick them on the main screen.':
    'В расширении нет своих звуков. Добавь файлы (mp3, wav, до 3 МБ каждый) и выбери их на главном экране.',
  'Add a sound…': 'Добавить звук…',
  'Gesture debug on the page': 'Отладка жестов на странице',
  'Shows the hands as the model sees them and why a gesture fired or not. Only you see it.':
    'Показывает руки так, как их видит модель, и почему жест сработал или нет. Видишь только ты.',
  'Reset everything to defaults': 'Сбросить всё по умолчанию',
  'Play': 'Проиграть',
  'Delete': 'Удалить',
  '(reversed)': '(задом наперёд)',
  'No sound': 'Без звука',
  'Out of space, delete some sounds': 'Нет места, удали часть звуков',
  'over 3 MB': 'больше 3 МБ',
  'The camera is not on in this tab': 'В этой вкладке камера не включена',
  'Open a call (Meet, Zoom in the browser, etc.) and turn the camera on. If the tab was already open, reload it.':
    'Открой звонок (Meet, Zoom в браузере и т. п.) и включи камеру. Если вкладка уже была открыта, перезагрузи её.',
  'You are hidden from the video': 'Тебя не видно на видео',
  'Camera is running': 'Камера работает',
  'Cutout': 'Вырезание', 'Hands': 'Руки', 'Face': 'Лицо', 'video': 'видео', 'face': 'лица',
  // settings.js lists
  'Quality (RVM)': 'Качество (RVM)',
  'Fast, simple': 'Быстро, просто',
  'Meme: V sign at the chest': 'Мем: V у груди',
  'Seals with two hands: V, fist, palm': 'Печати двумя руками: V, кулак, ладонь',
  'Seals with one hand: V, fist, palm': 'Печати одной рукой: V, кулак, ладонь',
  'Snap with two hands': 'Щелчок двумя руками',
  'Snap with one hand': 'Щелчок одной рукой',
  'Off (button only)': 'Выключено (только кнопка)',
  'Vanishing and appearing': 'Исчезновение и появление',
  'Vanish after the sound hit by': 'Исчезать после удара звука через',
  'The dissolve starts at the sound hit plus this time.': 'Растворение начинается в момент удара звука плюс это время.',
  'Appear after the sound hit by': 'Появляться после удара звука через',
  'You are fully visible at the sound hit plus this time.': 'Ты полностью виден в момент удара звука плюс это время.',
  '"Remember background" timer': 'Таймер «Запомнить фон»',
  'Sound': 'Звук',
  'Volume in the call': 'Громкость в звонке',
  'Volume for you': 'Громкость для тебя',
  'Hold the gesture': 'Удерживать жест',
  'How sharply it must "fly in"': 'Насколько резко рука должна «влететь»',
  '0: just holding the V sign at the chest is enough. More: the hand must move further.':
    '0: достаточно держать V у груди. Больше: рука должна пролететь дальше.',
  'Pause after it fires': 'Пауза после срабатывания',
  'How far below the face counts as chest': 'Насколько ниже лица считается грудью',
  'Snap': 'Щелчок',
  'Snap sound sensitivity': 'Чувствительность к звуку щелчка',
  'Thumb near middle finger: no further than': 'Большой палец у среднего: не дальше',
  'Middle finger raised: at least': 'Средний палец поднят: не меньше',
  'Snap pose before the sound: no earlier than': 'Поза щелчка до звука: не раньше чем',
  'Fingers must move after the sound within': 'Пальцы должны сдвинуться после звука в течение',
  'A hand held still in the snap pose while you talk never fires. Raise this if real snaps are missed.':
    'Неподвижная рука в позе щелчка, пока ты говоришь, не срабатывает. Увеличь, если настоящие щелчки пропускаются.',
  'Seals': 'Печати',
  'Time between seals': 'Время между печатями',
  // gesture hints (popup.js)
  'Flick a V sign at your chest to vanish. Do it again to reappear.': 'Резко покажи V у груди, чтобы исчезнуть. Ещё раз, чтобы появиться.',
  'Both hands in turn: V sign, then fist, then open palm.': 'Обе руки по очереди: V, потом кулак, потом ладонь.',
  'One hand in turn: V sign, then fist, then open palm.': 'Одна рука по очереди: V, потом кулак, потом ладонь.',
  'Snap the fingers of both hands, hands raised.': 'Щёлкни пальцами обеих рук, руки подняты.',
  'Snap your fingers, hand raised above the desk.': 'Щёлкни пальцами, рука поднята над столом.',
  'Only with the button here or Alt+Shift+H.': 'Только кнопкой здесь или Alt+Shift+H.',
  // v2: popup
  'Effect': 'Эффект',
  'Open the studio: preview, record your own gesture, try effects': 'Открыть студию: превью, запись своего жеста, эффекты',
  'Gestures you recorded in the studio.': 'Жесты, которые ты записал в студии.',
  'No gestures yet: record one in the studio.': 'Жестов пока нет: запиши в студии.',
  'Open a call (Meet, Zoom in the browser, etc.) and turn the camera on. If the tab was already open, reload it. Or open the studio to try it on your camera.':
    'Открой звонок (Meet, Zoom в браузере и т. п.) и включи камеру. Если вкладка уже была открыта, перезагрузи её. Или открой студию и попробуй на своей камере.',
  'My gestures': 'Мои жесты',
  'Built-in': 'Встроенные',
  // built-in sounds (synth.js)
  'Whoosh': 'Вжух', 'Pop': 'Поп', 'Poof (smoke)': 'Пуф (дым)', 'Sparkle (magic)': 'Искры (магия)', 'Teleport': 'Телепорт',
  'Zap': 'Зап', 'Bass boom': 'Бас-бум', 'Bubble': 'Пузырёк',
  // effects (effects.js)
  'Disintegrate (Thanos)': 'Распад (Танос)', 'Flash teleport': 'Вспышка-телепорт', 'RGB glitch': 'RGB-глитч',
  'Zoom punch': 'Зум-удар', 'Smoke puff': 'Облако дыма', 'Glass shatter': 'Разбитое стекло', 'Soft dissolve': 'Мягкое растворение',
  'Hard cut with a flash': 'Резкая склейка со вспышкой',
  // v2.1
  'Turn the extension on or off': 'Включить или выключить расширение', 'On': 'Вкл', 'Off': 'Выкл',
  'Vanish Cam is off': 'Vanish Cam выключен',
  'The camera goes out untouched. Turn it on with the switch at the top.': 'Камера идёт в звонок как есть. Включи переключателем вверху.',
  'Turn on': 'Включить', 'Tracking': 'Трекинг', 'Show the hand tracking on the picture': 'Показывать трекинг рук на картинке',
  'Effect duration': 'Длительность эффекта',
  'Some effects run longer than this (the dust about twice as long).': 'Некоторые эффекты длятся дольше (распад примерно вдвое).',
  // studio
  'Try everything here before the call. Only you see this camera.': 'Попробуй всё здесь до звонка. Эту камеру видишь только ты.',
  'Starting the camera…': 'Включаю камеру…',
  'No camera': 'Нет камеры',
  'Get ready…': 'Приготовься…',
  'Hold the gesture!': 'Держи жест!', 'Hold the gesture, or move it!': 'Держи жест или веди им!',
  'Got it, with the motion! Do it again to try.': 'Записал, вместе с движением! Повтори, чтобы проверить.',
  'Place relative to the face': 'Место относительно лица', 'Motion accuracy': 'Точность движения',
  'A motion that comes back (a wave, a circle)': 'Движение с возвратом (помахать, круг)',
  'Got it, a motion that comes back! Do it again to try.': 'Записал движение с возвратом! Повтори, чтобы проверить.', 'anywhere': 'где угодно',
  'Moves this way (as you see yourself)': 'Движется в эту сторону (как ты себя видишь)',
  'The camera could not be opened. Allow it for this page and reload.': 'Камеру открыть не удалось. Разреши её для этой страницы и перезагрузи.',
  'Show the mask': 'Показать маску',
  'White = what gets replaced by the background': 'Белое = что заменяется фоном',
  'Alt+Shift+H works here too.': 'Alt+Shift+H работает и здесь.',
  'Record a new gesture': 'Записать новый жест',
  'Press, step back so your hand is clearly in the picture, and hold the pose for a second after the countdown, or do the motion (a swipe, a goodbye wave, a circle): the whole path of the hand is remembered, relative to your face. Use one or two hands.':
    'Нажми, отойди, чтобы рука была хорошо видна, и после отсчёта подержи позу секунду или сделай движение (свайп, помахать «чао», круг): запомнится весь путь руки относительно лица. Можно одной или двумя руками.',
  'Pick an effect; its settings are right below. Replay shows it on you.': 'Выбери эффект, его настройки прямо под плитками. «Повторить» покажет его на тебе.',
  // v2.3: settings next to what they belong to
  'settings': 'настройки', 'General': 'Общие', 'Duration': 'Длительность', 'Replay': 'Повторить',
  'Play the effect': 'Проиграть эффект', 'Reset this effect': 'Сбросить настройки эффекта', 'Timing and volume': 'Синхронизация и громкость',
  'The effect starts at the sound hit plus this time.': 'Эффект начинается в момент удара звука плюс это время.',
  'How far the dust flies': 'Как далеко летит пыль', 'Dust grain size': 'Размер пылинок',
  'Flash brightness': 'Яркость вспышки', 'Glow colour': 'Цвет свечения',
  'Tear strength': 'Сила разрыва', 'Camera shake': 'Тряска камеры', 'Punch strength': 'Сила наезда',
  'Smoke density': 'Плотность дыма', 'Cloud size': 'Размер облака',
  'Number of shards': 'Количество осколков', 'How far the shards fly': 'Как далеко летят осколки', 'Blur': 'Размытие',
  'Sounds': 'Звуки',
  'The built-in ones are synthesised. Your own files (mp3, wav, up to 3 MB each) show up in the lists too; the call hears them as well.':
    'Встроенные звуки синтезированы. Свои файлы (mp3, wav, до 3 МБ) тоже появятся в списках; в звонке их слышно.',
  'Add a sound file…': 'Добавить звуковой файл…',
  'Fine tuning': 'Тонкая настройка',
  'Gesture debug on the call page': 'Отладка жестов на странице звонка',
  'Meme': 'Мем', 'flick a V sign at your chest': 'резко V у груди',
  'Seals, two hands': 'Печати, две руки', 'Seals, one hand': 'Печати, одна рука',
  'Snap, both hands': 'Щелчок, обе руки', 'Snap, one hand': 'Щелчок, одна рука', 'hands raised': 'руки подняты', 'hand raised': 'рука поднята',
  'recorded below': 'записаны ниже', 'Button only': 'Только кнопка', 'or Alt+Shift+H': 'или Alt+Shift+H',
  '1 hand': '1 рука', 'hands': 'руки',
  'You are hidden. Do the gesture again or press the button to come back.': 'Тебя не видно. Повтори жест или нажми кнопку, чтобы вернуться.',
  'Icon': 'Значок', 'Record again': 'Записать заново', 'Match': 'Совпадение', 'Strictness': 'Строгость', 'Hold for': 'Удерживать',
  'Allowed tilt': 'Допустимый наклон', 'Does': 'Действие', 'Vanish and appear': 'Исчезнуть и появиться', 'Vanish only': 'Только исчезнуть', 'Appear only': 'Только появиться',
  'No hand seen. Step back so the whole hand is in the picture and try again.': 'Руки не видно. Отойди, чтобы вся рука была в кадре, и попробуй ещё раз.',
  'Got it, both hands! Try it now.': 'Записал, обе руки! Попробуй прямо сейчас.',
  'Got it! Try it now.': 'Записал! Попробуй прямо сейчас.',
};

let LANG = 'en';
const T = s => (LANG === 'ru' && RU[s]) || s;

// Translates the static text already in the page (text nodes, aria-label, title).
// Remembers each node's English text, so switching back and forth works.
function localize(root = document.body) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    n.en ??= n.nodeValue;
    const key = n.en.trim();
    if (key) n.nodeValue = n.en.replace(key, T(key));
  }
  for (const el of root.querySelectorAll('[aria-label], [title]')) for (const a of ['aria-label', 'title']) {
    if (!el.hasAttribute(a)) continue;
    el.dataset['en' + a.replace('-', '')] ??= el.getAttribute(a);
    el.setAttribute(a, T(el.dataset['en' + a.replace('-', '')]));
  }
  document.documentElement.lang = LANG;
}
