// Toolbar popup: main settings, advanced sliders, and remote control of the camera in the current tab.
// Settings are saved to chrome.storage; the page scripts pick them up immediately.

const $ = id => document.getElementById(id);
let settings = { ...DEFAULTS };

const MODE_HINTS = {
  meme: 'Резко поднеси ✌️ к груди — исчезнешь. Ещё раз — появишься.',
  seals: 'Обеими руками по очереди: ✌️✌️, потом ✊✊, потом ✋✋.',
  seals1: 'Одной рукой по очереди: ✌️, потом ✊, потом ✋.',
  snap2: 'Щёлкни пальцами обеих рук, руки подняты.',
  snap: 'Щёлкни пальцами, рука поднята над столом.',
  off: 'Только кнопкой здесь или Alt+Shift+H.',
};

let saveTimer;
function save(now = false) {
  clearTimeout(saveTimer);
  const write = () => chrome.storage.local.set({ settings });
  now ? write() : (saveTimer = setTimeout(write, 120)); // sliders fire a lot; batch them
}

// ---------- main screen ----------
for (const [id, list] of [['mode', MODES], ['device', DEVICES], ['segModel', SEG_MODELS]]) {
  $(id).append(...list.map(([value, text]) => new Option(text, value)));
  $(id).addEventListener('change', () => { settings[id] = $(id).value; render(); save(true); });
}
$('panel').addEventListener('change', () => { settings.panel = $('panel').checked; save(true); });
$('gdebug').addEventListener('change', () => { settings.gdebug = $('gdebug').checked; save(true); });

// ---------- advanced screen ----------
const fmt = (v, unit) => unit === 'мс' ? `${Math.round(v)} мс`
  : unit === '%' ? `${Math.round(v)}%`
  : unit === '×' ? `${(+v).toFixed(2)}×`
  : unit === '×лицо' ? `${(+v).toFixed(2)} лица`
  : (+v).toFixed(2);

for (const group of ADVANCED) {
  const card = document.createElement('section');
  card.className = 'card';
  card.append(Object.assign(document.createElement('h2'), { textContent: group.title }));
  for (const it of group.items) {
    const box = document.createElement('div');
    box.className = 'slider';
    const input = Object.assign(document.createElement('input'), { type: 'range', id: it.key, min: it.min, max: it.max, step: it.step });
    const out = document.createElement('output');
    out.htmlFor = it.key;
    const label = Object.assign(document.createElement('label'), { htmlFor: it.key, textContent: it.label });
    const head = document.createElement('div');
    head.className = 'head';
    head.append(label, out);
    box.append(head, input);
    if (it.hint) box.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: it.hint }));
    input.addEventListener('input', () => { settings[it.key] = +input.value; out.value = fmt(input.value, it.unit); save(); });
    card.append(box);
  }
  $('advGroups').append(card);
}

$('reset').addEventListener('click', () => {
  const { panel, mode, vanishSound, appearSound } = settings; // keep the main-screen choices
  settings = { ...DEFAULTS, panel, mode, vanishSound, appearSound };
  render();
  save(true);
});

function render() {
  for (const id of ['mode', 'vanishSound', 'appearSound', 'device', 'segModel']) $(id).value = settings[id];
  $('modeHint').textContent = MODE_HINTS[settings.mode] ?? '';
  $('panel').checked = settings.panel;
  $('gdebug').checked = settings.gdebug;
  for (const group of ADVANCED) for (const it of group.items) {
    $(it.key).value = settings[it.key];
    $(it.key).previousElementSibling.querySelector('output').value = fmt(settings[it.key], it.unit);
  }
}

function showAdvanced(on) {
  $('main').hidden = on;
  $('adv').hidden = !on;
  $('gear').hidden = on;
  $('back').hidden = !on;
  $('title').textContent = on ? 'Настройки' : 'Vanish Cam';
}
$('gear').addEventListener('click', () => showAdvanced(true));
$('back').addEventListener('click', () => showAdvanced(false));

chrome.storage.local.get('settings', async r => { settings = { ...DEFAULTS, ...r.settings }; await loadSounds(); render(); });

// ---------- your own sounds (the extension ships none) ----------
const MAX_SOUND = 3 * 1024 * 1024;
let sounds = [];

const toB64 = bytes => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

function renderSounds() {
  for (const id of ['vanishSound', 'appearSound']) {
    $(id).replaceChildren(...sounds.flatMap(s => [new Option(s.name, s.id), new Option(s.name + ' задом наперёд', s.id + ':rev')]), new Option('Без звука', 'off'));
    if (![...$(id).options].some(o => o.value === settings[id])) settings[id] = 'off';
    $(id).value = settings[id];
  }
  $('soundList').replaceChildren(...sounds.map(s => {
    const row = Object.assign(document.createElement('div'), { className: 'row sound' });
    const name = Object.assign(document.createElement('span'), { textContent: s.name });
    const play = Object.assign(document.createElement('button'), { className: 'play', textContent: '▶', title: 'Послушать' });
    const del = Object.assign(document.createElement('button'), { className: 'play', textContent: '✕', title: 'Удалить' });
    play.onclick = () => preview(s.id);
    del.onclick = () => setSounds(sounds.filter(x => x.id !== s.id));
    row.append(name, play, del);
    return row;
  }));
}

