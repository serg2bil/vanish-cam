// Sound choices for the popup and the studio: built-in ones (synth.js) and files you added
// (chrome.storage.local 'sounds' = [{ id, name, b64 }]). Also plays a preview, only for you.

const MAX_SOUND = 3 * 1024 * 1024;
let soundFiles = [];

const toB64 = bytes => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function loadSoundFiles() {
  const r = await chrome.storage.local.get(['sounds', 'seeded']);
  const list = r.sounds ?? [];
  if (!r.seeded) { // sounds kept next to the extension but not in the repo: sounds/index.json = [{ id, name, file }]
    try {
      for (const it of await (await fetch('sounds/index.json')).json()) {
        const bytes = new Uint8Array(await (await fetch('sounds/' + it.file)).arrayBuffer());
        if (!list.some(x => x.id === it.id)) list.push({ id: it.id, name: it.name, b64: toB64(bytes) });
      }
    } catch {} // no local sounds folder
    await chrome.storage.local.set({ seeded: true, sounds: list });
  }
  return soundFiles = list;
}

// Saves the list; returns false when storage is full.
async function saveSoundFiles(list) {
  try { await chrome.storage.local.set({ sounds: list }); } catch { return false; }
  soundFiles = list;
  return true;
}

// Files picked in an <input type=file>: [{ id, name, b64 }], and the names of files that were too big.
async function readSoundFiles(files) {
  const added = [], tooBig = [];
  for (const f of files) {
    if (f.size > MAX_SOUND) { tooBig.push(f.name); continue; }
    added.push({ id: 's' + Date.now() + added.length, name: f.name.replace(/\.[^.]+$/, ''), b64: toB64(new Uint8Array(await f.arrayBuffer())) });
  }
  return { added, tooBig };
}

// Fills a <select> with every choice: built-in, your files (each also reversed), and "No sound".
function fillSoundSelect(sel, value) {
  const group = (label, items) => {
    const g = document.createElement('optgroup');
    g.label = label;
    g.append(...items.flatMap(([id, name]) => [new Option(name, id), new Option(`${name} ${T('(reversed)')}`, id + ':rev')]));
    return g;
  };
  sel.replaceChildren(group(T('Built-in'), SYNTH_LIST.map(([id, name]) => ['syn:' + id, T(name)])));
  if (soundFiles.length) sel.append(group(T('My sounds'), soundFiles.map(s => [s.id, s.name])));
  sel.append(new Option(T('No sound'), 'off'));
  sel.value = [...sel.options].some(o => o.value === value) ? value : 'off';
  return sel.value;
}

// Plays a choice ('syn:id', 'file-id', either + ':rev', 'off') on your speakers only.
let previewAc, previewing;
async function previewSound(choice, volume = 1) {
  const parts = choice.split(':'), rev = parts.at(-1) === 'rev' && parts.pop();
  const name = parts.join(':');
  previewAc ??= new AudioContext();
  let buf;
  if (name.startsWith('syn:')) buf = await SYNTH[name.slice(4)]?.(previewAc.sampleRate);
  else {
    const saved = soundFiles.find(s => s.id === name);
    if (saved) buf = await previewAc.decodeAudioData(b64ToBytes(saved.b64).buffer);
  }
  if (!buf) return;
  if (rev) { // same trim + reverse as on the call page
    const { cut } = soundHit(buf.getChannelData(0), buf.sampleRate);
    const n = Math.max(1, Math.round(cut * buf.sampleRate));
    const r = new AudioBuffer({ length: n, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels });
    for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).slice(0, n).reverse());
    buf = r;
  }
  previewing?.stop();
  previewing = new AudioBufferSourceNode(previewAc, { buffer: buf });
  previewing.connect(new GainNode(previewAc, { gain: volume })).connect(previewAc.destination);
  previewing.start();
}
