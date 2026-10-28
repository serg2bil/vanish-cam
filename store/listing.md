# Chrome Web Store: what to paste where

Dashboard: https://chrome.google.com/webstore/devconsole (one-time $5 developer fee).
Upload `store/vanish-cam-store.zip` (run `python store/build.py`; it leaves out your local `sounds/` folder).

## Store listing

**Name:** Vanish Cam

**Summary (max 132 chars):**
Vanish from your video call with a gesture: turn to dust, glitch or teleport away. Record your own gesture, even a goodbye wave.

**Category:** Fun (or Productivity)  **Language:** English (add the Russian text below as a second language)

**Description:**
Vanish Cam makes you disappear from your webcam video in web calls (Google Meet, Zoom in the browser, Teams, Jitsi and others) with a gesture, like a magic trick.

How it works
- The extension cuts you out of the camera picture and fills the gap with the live background, so you vanish with an effect instead of a frozen frame.
- 8 effects like in a video editor: Thanos disintegrate, flash teleport, RGB glitch, zoom punch, smoke puff, glass shatter, soft dissolve, hard cut with a flash. Each has its own duration and sliders.
- Trigger it with a gesture: a V sign at your chest (the meme), Naruto-style hand seals, a finger snap, your own recorded gesture, a button in the popup, or Alt+Shift+H.
- Record your own gesture in the Studio: hold a pose, or do a motion like a goodbye wave, a swipe or a circle. Motions are remembered relative to your face, so they work at any distance from the camera.
- Built-in sound effects (whoosh, pop, poof, teleport and more) or your own audio files. The sound is mixed into your microphone, so people in the call hear it too, and it lands right on the effect.
- The Studio shows your camera with the hand tracking on top, so you can try everything before the call.
- One switch turns the whole extension off; the toolbar icon then says OFF.

Private by design
- Everything runs locally in your browser. Video, audio and hand positions never leave your computer. No accounts, no servers, no analytics.
- The only thing stored is your settings, your recorded gestures and the sound files you add, in your browser's extension storage.

How to use
1. Install, open your call and turn the camera on (reload the call tab if it was already open).
2. Click the Vanish Cam icon and pick a gesture and an effect, or open the Studio to record your own gesture.
3. Do the gesture. Do it again to appear.

Open source (GPL-3.0).

**Description (Russian):**
Vanish Cam убирает тебя из видео с камеры в веб-звонках (Google Meet, Zoom в браузере, Teams, Jitsi и другие) по жесту, как фокус.
- Расширение вырезает тебя из кадра и подставляет живой фон, поэтому ты исчезаешь с эффектом, а не замираешь.
- 8 эффектов как в видеоредакторе: распад как у Таноса, вспышка-телепорт, RGB-глитч, зум-удар, облако дыма, разбитое стекло, мягкое растворение, резкая склейка со вспышкой. У каждого своя длительность и настройки.
- Запуск: V у груди (мем), печати как в Наруто, щелчок пальцами, свой записанный жест, кнопка в окне расширения или Alt+Shift+H.
- Свой жест записывается в Студии: поза или движение, например помахать «чао», свайп или круг. Движение запоминается относительно лица и работает на любом расстоянии от камеры.
- Встроенные звуки (вжух, поп, пуф, телепорт и другие) или свои файлы. Звук подмешивается в микрофон, его слышат в звонке, и он попадает ровно в эффект.
- Студия показывает камеру с трекингом рук, всё можно попробовать до звонка.
- Один переключатель выключает расширение целиком, на значке тогда горит OFF.
- Всё работает локально в браузере. Видео, звук и положение рук никуда не отправляются. Без аккаунтов и серверов.
- Открытый код (GPL-3.0).

## Graphic assets
- Icon 128x128: `vanish-cam/icons/128.png` (already in the zip).
- Screenshots 1280x800: `store/img/screenshot-1.png` … `screenshot-4.png` (made by `node test/art.mjs <chrome.exe>`; a drawn person, no real camera picture).
- Small promo tile 440x280: `store/img/promo-440x280.png`. Marquee 1400x560: `store/img/marquee-1400x560.png`.

## Privacy tab

**Single purpose:**
Lets the user remove themselves from their own webcam video in web calls with a gesture, with a visual effect and an optional sound effect.

**Permission justifications**
- `storage`: saves the user's settings, recorded gestures and the sound files they add, locally in the browser.
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
