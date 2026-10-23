// Settings shared by the popup and the page scripts, stored in chrome.storage.local under "settings".
// CFG holds the live values; page scripts update it when the popup changes something.

const DEFAULTS = {
  // main screen
  mode: 'meme',             // meme | seals | seals1 | snap2 | snap | off
  vanishSound: 'clean',     // id of a sound in the popup's list (+ ':rev' = backwards) | off
  appearSound: 'clean:rev',
  panel: false,             // show the panel on the page
  // advanced
  fadeMs: 350, vanishOffset: 0, appearOffset: 0,
  callVolume: 1, localVolume: 0.6,
  captureDelay: 5000,
  memeHold: 150, memeArrive: 0.15, memeCooldown: 1500, chestLine: 1.25,
  snapSens: 75, snapTouch: 0.45, snapLift: 0.6, snapWindow: 800,
  sealGap: 3000,
  gdebug: false,
  device: 'auto',           // auto | cpu: where the models run (auto = graphics card, processor if it fails)
  segModel: 'rvm',          // rvm | simple: cutout model (RVM looks better; on the processor only simple is fast)
};

const DEVICES = [
  ['auto', 'Видеокарта'],
  ['cpu', 'Процессор'],
];

const SEG_MODELS = [
  ['rvm', 'Качественная (RVM)'],
  ['simple', 'Быстрая простая'],
];

const MODES = [
  ['meme', 'Мем: ✌️ у груди'],
  ['seals', 'Печати двумя руками ✌️ → ✊ → ✋'],
  ['seals1', 'Печати одной рукой ✌️ → ✊ → ✋'],
  ['snap2', 'Щелчок двумя руками'],
  ['snap', 'Щелчок одной рукой'],
  ['off', 'Выкл (только кнопка)'],
];

// Advanced screen: one slider per setting.
const ADVANCED = [
  { title: 'Исчезновение и появление', items: [
    { key: 'fadeMs', label: 'Длительность растворения', min: 50, max: 2000, step: 50, unit: 'мс' },
    { key: 'vanishOffset', label: 'Исчезать позже удара звука на', min: -500, max: 1500, step: 50, unit: 'мс',
      hint: 'Растворение начинается на ударе звука плюс это время.' },
    { key: 'appearOffset', label: 'Появляться позже удара звука на', min: -500, max: 1500, step: 50, unit: 'мс',
      hint: 'Ты полностью проявляешься на ударе звука плюс это время.' },
    { key: 'captureDelay', label: 'Таймер «Запомнить фон»', min: 1000, max: 15000, step: 500, unit: 'мс' },
  ] },
  { title: 'Звук', items: [
    { key: 'callVolume', label: 'Громкость в звонке', min: 0, max: 2, step: 0.05, unit: '×' },
    { key: 'localVolume', label: 'Громкость у тебя', min: 0, max: 2, step: 0.05, unit: '×' },
  ] },
  { title: 'Мем: ✌️ у груди', items: [
    { key: 'memeHold', label: 'Подержать жест', min: 0, max: 1500, step: 50, unit: 'мс' },
    { key: 'memeArrive', label: 'Насколько резко «прилететь»', min: 0, max: 0.5, step: 0.01, unit: '',
      hint: '0 — можно просто держать ✌️ у груди. Больше — рука должна сильнее переместиться.' },
    { key: 'memeCooldown', label: 'Пауза после срабатывания', min: 0, max: 5000, step: 100, unit: 'мс' },
    { key: 'chestLine', label: 'Насколько ниже лица считается грудь', min: 0.8, max: 2.5, step: 0.05, unit: '×лицо' },
  ] },
  { title: 'Щелчок', items: [
    { key: 'snapSens', label: 'Чувствительность к звуку щелчка', min: 0, max: 100, step: 1, unit: '%' },
    { key: 'snapTouch', label: 'Большой палец у среднего: не дальше', min: 0.1, max: 1, step: 0.01, unit: '' },
    { key: 'snapLift', label: 'Средний палец поднят: не меньше', min: 0, max: 1.5, step: 0.01, unit: '' },
    { key: 'snapWindow', label: 'Поза щелчка до звука: не раньше чем за', min: 200, max: 2000, step: 50, unit: 'мс' },
  ] },
  { title: 'Печати', items: [
    { key: 'sealGap', label: 'Время между печатями', min: 500, max: 8000, step: 250, unit: 'мс' },
  ] },
];

const CFG = { ...DEFAULTS };
