# Vanish Cam

Chrome (MV3) extension for web video calls (tested on Google Meet). It cuts you out of your camera
picture, keeps the live background, and makes you vanish on a gesture, with an optional sound effect.

- Gestures: ✌️ at the chest (meme), Naruto-style seals, finger snap (one or two hands), or just a button / `Alt+Shift+H`.
- Cutout: Robust Video Matting (ONNX, WebGPU, falls back to CPU) or a faster MediaPipe segmenter.
- Hands and face: MediaPipe HandLandmarker / FaceDetector. Everything runs locally in the browser.
- Toolbar popup with simple defaults and an advanced screen (delays, thresholds, GPU/CPU).

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" and pick the `vanish-cam/` folder.
3. Reload your call tab and turn the camera on.

## Sounds

The extension ships no sounds. In the popup open the gear, "Свои звуки", pick up to two audio files,
then choose them (or their reversed versions) for vanishing and appearing on the main screen.

## Tests

```
npm i puppeteer-core
node test/gestures.test.mjs
```

`test/popup.mjs`, `test/run.mjs`, `test/perf.mjs` drive a real Chrome with a fake camera (pass the path to `chrome.exe`).

## Licenses

GPL-3.0 (see `LICENSE`), because it bundles the Robust Video Matting model (GPL-3.0).
Also bundled: MediaPipe tasks-vision and models (Apache-2.0), onnxruntime-web (MIT).