async function setSounds(list) {
  try { await chrome.storage.local.set({ sounds: list }); } catch { $('soundErr').textContent = 'Не хватило места, удали ненужные звуки'; return; }
  sounds = list;
  renderSounds();
  save(true); // a removed sound may have reset a choice
}

$('addSound').addEventListener('change', async () => {
  $('soundErr').textContent = '';
  const next = [...sounds];
  for (const f of $('addSound').files) {
    if (f.size > MAX_SOUND) { $('soundErr').textContent = `${f.name}: больше 3 МБ`; continue; }
    next.push({ id: 's' + Date.now() + next.length, name: f.name.replace(/\.[^.]+$/, ''), b64: toB64(new Uint8Array(await f.arrayBuffer())) });
  }
  $('addSound').value = '';
  setSounds(next);
});

// Sounds kept next to the extension but not in the repo: sounds/index.json = [{ id, name, file }].
// Imported once; also migrates the earlier two fixed slots.
async function loadSounds() {
  const r = await chrome.storage.local.get(['sounds', 'seeded', 'mine1', 'mine2']);
  const list = r.sounds ?? [];
  for (const k of ['mine1', 'mine2']) if (r[k]) list.push({ id: k, name: r[k].name.replace(/\.[^.]+$/, ''), b64: r[k].b64 });
  if (!r.seeded) {
    try {
      for (const it of await (await fetch('sounds/index.json')).json()) {
        const bytes = new Uint8Array(await (await fetch('sounds/' + it.file)).arrayBuffer());
        if (!list.some(x => x.id === it.id)) list.push({ id: it.id, name: it.name, b64: toB64(bytes) });
      }
    } catch {} // no local sounds folder
    await chrome.storage.local.set({ seeded: true });
  }
  await chrome.storage.local.set({ sounds: list });
  await chrome.storage.local.remove(['mine1', 'mine2']);
  sounds = list;
  renderSounds();
}

// ---------- sound preview (only you hear it) ----------
let ac, previewing;
const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
async function preview(choice) {
  const [name, rev] = choice.split(':');
  const saved = sounds.find(s => s.id === name);
  if (!saved) return;
  ac ??= new AudioContext();
  let buf = await ac.decodeAudioData(b64ToBytes(saved.b64).buffer);
  if (rev) { // same trim + reverse as on the page
    const { cut } = soundHit(buf.getChannelData(0), buf.sampleRate);
    const n = Math.max(1, Math.round(cut * buf.sampleRate));
    const r = new AudioBuffer({ length: n, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels });
    for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).slice(0, n).reverse());
    buf = r;
  }
  previewing?.stop();
  previewing = new AudioBufferSourceNode(ac, { buffer: buf });
  previewing.connect(new GainNode(ac, { gain: settings.localVolume })).connect(ac.destination);
  previewing.start();
}
for (const b of document.querySelectorAll('.play[data-for]')) b.addEventListener('click', () => preview($(b.dataset.for).value));

// ---------- the camera in the current tab ----------
let tabId = null;
function send(cmd) {
  return new Promise(resolve => {
    if (tabId === null) return resolve(null);
    chrome.tabs.sendMessage(tabId, { cmd }, reply => { void chrome.runtime.lastError; resolve(reply ?? null); });
  });
}

function showState(r) {
  const live = !!r;
  $('toggle').disabled = $('capture').disabled = !live;
  $('dot').className = 'dot' + (live ? (r.hidden ? ' hidden' : ' live') : '');
  if (!live) {
    $('where').textContent = 'Камера на этой вкладке не включена';
    $('info').textContent = 'Открой звонок (Meet, Zoom в браузере и т.п.) и включи камеру. Если вкладка уже открыта — перезагрузи её.';
    $('toggle').textContent = 'Исчезнуть';
    $('toggle').classList.remove('on');
    return;
  }
  $('where').textContent = r.hidden ? 'Ты исчез из видео' : 'Камера работает';
  $('toggle').textContent = r.pending ? '…' : r.hidden ? 'Появиться' : 'Исчезнуть';
  $('toggle').classList.toggle('on', r.hidden);
  $('capture').textContent = r.captureIn > 0 ? `Уйди из кадра… ${Math.ceil(r.captureIn / 1000)}` : 'Запомнить фон';
  $('info').textContent = [r.status, r.fps ? `${r.fps} к/с` : '', r.info].filter(Boolean).join(' · ');
  // Model speed, to compare GPU vs CPU (ms per run, averaged over the last second).
  const p = r.perf, ms = v => (v == null ? '—' : `${Math.round(v)} мс`);
  const speed = p ? `Вырезание ${ms(p.seg)} · Руки ${ms(p.hands)} · Лицо ${ms(p.face)} · ${p.jobs ?? '—'} раз/с · видео ${r.fps} к/с` : '';
  $('perf').textContent = speed ? `${r.status}\n${speed}` : '';
}

async function poll() { showState(await send('status')); }
$('toggle').addEventListener('click', async () => showState(await send('toggle')));
$('capture').addEventListener('click', async () => showState(await send('captureBg')));

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  tabId = tab?.id ?? null;
  poll();
  setInterval(poll, 400);
});
