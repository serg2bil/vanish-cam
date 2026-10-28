// Settings shared by the popup and the page scripts, stored in chrome.storage.local under "settings".
// CFG holds the live values; page scripts update it when the popup changes something.

const DEFAULTS = {
  // main screen
  enabled: true,            // the main switch: off = camera untouched, no models, no gestures
  mode: 'meme',             // meme | seals | seals1 | snap2 | snap | custom | off
  gestures: [],             // your own recorded gestures (mode 'custom'): see recordGesture() in gestures.js
                            // [{ id, name, icon, hands, shapes, tol, turn, hold, when: 'both'|'vanish'|'appear' }]
  effect: 'dust',           // how you leave the picture: an id from EFFECT_LIST (effects.js)
  fx: {},                   // per-effect settings you changed: { dust: { ms, spread, … } } (see effectOpts)
  vanishSound: 'syn:whoosh', // 'syn:<id>' built-in (synth.js) | id of a file you added (+ ':rev' = backwards) | off
  appearSound: 'syn:pop',
  panel: false,             // show the panel on the page
  studioTracking: true,     // studio: draw the hand tracking over the picture
  // advanced
  fadeMs: 700,              // base effect length: each effect's default duration is this × its own factor
  vanishOffset: 0, appearOffset: 0,
  callVolume: 1, localVolume: 0.6,
  captureDelay: 5000,
  memeHold: 150, memeArrive: 0.15, memeCooldown: 1500, chestLine: 1.25,
  snapSens: 75, snapTouch: 0.45, snapLift: 0.6, snapWindow: 800, snapRelease: 300,
  sealGap: 3000,
  gdebug: false,
  lang: '',                 // en | ru, '' = the browser's language (popup only)
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
  ['meme', 'Meme: V sign at the chest'],
  ['seals', 'Seals with two hands: V, fist, palm'],
  ['seals1', 'Seals with one hand: V, fist, palm'],
  ['snap2', 'Snap with two hands'],
  ['snap', 'Snap with one hand'],
  ['custom', 'My gestures'],
  ['off', 'Off (button only)'],
];

// A new recorded gesture starts with these; each one has its own copy (editable in the studio).
const GESTURE_DEFAULTS = { tol: 0.4, turn: 60, hold: 150, when: 'both' };

// Sliders, grouped by what they belong to: each group is shown next to its owner in the studio
// (the gesture tile, the sounds card, general settings), not all in one list.
const ADVANCED = {
  sound: [
    { key: 'vanishOffset', label: 'Vanish after the sound hit by', min: -500, max: 1500, step: 50, unit: 'ms',
      hint: 'The effect starts at the sound hit plus this time.' },
    { key: 'appearOffset', label: 'Appear after the sound hit by', min: -500, max: 1500, step: 50, unit: 'ms',
      hint: 'You are fully visible at the sound hit plus this time.' },
    { key: 'callVolume', label: 'Volume in the call', min: 0, max: 2, step: 0.05, unit: '×' },
    { key: 'localVolume', label: 'Volume for you', min: 0, max: 2, step: 0.05, unit: '×' },
  ],
  meme: [
    { key: 'memeHold', label: 'Hold the gesture', min: 0, max: 1500, step: 50, unit: 'ms' },
    { key: 'memeArrive', label: 'How sharply it must "fly in"', min: 0, max: 0.5, step: 0.01, unit: '',
      hint: '0: just holding the V sign at the chest is enough. More: the hand must move further.' },
    { key: 'memeCooldown', label: 'Pause after it fires', min: 0, max: 5000, step: 100, unit: 'ms' },
    { key: 'chestLine', label: 'How far below the face counts as chest', min: 0.8, max: 2.5, step: 0.05, unit: '×face' },
  ],
  snap: [
    { key: 'snapSens', label: 'Snap sound sensitivity', min: 0, max: 100, step: 1, unit: '%' },
    { key: 'snapTouch', label: 'Thumb near middle finger: no further than', min: 0.1, max: 1, step: 0.01, unit: '' },
    { key: 'snapLift', label: 'Middle finger raised: at least', min: 0, max: 1.5, step: 0.01, unit: '' },
    { key: 'snapWindow', label: 'Snap pose before the sound: no earlier than', min: 200, max: 2000, step: 50, unit: 'ms' },
    { key: 'snapRelease', label: 'Fingers must move after the sound within', min: 100, max: 1000, step: 50, unit: 'ms',
      hint: 'A hand held still in the snap pose while you talk never fires. Raise this if real snaps are missed.' },
  ],
  seals: [
    { key: 'sealGap', label: 'Time between seals', min: 500, max: 8000, step: 250, unit: 'ms' },
  ],
  general: [
    { key: 'captureDelay', label: '"Remember background" timer', min: 1000, max: 15000, step: 500, unit: 'ms' },
  ],
};
// Which slider group belongs to which gesture mode.
const MODE_SETTINGS = { meme: 'meme', seals: 'seals', seals1: 'seals', snap: 'snap', snap2: 'snap' };

const CFG = { ...DEFAULTS };
