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

**Name:** HTML to Figma

**Description (финальная, согласована с ревьюером Figma — фокус на импорте, Claude ниже):**
> Import HTML/CSS as editable Figma layers, including frames, text, shapes, and
> vector icons. The plugin reads layout from the rendered page so imported results
> stay close to the original structure and appearance. Use it to bring existing
> markup, exported components, or generated HTML into Figma for manual editing.
> Import runs locally in the plugin; network access is only used to load image URLs
> referenced in your HTML.
>
> An optional Claude connection can send HTML from your own Claude setup to your
> open plugin session; this is off by default, requires your own Claude account,
> and uses a relay only to deliver the imported HTML.
>
> No analytics, tracking, or ads.
> Privacy policy: https://github.com/fggtf24-cyber/claude-to-figma/blob/main/docs/PRIVACY.md
> Support: https://github.com/fggtf24-cyber/claude-to-figma/issues
> Source: https://github.com/fggtf24-cyber/claude-to-figma

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
