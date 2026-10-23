// Page world: intercept getUserMedia and hand the camera to vanish.js (extension world),
// which runs the ML there because the page's CSP may forbid loading WASM here.
(() => {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) return;
  const orig = md.getUserMedia.bind(md);

  const onStop = (t, fn) => { const stop = t.stop.bind(t); t.stop = () => { fn(); stop(); }; };

  // Mic-only request: route it through the extension's mix so the sound effect reaches the call.
  async function mixAudioOnly(s) {
    const [a] = s.getAudioTracks();
    const box = document.createElement('vanish-cam');
    box.hidden = true;
    const v = document.createElement('video');
    v.srcObject = new MediaStream([a]);
    box.append(v);
    document.documentElement.append(box);
    const out = await new Promise(resolve => {
      box.addEventListener('vanish-audio-ready', () => resolve(box.lastChild.srcObject), { once: true });
      setTimeout(() => resolve(null), 3000);
      box.dispatchEvent(new Event('vanish-audio', { bubbles: true }));
    });
    if (!out) { box.remove(); return s; }
    const [t] = out.getAudioTracks();
    onStop(t, () => { s.getAudioTracks().forEach(x => x.stop()); box.remove(); });
    return new MediaStream([t]);
  }

  md.getUserMedia = async constraints => {
    const s = await orig(constraints);
    const [cam] = s.getVideoTracks();
    if (!cam) return s.getAudioTracks().length ? mixAudioOnly(s) : s;

    // A separate mic copy for snap detection, so it still hears you when the site mutes you.
    let mic = s.getAudioTracks()[0]?.clone();
    if (!mic) try { mic = (await orig({ audio: true })).getAudioTracks()[0]; } catch {}

    const box = document.createElement('vanish-cam');
    box.hidden = true;
    const v = document.createElement('video');
    v.srcObject = new MediaStream(mic ? [cam, mic] : [cam]);
    box.append(v);
    document.documentElement.append(box);

    const out = await new Promise(resolve => {
      box.addEventListener('vanish-ready', () => resolve(box.lastChild.srcObject), { once: true });
      setTimeout(() => resolve(null), 3000);
      box.dispatchEvent(new Event('vanish-start', { bubbles: true }));
    });
    if (!out) { mic?.stop(); box.remove(); return s; } // extension side not there: give the raw camera

    const [track] = out.getVideoTracks();
    // Mic with the sound effect mixed in, only if the site asked for audio in this call.
    const [aud] = s.getAudioTracks().length ? out.getAudioTracks() : [];

    // Video and audio stop separately (Meet turns the camera off but keeps the mic);
    // the shared mic copy and the hand-off element go once both are stopped.
    let alive = aud ? 2 : 1;
    const done = () => { if (--alive === 0) { mic?.stop(); box.remove(); } };
    onStop(track, () => { cam.stop(); done(); });
    if (aud) onStop(aud, () => { s.getAudioTracks().forEach(t => t.stop()); done(); });
    return new MediaStream([track, ...(aud ? [aud] : s.getAudioTracks())]);
  };
})();
