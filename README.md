# Vanish Cam

Chrome (MV3) extension for web video calls (tested on Google Meet). It cuts you out of your camera
picture, keeps the live background, and makes you vanish on a gesture, with an optional sound effect.

- Gestures: ✌️ at the chest (meme), Naruto-style seals, finger snap (one or two hands), or just a button / `Alt+Shift+H`.
- Cutout: Robust Video Matting (ONNX, WebGPU, falls back to CPU) or a faster MediaPipe segmenter.
- Hands and face: MediaPipe HandLandmarker / FaceDetector. Everything runs locally in the browser.
- Toolbar popup with simple defaults and an advanced screen (delays, thresholds, GPU/CPU).

## Установка и использование
Нужен браузер Chrome (подойдут также Edge и Brave). Расширение пока не в магазине Chrome, поэтому ставится вручную. Это безопасно: оно работает только на твоём компьютере и ничего никуда не отправляет.

### 1. Скачай и распакуй

1. Скачай файл `vanish-cam.zip` (на GitHub: раздел **Releases**, файл `vanish-cam.zip`).
2. Нажми на него правой кнопкой мыши и выбери **«Извлечь всё…»** (Windows) или просто дважды кликни по нему (Mac).
3. Положи получившуюся папку `vanish-cam` туда, где она не потеряется, например в «Документы». **Потом её нельзя удалять или переносить**: Chrome запускает расширение прямо из этой папки.

### 2. Открой страницу расширений и включи режим разработчика

1. В адресной строке Chrome введи `chrome://extensions` и нажми Enter.
2. В правом верхнем углу включи переключатель **«Режим разработчика»** (на рисунке под номером 1).

![Режим разработчика](docs/img/step2-devmode.png)

### 3. Загрузи папку

1. Слева вверху появится кнопка **«Загрузить распакованное расширение»** (номер 1). Нажми её.
2. В окне выбора выбери папку `vanish-cam` (ту, внутри которой лежит файл `manifest.json`) и нажми **«Выбор папки»**.

![Загрузить распакованное](docs/img/step3-load.png)

### 4. Готово

В списке появится карточка **Vanish Cam** (номер 1) с включённым переключателем (номер 2). Если переключатель выключен, включи его.

![Расширение установлено](docs/img/step4-done.png)

Чтобы значок всегда был под рукой, нажми на иконку пазла справа от адресной строки и закрепи Vanish Cam (кнопка с булавкой).

### 5. Как пользоваться

1. Открой звонок (Google Meet, Zoom в браузере и т. п.) и **включи камеру**. Если вкладка со звонком уже была открыта, сначала **перезагрузи её** (F5).
2. Нажми на значок Vanish Cam. Окно выглядит так:

   ![Окно расширения](docs/img/popup.png)

3. Выбери жест (по умолчанию «Мем: ✌️ у груди»): резко поднеси два пальца к груди, и ты исчезнешь. Ещё раз покажешь жест, и появишься.
4. Нет жеста под рукой? Нажми кнопку **«Исчезнуть»** или комбинацию **Alt+Shift+H**.
5. Если за спиной что-то изменилось и остались артефакты, нажми **«Запомнить фон»** и отойди от камеры на 5 секунд.

### Если что-то не работает

| Что происходит | Что делать |
|---|---|
| В окне написано «Камера на этой вкладке не включена» | Перезагрузи вкладку со звонком и включи камеру |
| Видео тормозит | Нажми шестерёнку, в «Вычисления» выбери «Видеокарта», а в «Модель вырезания» — «Простая» |
| Вокруг тебя артефакты | Отойди от камеры на 5 секунд и нажми «Запомнить фон» |
| При запуске Chrome пишет «Отключить расширения в режиме разработчика» | Закрой окно (крестик или «Отмена»), расширение останется. Это обычное предупреждение для ручной установки |
| Расширение пропало | Папку `vanish-cam` удалили или перенесли: повтори шаги 2–3 |

### Как обновить

Скачай новый zip, замени содержимое папки `vanish-cam` новыми файлами, затем на `chrome://extensions` нажми ↻ на карточке Vanish Cam и перезагрузи вкладку со звонком.

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
