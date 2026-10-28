// Toolbar popup: a remote for the camera in the current tab plus the main choices.
// Everything else (preview, recording gestures, sliders, sound files) lives in the studio page.
// Settings are saved to chrome.storage; the page scripts pick them up immediately.

const $ = id => document.getElementById(id);
let settings = { ...DEFAULTS };

const MODE_HINTS = {
  meme: 'Flick a V sign at your chest to vanish. Do it again to reappear.',
  seals: 'Both hands in turn: V sign, then fist, then open palm.',
  seals1: 'One hand in turn: V sign, then fist, then open palm.',
  snap2: 'Snap the fingers of both hands, hands raised.',
  snap: 'Snap your fingers, hand raised above the desk.',
  custom: 'Gestures you recorded in the studio.',
  off: 'Only with the button here or Alt+Shift+H.',
};

const save = () => chrome.storage.local.set({ settings });
const setIcon = (id, name) => { if ($(id).dataset.icon !== name) { $(id).dataset.icon = name; $(id).replaceChildren(icon(name)); } };
drawIcons();

$('mode').append(...MODES.map(([value, text]) => new Option(text, value)));
for (const id of ['mode', 'effect', 'vanishSound', 'appearSound']) $(id).addEventListener('change', () => { settings[id] = $(id).value; render(); save(); });
$('panel').addEventListener('change', () => { settings.panel = $('panel').checked; save(); });
$('enabled').addEventListener('change', () => { settings.enabled = $('enabled').checked; render(); save(); });
$('studio').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('studio.html') }));
for (const b of document.querySelectorAll('.play[data-for]')) b.addEventListener('click', () => previewSound($(b.dataset.for).value, settings.localVolume));

function render() {
  $('mode').replaceChildren(...MODES.map(([value, text]) => new Option(value === 'custom' ? `${T(text)} (${settings.gestures.length})` : T(text), value)));
  $('effect').replaceChildren(...EFFECT_LIST.map(([value, , text]) => new Option(T(text), value)));
  if (!EFFECT_LIST.some(e => e[0] === settings.effect)) settings.effect = DEFAULTS.effect; // an effect from an older version
  $('mode').value = settings.mode;
  $('effect').value = settings.effect;
  for (const id of ['vanishSound', 'appearSound']) settings[id] = fillSoundSelect($(id), settings[id]);
  $('modeHint').textContent = T(MODE_HINTS[settings.mode] ?? '');
  if (settings.mode === 'custom') { // your gestures, each with its icon
    if (!settings.gestures.length) $('modeHint').textContent = T('No gestures yet: record one in the studio.');
    else $('modeHint').replaceChildren(...settings.gestures.map(g => {
      const s = Object.assign(document.createElement('span'), { className: 'gname' });
      s.append(icon(g.icon ?? 'star'), g.name);
      return s;
    }));
  }
  $('panel').checked = settings.panel;
  $('enabled').checked = settings.enabled;
  $('enabledText').textContent = T(settings.enabled ? 'On' : 'Off');
  document.body.classList.toggle('off', !settings.enabled);
}

function setLang(lang) {
  LANG = lang;
  $('lang').textContent = lang.toUpperCase();
  localize();
  render();
}
$('lang').addEventListener('click', () => { settings.lang = LANG === 'ru' ? 'en' : 'ru'; setLang(settings.lang); save(); });

chrome.storage.local.get('settings', async r => {
  settings = { ...DEFAULTS, ...r.settings };
  await loadSoundFiles();
  setLang(settings.lang || (navigator.language.startsWith('ru') ? 'ru' : 'en'));
});
chrome.storage.onChanged.addListener(ch => { // the studio may be open in another tab
  if (ch.settings) { settings = { ...DEFAULTS, ...ch.settings.newValue }; render(); }
  if (ch.sounds) loadSoundFiles().then(render);
});

// ---------- the camera in the current tab ----------
let tabId = null;
function send(cmd) {
  return new Promise(resolve => {
    if (tabId === null) return resolve(null);
    chrome.tabs.sendMessage(tabId, { cmd }, reply => { void chrome.runtime.lastError; resolve(reply ?? null); });
  });
}

function showState(r) {
  if (!settings.enabled) { // switched off: say so instead of the camera state
    $('toggle').disabled = $('capture').disabled = true;
    $('dot').className = 'dot';
    $('where').textContent = T('Vanish Cam is off');
    $('info').textContent = T('The camera goes out untouched. Turn it on with the switch at the top.');
    $('toggleText').textContent = T('Vanish');
    $('toggle').classList.remove('on', 'pending');
    setIcon('toggleIcon', 'ghost');
    return;
  }
  const live = !!r;
  $('toggle').disabled = $('capture').disabled = !live;
  $('dot').className = 'dot' + (live ? (r.hidden ? ' hidden' : ' live') : '');
  $('toggle').classList.toggle('pending', !!r?.pending);
  if (!live) {
    $('where').textContent = T('The camera is not on in this tab');
    $('info').textContent = T('Open a call (Meet, Zoom in the browser, etc.) and turn the camera on. If the tab was already open, reload it. Or open the studio to try it on your camera.');
    $('toggleText').textContent = T('Vanish');
    setIcon('toggleIcon', 'ghost');
    $('toggle').classList.remove('on');
    return;
  }
  $('where').textContent = T(r.hidden ? 'You are hidden from the video' : 'Camera is running');
  $('toggleText').textContent = r.pending ? '…' : T(r.hidden ? 'Appear' : 'Vanish');
  setIcon('toggleIcon', r.hidden ? 'eye' : 'ghost');
  $('toggle').classList.toggle('on', r.hidden);
  $('capture').textContent = r.captureIn > 0 ? `${T('Step out of frame…')} ${Math.ceil(r.captureIn / 1000)}` : T('Remember background');
  $('info').textContent = [r.status, r.fps ? `${r.fps} fps` : '', r.info].filter(Boolean).join(' · ');
}

async function poll() { showState(await send('status')); }
$('toggle').addEventListener('click', async () => showState(await send('toggle')));
$('capture').addEventListener('click', async () => showState(await send('captureBg')));

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  tabId = tab?.id ?? null;
  poll();
  setInterval(poll, 400);
});
