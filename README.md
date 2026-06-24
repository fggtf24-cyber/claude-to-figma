# Claude → Figma

Плагин для Figma + MCP-сервер, которые переносят дизайн из Claude прямо в Figma
как **редактируемые слои** (фреймы, текст, картинки) — по принципу `html.to.design`.

Claude генерирует HTML → вызывает MCP-инструмент → HTML летит в открытый плагин →
плагin рендерит его в изолированном iframe, читает геометрию и стили и строит
нативные слои Figma.

```
Claude ──MCP(stdio)──▶ mcp-server.js ──WebSocket(:3055)──▶ плагин Figma ──▶ слои
```

## Структура

```
plugin/         ← плагин Figma (импортируется в Figma)
  manifest.json
  code.js       ← песочница Figma: строит слои из дерева узлов
  ui.html       ← iframe: WebSocket-клиент + конвертер HTML→дерево
server/         ← MCP-сервер + WebSocket-мост (Node.js)
  mcp-server.js
  package.json
example.html    ← тестовая разметка для ручной проверки
```

## Установка

### 1. Плагин в Figma
1. Figma → меню **Plugins → Development → Import plugin from manifest…**
2. Выбери `plugin/manifest.json`.
3. Запусти плагин: **Plugins → Development → Claude → Figma**.
   Зелёная точка = мост найден, красная = сервер не запущен (это нормально до шага 2).

### 2. MCP-сервер (нужен Node.js 18+)
На этой машине Node.js **не установлен** — поставь с https://nodejs.org (LTS), затем:

```powershell
cd "C:\Users\fggtf\OneDrive\Документы\07 plugin figma\server"
npm install
npm start          # запустит мост ws://localhost:3055 (для ручной проверки)
```

### 3. Подключить сервер к Claude
Для **Claude Code** добавь в `.mcp.json` проекта (или в `~/.claude.json`):

```json
{
  "mcpServers": {
    "claude-to-figma": {
      "command": "node",
      "args": ["C:\\Users\\fggtf\\OneDrive\\Документы\\07 plugin figma\\server\\mcp-server.js"]
    }
  }
}
```

Для **Claude Desktop** — то же самое в `claude_desktop_config.json`
(Settings → Developer → Edit Config). Claude сам запустит сервер по stdio.

## Использование

1. Открой нужный файл в Figma и запусти плагин (точка должна стать зелёной).
2. В Claude: *«Сгенерируй лендинг и импортируй его в Figma»* или
   *«Импортируй этот HTML в Figma»* (приложив разметку).
3. Claude вызовет `import_html`, и через 1–2 сек в Figma появится выделенный фрейм.

Инструменты MCP:
- `import_html(html, name?, width?)` — импорт готовой разметки;
- `import_url(url, name?, width?)` — импорт страницы по адресу;
- `figma_status()` — проверить, подключён ли плагин.

Без Claude можно проверить вручную: вставь HTML в textarea плагина и нажми
**«Импортировать в Figma»** (или открой `example.html`).

## claude.ai в браузере (remote MCP через туннель)

Браузерный Claude дёргает коннектор **из облака Anthropic**, поэтому `localhost`
ему не виден — нужен публичный HTTPS-адрес до твоего ПК. Схема:

```
claude.ai (облако) ──HTTPS──▶ туннель ──▶ mcp-http-server.js ──WS:3055──▶ плагин Figma
```

Нужен план Claude **Pro / Max / Team / Enterprise** (на бесплатном кастомных
коннекторов нет). Шаги:

1. Запусти HTTP-сервер с секретным токеном в URL (PowerShell):
   ```powershell
   cd "C:\Users\fggtf\OneDrive\Документы\07 plugin figma\server"
   $env:AUTH_TOKEN = "ПРИДУМАЙ-ДЛИННЫЙ-СЕКРЕТ"
   npm run start:http        # MCP на http://localhost:3056/<токен>/mcp, мост ws://localhost:3055
   ```
2. Подними туннель к порту 3056 (любой из):
   ```powershell
   cloudflared tunnel --url http://localhost:3056      # выдаст https://xxxx.trycloudflare.com
   # или:  ngrok http 3056
   ```
3. В claude.ai: **Settings → Connectors → Add custom connector**, вставь
   `https://xxxx.trycloudflare.com/<токен>/mcp`.
4. Открой плагин в Figma (мост локальный, туннель не нужен для него).
5. Проси прямо в claude.ai: *«импортируй этот HTML в Figma через claude-to-figma»*.

> **Не запускай одновременно** stdio-сервер (Claude Desktop) и HTTP-сервер —
> оба занимают мост `ws://localhost:3055`.
>
> **Безопасность:** ты выставляешь локальный сервер в интернет. `AUTH_TOKEN`
> в пути — минимальная защита; на бесплатном `trycloudflare` адрес меняется при
> перезапуске (коннектор придётся пересоздавать). Для постоянного адреса —
> именованный Cloudflare-туннель, по возможности за Cloudflare Access.

## Что поддерживается
- Вёрстка любой сложности (flex/grid/absolute) — позиции берутся из реального
  layout браузера, поэтому пиксель-в-пиксель.
- Фон, рамки, скругления, прозрачность, текст (шрифт/размер/начертание/цвет/
  выравнивание), `<img>` и `background-image`.

## Ограничения (это MVP, не полный клон html.to.design)
- Слои позиционируются абсолютно (без авто-лейаута Figma).
- Текст со смешанным содержимым (текст вперемешку с вложенными тегами) упрощается.
- Шрифты не из набора Figma подменяются на Inter подходящего начертания.
- Картинки с других доменов могут не загрузиться из-за CORS → серый плейсхолдер.
- SVG не растрируется. Скрипты в импортируемом HTML не выполняются (для изоляции).

## Безопасность сети
`manifest.json` использует `allowedDomains: ["*"]` для удобства (мост + любые
картинки). Для продакшена сузь список до `localhost` и нужных доменов изображений.
