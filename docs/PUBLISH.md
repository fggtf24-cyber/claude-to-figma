# Публикация в Figma Community

Готовый набор для публикации плагина. Иконка/обложка — в `docs/icon.svg` и
`docs/cover.svg` (Figma требует **PNG**: открой SVG в браузере или Figma и
экспортируй — иконка 128×128, обложка 1920×960).

## Чек-лист
- [ ] Иконка 128×128 PNG (из `docs/icon.svg`)
- [ ] Обложка 1920×960 PNG (из `docs/cover.svg`)
- [ ] Имя, tagline, описание (ниже)
- [ ] Теги и категория
- [ ] Ссылка на политику приватности (raw `docs/PRIVACY.md` или GitHub Pages)
- [ ] Проверить прогон без ошибок
- [ ] (если нужна Claude-часть) указать домен relay в `networkAccess`

## Как опубликовать
1. В Figma: правый клик по плагину в **Plugins → Development → Publish**.
2. Заполнить форму (тексты ниже), загрузить иконку и обложку.
3. Выбрать охват: **Public** (Community, с ревью Figma) или **Only me** (без ревью).
4. Отправить. Публичный проходит ревью несколько дней.

---

## Тексты для формы

**Name:** Claude → Figma — HTML to editable layers

**Tagline (короткое):**
Импортируй HTML и дизайны из Claude в Figma как редактируемые слои.

**Tagline (EN):**
Turn HTML and Claude designs into editable Figma layers.

**Описание (RU):**
> Вставь HTML — получи нативные слои Figma: фреймы, текст, шейпы и вектора-иконки.
> Геометрия берётся из реального layout браузера, поэтому раскладка пиксель-в-пиксель.
> Поддерживаются артефакты Claude (sc-if / sc-for / шаблоны), flex-вёрстка,
> скругления, обводки, изображения и SVG-иконки.
>
> Режимы:
> • Ручной — вставь HTML и нажми «Импортировать» (работает сразу, без настройки).
> • Claude (опционально) — подключи свой аккаунт Claude по MCP и проси
>   «импортируй этот дизайн в Figma» прямо из чата.

**Description (EN):**
> Paste HTML and get native Figma layers — frames, text, shapes and vector icons.
> Geometry comes from the real browser layout, so it's pixel-accurate. Supports
> Claude design artifacts, flexbox, radii, strokes, images and inline SVG icons.
>
> Modes:
> • Manual — paste HTML, click Import (works instantly, no setup).
> • Claude (optional) — connect your Claude account over MCP and ask it to import
>   designs straight from chat.

**Теги:** html, html to figma, import, code to design, claude, ai, layers, svg, design

**Категория:** Design tools (или Productivity)

**Privacy policy URL:**
https://github.com/fggtf24-cyber/claude-to-figma/blob/main/docs/PRIVACY.md

**Support / контакт:**
https://github.com/fggtf24-cyber/claude-to-figma/issues

---

## Важно про режимы при публикации
- **Ручной режим** самодостаточен — у всех работает без сервера. Это безопасный
  публичный минимум.
- **Claude-режим** требует, чтобы у пользователя был **always-on relay** и
  **Claude Pro/Max** + добавленный коннектор. В описании подаём как опцию
  «для продвинутых» либо (если поднимешь общий платный relay) как сервис.
- Перед публичным релизом с Claude-частью в `manifest.json` заменить
  `allowedDomains: ["*"]` на конкретный домен relay (+ домены картинок, если нужны).
