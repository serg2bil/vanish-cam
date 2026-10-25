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
  'Meme: ✌️ at the chest': 'Мем: ✌️ у груди',
  'Seals with two hands ✌️ → ✊ → ✋': 'Печати двумя руками ✌️ → ✊ → ✋',
  'Seals with one hand ✌️ → ✊ → ✋': 'Печати одной рукой ✌️ → ✊ → ✋',
  'Snap with two hands': 'Щелчок двумя руками',
  'Snap with one hand': 'Щелчок одной рукой',
  'Off (button only)': 'Выключено (только кнопка)',
  'Vanishing and appearing': 'Исчезновение и появление',
  'Dissolve duration': 'Длительность растворения',
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
  '0: just holding ✌️ at the chest is enough. More: the hand must move further.':
    '0: достаточно держать ✌️ у груди. Больше: рука должна пролететь дальше.',
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
  'Flick ✌️ at your chest to vanish. Do it again to reappear.': 'Резко покажи ✌️ у груди, чтобы исчезнуть. Ещё раз, чтобы появиться.',
  'Both hands in turn: ✌️✌️, then ✊✊, then ✋✋.': 'Обе руки по очереди: ✌️✌️, потом ✊✊, потом ✋✋.',
  'One hand in turn: ✌️, then ✊, then ✋.': 'Одна рука по очереди: ✌️, потом ✊, потом ✋.',
  'Snap the fingers of both hands, hands raised.': 'Щёлкни пальцами обеих рук, руки подняты.',
  'Snap your fingers, hand raised above the desk.': 'Щёлкни пальцами, рука поднята над столом.',
  'Only with the button here or Alt+Shift+H.': 'Только кнопкой здесь или Alt+Shift+H.',
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
