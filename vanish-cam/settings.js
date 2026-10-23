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
  ['auto', 'GPU'],
  ['cpu', 'CPU'],
];

const SEG_MODELS = [
  ['rvm', 'Quality (RVM)'],
  ['simple', 'Fast, simple'],
];

const MODES = [
  ['meme', 'Meme: ✌️ at the chest'],
  ['seals', 'Seals with two hands ✌️ → ✊ → ✋'],
  ['seals1', 'Seals with one hand ✌️ → ✊ → ✋'],
  ['snap2', 'Snap with two hands'],
  ['snap', 'Snap with one hand'],
  ['off', 'Off (button only)'],
];

// Advanced screen: one slider per setting.
const ADVANCED = [
  { title: 'Vanishing and appearing', items: [
    { key: 'fadeMs', label: 'Dissolve duration', min: 50, max: 2000, step: 50, unit: 'ms' },
    { key: 'vanishOffset', label: 'Vanish after the sound hit by', min: -500, max: 1500, step: 50, unit: 'ms',
      hint: 'The dissolve starts at the sound hit plus this time.' },
    { key: 'appearOffset', label: 'Appear after the sound hit by', min: -500, max: 1500, step: 50, unit: 'ms',
      hint: 'You are fully visible at the sound hit plus this time.' },
    { key: 'captureDelay', label: '"Remember background" timer', min: 1000, max: 15000, step: 500, unit: 'ms' },
  ] },
  { title: 'Sound', items: [
    { key: 'callVolume', label: 'Volume in the call', min: 0, max: 2, step: 0.05, unit: '×' },
    { key: 'localVolume', label: 'Volume for you', min: 0, max: 2, step: 0.05, unit: '×' },
  ] },
  { title: 'Meme: ✌️ at the chest', items: [
    { key: 'memeHold', label: 'Hold the gesture', min: 0, max: 1500, step: 50, unit: 'ms' },
    { key: 'memeArrive', label: 'How sharply it must "fly in"', min: 0, max: 0.5, step: 0.01, unit: '',
      hint: '0: just holding ✌️ at the chest is enough. More: the hand must move further.' },
    { key: 'memeCooldown', label: 'Pause after it fires', min: 0, max: 5000, step: 100, unit: 'ms' },
    { key: 'chestLine', label: 'How far below the face counts as chest', min: 0.8, max: 2.5, step: 0.05, unit: '×face' },
  ] },
  { title: 'Snap', items: [
    { key: 'snapSens', label: 'Snap sound sensitivity', min: 0, max: 100, step: 1, unit: '%' },
    { key: 'snapTouch', label: 'Thumb near middle finger: no further than', min: 0.1, max: 1, step: 0.01, unit: '' },
    { key: 'snapLift', label: 'Middle finger raised: at least', min: 0, max: 1.5, step: 0.01, unit: '' },
    { key: 'snapWindow', label: 'Snap pose before the sound: no earlier than', min: 200, max: 2000, step: 50, unit: 'ms' },
  ] },
  { title: 'Seals', items: [
    { key: 'sealGap', label: 'Time between seals', min: 500, max: 8000, step: 250, unit: 'ms' },
  ] },
];

const CFG = { ...DEFAULTS };
