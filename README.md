# Vanish Cam

Chrome (MV3) extension for web video calls (tested on Google Meet). It cuts you out of your camera
picture, keeps the live background, and makes you vanish on a gesture, with an optional sound effect.

- Gestures: ✌️ at the chest (meme), Naruto-style seals, finger snap (one or two hands), or just a button / `Alt+Shift+H`.
- Cutout: Robust Video Matting (ONNX, WebGPU, falls back to CPU) or a faster MediaPipe segmenter.
- Hands and face: MediaPipe HandLandmarker / FaceDetector. Everything runs locally in the browser.
- Toolbar popup with simple defaults and an advanced screen (delays, thresholds, GPU/CPU).

## Install and use

You need Chrome (Edge and Brave work too). The extension is not in the Chrome Web Store yet, so you install it by hand. It runs only on your computer and sends nothing anywhere.

### 1. Download and unpack

1. Download `vanish-cam.zip` from the **Releases** page of this repository.
2. Unpack it: right-click, **Extract All…** (Windows) or double-click (Mac).
3. Put the `vanish-cam` folder somewhere permanent, for example Documents. **Don't delete or move it afterwards**: Chrome runs the extension straight from that folder.

### 2. Open the extensions page and turn on Developer mode

1. Type `chrome://extensions` in the address bar and press Enter.
2. Switch on **Developer mode** in the top right corner (mark 1).

![Developer mode](docs/img/step2-devmode.png)

### 3. Load the folder

1. Click **Load unpacked** at the top left (mark 1).
2. Pick the `vanish-cam` folder (the one that contains `manifest.json`) and click **Select Folder**.

![Load unpacked](docs/img/step3-load.png)

### 4. Done

A **Vanish Cam** card appears (mark 1). Make sure its switch is on (mark 2). To keep the icon handy, click the puzzle icon right of the address bar and pin Vanish Cam.

![Extension installed](docs/img/step4-done.png)

### 5. Use it

1. Open a call (Google Meet, Zoom in the browser, etc.) and **turn your camera on**. If the call tab was already open, reload it first (F5).
2. Click the Vanish Cam icon. The popup looks like this:

   ![Popup](docs/img/popup.png)

3. Pick a gesture (default: the meme, ✌️ flicked at your chest). Do it and you vanish; do it again and you reappear.
4. No gesture handy? Press the **Vanish** button or `Alt+Shift+H`.
5. If something behind you changed and artifacts remain, press **Remember background** and step out of the frame for 5 seconds.

### Troubleshooting

| What you see | What to do |
|---|---|
| The popup says the camera isn't on for this tab | Reload the call tab and turn the camera on |
| Video is slow | Open the gear in the popup, set the compute option to GPU and the cutout model to the simple one |
| Artifacts around you | Step out of the frame for 5 seconds and press "Remember background" |
| Chrome warns about "developer mode extensions" at startup | Close the warning; the extension stays. It is normal for manual installs |
| The extension disappeared | The `vanish-cam` folder was deleted or moved: repeat steps 2–3 |

### Updating

Download the new zip, replace the files in the `vanish-cam` folder, press ↻ on the Vanish Cam card at `chrome://extensions` and reload the call tab.

## Sounds

The extension ships no sounds. In the popup open the gear, "My sounds", add audio files (mp3 or wav, up to 3 MB each),
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
