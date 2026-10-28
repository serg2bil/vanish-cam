// Built-in sound effects, synthesised on the spot (no audio files, nothing to license).
// SYNTH[id](rate) -> Promise<AudioBuffer>. Ids are used as 'syn:<id>' in the sound settings.

const SYNTH_LIST = [
  ['whoosh', 'Whoosh'],
  ['pop', 'Pop'],
  ['poof', 'Poof (smoke)'],
  ['sparkle', 'Sparkle (magic)'],
  ['teleport', 'Teleport'],
  ['zap', 'Zap'],
  ['boom', 'Bass boom'],
  ['bubble', 'Bubble'],
];

const SYNTH = (() => {
  const render = (dur, build) => async rate => {
    const ac = new OfflineAudioContext(1, Math.ceil(dur * rate), rate);
    build(ac, ac.destination);
    return ac.startRendering();
  };
  const noise = (ac, dur) => {
    const b = ac.createBuffer(1, Math.ceil(dur * ac.sampleRate), ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = new AudioBufferSourceNode(ac, { buffer: b });
    s.start();
    return s;
  };
  // [[time, gain], ...] -> GainNode with that envelope (exponential ramps, so never exactly 0)
  const env = (ac, pts) => {
    const g = new GainNode(ac, { gain: 0 });
    pts.forEach(([t, v], i) => i ? g.gain.exponentialRampToValueAtTime(Math.max(1e-4, v), t) : g.gain.setValueAtTime(Math.max(1e-4, v), t));
    return g;
  };
  const tone = (ac, type, f0, f1, t0, t1, out) => {
    const o = new OscillatorNode(ac, { type, frequency: f0 });
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t1);
    o.connect(out);
    o.start(t0);
    o.stop(t1 + 0.05);
    return o;
  };
  const chain = (out, ...nodes) => { nodes.reduce((a, b) => a.connect(b)).connect(out); };

  return {
    whoosh: render(0.7, (ac, out) => {
      const f = new BiquadFilterNode(ac, { type: 'bandpass', Q: 1.2, frequency: 300 });
      f.frequency.exponentialRampToValueAtTime(3500, 0.45);
      f.frequency.exponentialRampToValueAtTime(600, 0.7);
      chain(out, noise(ac, 0.7), f, env(ac, [[0, 0.01], [0.4, 0.9], [0.7, 0.001]]));
    }),
    pop: render(0.2, (ac, out) => {
      const g = env(ac, [[0, 1], [0.15, 0.001]]);
      g.connect(out);
      tone(ac, 'sine', 900, 150, 0, 0.12, g);
    }),
    poof: render(0.6, (ac, out) => {
      const f = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 1800, Q: 0.7 });
      f.frequency.exponentialRampToValueAtTime(200, 0.6);
      chain(out, noise(ac, 0.6), f, env(ac, [[0, 0.9], [0.05, 1], [0.6, 0.001]]));
    }),
    sparkle: render(0.9, (ac, out) => {
      [1047, 1319, 1568, 2093, 2637, 3136, 2093, 4186].forEach((f, i) => {
        const t = i * 0.08, g = env(ac, [[t, 0.001], [t + 0.01, 0.5], [t + 0.35, 0.001]]);
        g.connect(out);
        tone(ac, 'triangle', f, f * 1.01, t, t + 0.35, g);
      });
    }),
    teleport: render(0.9, (ac, out) => {
      const g = env(ac, [[0, 0.01], [0.1, 0.6], [0.7, 0.6], [0.9, 0.001]]);
      g.connect(out);
      const o = tone(ac, 'sine', 220, 1800, 0, 0.9, g);
      const lfo = new OscillatorNode(ac, { frequency: 18 }), lg = new GainNode(ac, { gain: 60 });
      lfo.connect(lg).connect(o.frequency);
      lfo.start();
      const f = new BiquadFilterNode(ac, { type: 'highpass', frequency: 4000 });
      chain(out, noise(ac, 0.9), f, env(ac, [[0, 0.001], [0.7, 0.25], [0.9, 0.001]]));
    }),
    zap: render(0.25, (ac, out) => {
      const g = env(ac, [[0, 0.8], [0.22, 0.001]]), g2 = env(ac, [[0, 0.3], [0.1, 0.001]]);
      g.connect(out); g2.connect(out);
      tone(ac, 'sawtooth', 1500, 80, 0, 0.22, g);
      tone(ac, 'square', 3000, 120, 0, 0.1, g2);
    }),
    boom: render(1.2, (ac, out) => {
      const g = env(ac, [[0, 1], [0.1, 1], [1.2, 0.001]]);
      g.connect(out);
      tone(ac, 'sine', 160, 35, 0, 1.2, g);
      const f = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 400 });
      chain(out, noise(ac, 0.15), f, env(ac, [[0, 0.6], [0.15, 0.001]]));
    }),
    bubble: render(0.3, (ac, out) => {
      const g = env(ac, [[0, 0.001], [0.03, 0.8], [0.3, 0.001]]);
      g.connect(out);
      tone(ac, 'sine', 300, 1400, 0, 0.3, g);
    }),
  };
})();
