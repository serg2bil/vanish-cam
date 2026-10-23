# Chrome Web Store: what to paste where

Dashboard: https://chrome.google.com/webstore/devconsole (one-time $5 developer fee).
Upload `store/vanish-cam-store.zip` (run `sh store/build.sh`; it leaves out your local `sounds/` folder).

## Store listing

**Name:** Vanish Cam

**Summary (max 132 chars):**
Vanish from your video call with a gesture or a snap. Cuts you out of the camera picture and keeps the live background.

**Category:** Fun (or Productivity)  **Language:** English (add the Russian text below as a second language)

**Description:**
Vanish Cam makes you disappear from your webcam video in web calls (tested on Google Meet) with a gesture, like a magic trick.

How it works
- The extension cuts you out of the camera picture and fills the gap with the live background it learned, so you vanish with a smooth fade instead of a frozen frame.
- Trigger it with a gesture: ✌️ held at your chest (the meme), Naruto-style hand seals (one or two hands), a finger snap (one or two hands), a button in the popup, or Alt+Shift+H.
- Optional sound effects: add your own audio files in the settings. The sound is mixed into your microphone, so people in the call hear it too. You can play it reversed when you appear.
- Simple screen for everyday use (gesture, sounds), advanced screen with sliders for timings and thresholds, GPU or CPU choice, and a fast or high-quality cutout model.

Private by design
- Everything runs locally in your browser. Video, audio and hand positions never leave your computer. No accounts, no servers, no analytics.
- The only thing stored is your settings and the sound files you add, in your browser's extension storage.

How to use
1. Install, open your call and turn the camera on (reload the call tab if it was already open).
2. Click the Vanish Cam icon: press "Remember background" and step out of the frame for a few seconds, or just pick a gesture.
3. Do the gesture. Do it again to appear.

Open source (GPL-3.0). The extension ships no sounds; you add your own.

**Description (Russian):**
Vanish Cam убирает тебя из видео с камеры в веб-звонках (проверено на Google Meet) по жесту, как фокус.
- Расширение вырезает тебя из кадра и подставляет живой фон, поэтому ты плавно растворяешься, а не замираешь.
- Запуск: ✌️ у груди (мем), печати как в Наруто (одной или двумя руками), щелчок пальцами, кнопка в окне расширения или Alt+Shift+H.
- Звуковые эффекты: добавь свои файлы в настройках. Звук подмешивается в твой микрофон, его слышат и в звонке. Можно проиграть задом наперёд при появлении.
- Простой экран для каждого дня и продвинутые настройки: задержки, пороги, видеокарта или процессор, быстрая или качественная модель.
- Всё работает локально в браузере. Видео, звук и положение рук никуда не отправляются. Без аккаунтов и серверов.
- Открытый код (GPL-3.0). Звуков в комплекте нет, добавляешь свои.

## Graphic assets
- Icon 128x128: `vanish-cam/icons/128.png` (already in the zip).
- Screenshots (at least 1, 1280x800 or 640x400): take them of a real call with and without you; `docs/img/popup.png` can be one.
- Small promo tile 440x280: needed for the listing, make from the icon on a purple background.

## Privacy tab

**Single purpose:**
Lets the user remove themselves from their own webcam video in web calls with a gesture, with an optional sound effect.

**Permission justifications**
- `storage`: saves the user's settings and the sound files they add, locally in the browser.
- Host access `<all_urls>` (content scripts): video calls can be on any site (Meet, Zoom web, Teams, Jitsi, self-hosted). The script wraps `getUserMedia` on the page to replace the user's own camera stream with the processed one. It does nothing until the page asks for a camera.
- Remote code: **No**. All scripts, WASM files and ML models are bundled in the package.

**Data usage (Privacy practices form):** collects nothing. Leave every data-type box unchecked.
Then tick all three certifications: no selling data, no use unrelated to the single purpose, no creditworthiness use.

**Privacy policy URL:** `store/privacy-policy.md`, hosted at a public URL (see below).

## Before you submit
- The repo is private, so the policy link must be public: make the repo public and use
  https://github.com/serg2bil/vanish-cam/blob/main/store/privacy-policy.md, or enable GitHub Pages.
- Change `version` in `manifest.json` to `1.0.0` and the manifest `description` to English (store shows it).
- Do not upload the sounds: the memes' audio is not yours to distribute.
- Review takes from a few hours to a few days. Wide host access plus camera hooks can trigger a longer review; the justifications above are for that.
