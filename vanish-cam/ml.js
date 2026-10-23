// The models (hands, face, person cutout) and the mask math. Normally runs in a Web Worker, so
// the video never waits for them; if a page forbids workers, vanish.js runs the same engine inline.
//
// Messages in:  { cmd: 'load', base, device: 'auto'|'gpu'|'cpu', segModel: 'rvm'|'simple' }
//               { cmd: 'job', cam, now, frame: VideoFrame }   (the frame is closed here)
// Messages out: { type: 'status', status, ready? }  |  { type: 'error', message }
//               { type: 'result', cam, now, hide, learn, hands: { landmarks, worldLandmarks }, face, perf }
//   hide / learn: RGBA bytes MW×MH, alpha = "replace with background" / "safe to learn as background".
//   perf: ms spent in each model for this job.

self.makeMlEngine = function makeMlEngine(post) {
  const MW = 384, MH = 224;   // cutout input (RVM likes multiples of 16; the mask is just stretched back)
  const HW = 640, HH = 360;   // hand/face input: hands are small, they need more pixels than the body
  const PERSON = 0.25;        // mask confidence that counts as fully "you" (arms score lower than the body)
  const LEARN = 0.08;         // below this (after growing the mask) a pixel is safe to learn as background
  const GROW = 4;             // grow the hide mask by this many mask pixels, hides the hair/edge halo
  const GROW_LEARN = 8;       // stay further away from you when learning background (motion blur, fast arms)
  const px = MW * MH;
  const log = (...a) => console.log('%c[Vanish Cam]', 'color:#a0f', ...a);

  let base = '', MF = null, models = null, key = '';
  const url = p => base + p;
  const small = new OffscreenCanvas(MW, MH), sctx = small.getContext('2d', { willReadFrequently: true });
  const handIn = new OffscreenCanvas(HW, HH), hictx = handIn.getContext('2d');
  const f32 = () => new Float32Array(px);
  const mask = f32(), hideG = f32(), prevHide = f32(), learnG = f32(), prevLearn = f32(), scratch = f32();

  // Max filter (separable): grows the person mask by r pixels.
  function grow(src, dst, r) {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r), e = Math.min(MW - 1, x + r); k <= e; k++) if (src[y * MW + k] > m) m = src[y * MW + k];
      scratch[y * MW + x] = m;
    }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      let m = 0;
      for (let k = Math.max(0, y - r), e = Math.min(MH - 1, y + r); k <= e; k++) if (scratch[k * MW + x] > m) m = scratch[k * MW + x];
      dst[y * MW + x] = m;
    }
  }

  async function create(Task, fileset, opts, cpu) {
    for (const delegate of cpu ? ['CPU'] : ['GPU', 'CPU']) {
      try {
        self.ModuleFactory = MF; // the lib clears it after each create
        const task = await Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate } });
        task.delegate = delegate;
        return task;
      } catch (e) { log(`${Task.name} failed on ${delegate}`, e); }
    }
    throw Error('models failed to start');
  }

  // onnxruntime runs one inference at a time per thread, across all sessions; while a new RVM is
  // being probed the old one still serves frames, so every RVM run goes through this queue.
  let ortQueue = Promise.resolve();
  const ortSerial = fn => (ortQueue = ortQueue.then(fn, fn));

  // Robust Video Matting: soft alpha with hair detail, remembers the previous frame (no flicker).
  async function loadRVM(cpu) {
    const ort = await import(url('lib/ort/ort.webgpu.min.mjs'));
    ort.env.wasm.wasmPaths = url('lib/ort/');
    ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, which pages don't have
    const states = ['r1o', 'r2o', 'r3o', 'r4o'];
    const input = new Float32Array(3 * px);

    async function build(used) {
      const gpu = used === 'webgpu';
      const sess = await ort.InferenceSession.create(url('models/rvm_mobilenetv3_fp32.onnx'), {
        executionProviders: [used],
        ...(gpu && { preferredOutputLocation: Object.fromEntries(states.map(k => [k, 'gpu-buffer'])) }), // state stays on the GPU
      });
      const zero = () => new ort.Tensor('float32', new Float32Array(1), [1, 1, 1, 1]);
      let rec = states.map(zero);
      const ratio = new ort.Tensor('float32', [1], [1]);
      const run = out => ortSerial(async () => { // reads the current `small` picture
        const d = sctx.getImageData(0, 0, MW, MH).data;
        for (let i = 0; i < px; i++) { // RGBA bytes -> planar float RGB
          input[i] = d[i * 4] / 255; input[px + i] = d[i * 4 + 1] / 255; input[2 * px + i] = d[i * 4 + 2] / 255;
        }
        const res = await sess.run({
          src: new ort.Tensor('float32', input, [1, 3, MH, MW]),
          r1i: rec[0], r2i: rec[1], r3i: rec[2], r4i: rec[3], downsample_ratio: ratio,
        });
        out.set(await res.pha.getData());
        if (gpu) rec.forEach(t => t.dispose?.());
        rec = states.map(k => res[k]);
        res.pha.dispose?.();
      });
      run.release = () => ortSerial(() => sess.release());
      return run;
    }

    for (const used of cpu ? ['wasm'] : ['webgpu', 'wasm']) {
      try {
        const probe = await build(used);
        await probe(f32()); // some ops only fail on the first real run
        probe.release();
        const segment = await build(used); // fresh state after the test run
        return { segment, status: `RVM · ${used === 'webgpu' ? 'GPU' : 'CPU'}`, release: segment.release };
      } catch (e) { log(`RVM failed on ${used}:`, e.message); }
    }
    throw Error('onnxruntime failed to start');
  }

  async function load(cpu, segModel) {
    const { ImageSegmenter, HandLandmarker, FaceDetector } = await import(url('lib/vision_bundle.mjs'));
    const fileset = { wasmLoaderPath: '', wasmBinaryPath: url('lib/wasm/vision_wasm_internal.wasm') };
    const hands = await create(HandLandmarker, fileset, {
      baseOptions: { modelAssetPath: url('models/hand_landmarker.task') },
      runningMode: 'VIDEO', numHands: 2,
      // Defaults (0.5) lose a fast or blurry hand; lower keeps it tracked.
      minHandDetectionConfidence: 0.3, minHandPresenceConfidence: 0.3, minTrackingConfidence: 0.3,
    }, cpu);
    // Small face model: tells where your chin is, so "at the chest" works at any camera height.
    const faces = await create(FaceDetector, fileset, {
      baseOptions: { modelAssetPath: url('models/face_detector.tflite') }, runningMode: 'VIDEO',
    }, cpu);
    let cut;
    try {
      if (segModel === 'simple') throw Error('simple model selected');
      cut = await loadRVM(cpu);
    } catch (err) { // ponytail: fallback keeps working but with the rough little model
      log('RVM not used:', err.message);
      const seg = await create(ImageSegmenter, fileset, {
        baseOptions: { modelAssetPath: url('models/selfie_segmenter_landscape.tflite') },
        runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false,
      }, cpu);
      cut = {
        segment: async out => seg.segmentForVideo(small, performance.now(), r => out.set(r.confidenceMasks[0].getAsFloat32Array())),
        status: 'simple · ' + seg.delegate, release: () => seg.close(),
      };
    }
    const status = `${cut.status} · hands ${hands.delegate} · face ${faces.delegate}`;
    log('models ready:', status);
    return { ...cut, hands, faces, status, close() { hands.close(); faces.close(); cut.release(); } };
  }

  // One job at a time: the models (RVM especially) can't run two frames at once. A job that
  // arrives while one is running is dropped; the page just sends the next frame later.
  let running = false;
  async function job(msg) {
    const { cam, frame } = msg;
    if (running || !models) { frame.close(); return post({ type: 'result', cam, skipped: true }); }
    running = true;
    const m = models;
    m.busy = (m.busy || 0) + 1;
    try {
      await runJob(m, msg);
    } finally {
      running = false;
      if (--m.busy === 0 && m.retired) m.close(); // replaced while this job was using it
    }
  }

  async function runJob(m, { cam, now, frame }) {
    try {
      sctx.drawImage(frame, 0, 0, MW, MH);
      hictx.drawImage(frame, 0, 0, HW, HH);
    } finally { frame.close(); }

    const t0 = performance.now();
    const hands = m.hands.detectForVideo(handIn, now);
    const t1 = performance.now();
    const fb = m.faces.detectForVideo(handIn, now).detections[0]?.boundingBox;
    const t2 = performance.now();
    await m.segment(mask);
    const t3 = performance.now();

    grow(mask, hideG, GROW);
    grow(mask, learnG, GROW_LEARN);
    const hide = new Uint8ClampedArray(px * 4).fill(255); // white; alpha says how much to hide
    const learn = new Uint8ClampedArray(px * 4);
    for (let i = 0, j = 3; i < px; i++, j += 4) {
      // Hide where you are now OR were a moment ago: covers the mask lagging behind fast moves.
      hide[j] = 255 * Math.min(1, Math.max(hideG[i], prevHide[i]) / PERSON);
      // Learn only where you weren't in this mask AND the previous one.
      learn[j] = Math.max(learnG[i], prevLearn[i]) < LEARN ? 255 : 0;
    }
    prevHide.set(hideG);
    prevLearn.set(learnG);

    post({
      type: 'result', cam, now, hide, learn,
      hands: { landmarks: hands.landmarks, worldLandmarks: hands.worldLandmarks },
      face: fb ? { x: fb.originX / HW, y: fb.originY / HH, w: fb.width / HW, h: fb.height / HH } : null,
      perf: { seg: t3 - t2, hands: t1 - t0, face: t2 - t1 },
    }, [hide.buffer, learn.buffer]);
  }

  return async function handle(msg) {
    try {
      if (msg.cmd === 'job') return await job(msg);
      if (msg.cmd !== 'load') return;
      // New device / cutout model: load a new set; the old one keeps serving jobs until it's ready.
      base = msg.base;
      MF ??= self.ModuleFactory;
      const k = `${msg.device}|${msg.segModel}`;
      key = k;
      post({ type: 'status', status: 'loading models…' });
      const m = await load(msg.device === 'cpu', msg.segModel);
      if (key !== k) return m.close(); // settings changed again meanwhile
      const old = models;
      models = m;
      post({ type: 'status', status: m.status, ready: true });
      if (old) { old.retired = true; if (!old.busy) old.close(); } // else the job using it closes it
    } catch (e) {
      if (msg.cmd === 'job') post({ type: 'result', cam: msg.cam, error: e.message });
      else post({ type: 'error', message: e.message });
    }
  };
};

// In a worker: wire the engine to messages. (As a content script this file only defines the engine.)
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  // MediaPipe prints harmless GL notes as warnings.
  const warn = console.warn;
  console.warn = (...a) => { if (!/gl_context|OpenGL error checking/.test(String(a[0]))) warn(...a); };
  // Pages with Trusted Types (Meet) make worker script URLs go through a policy.
  const tt = self.trustedTypes?.createPolicy('vanish-cam-ml', { createScriptURL: s => s });
  const handle = self.makeMlEngine((m, transfer) => postMessage(m, transfer));
  let loader = false;
  onmessage = e => {
    if (!loader && e.data.base) { // MediaPipe's wasm loader (in the page it is a content script instead)
      const u = e.data.base + 'lib/wasm/vision_wasm_internal.js';
      importScripts(tt ? tt.createScriptURL(u) : u);
      loader = true;
    }
    handle(e.data);
  };
}
