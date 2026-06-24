// tools.js — определения MCP-инструментов (import_html / import_url / figma_status).
// Используется и stdio-сервером (Claude Desktop), и HTTP-сервером (claude.ai).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function buildMcpServer({ sendToPlugin, livePlugins, wsPort }) {
  const server = new McpServer({ name: "claude-to-figma", version: "1.0.0" });

  server.tool(
    "import_html",
    "Импортировать HTML-разметку (например, сгенерированную Claude) в открытый файл Figma как редактируемые слои — фреймы, текст, картинки. Требуется запущенный в Figma плагин «Claude → Figma». Лучше всего работает на самодостаточном HTML со встроенными стилями (<style> или inline style); артефакты Claude (sc-if/sc-for/{{ }}) тоже поддерживаются.",
    {
      html: z.string().describe("Полный HTML-документ или фрагмент со встроенными стилями."),
      name: z.string().optional().describe("Имя корневого фрейма в Figma."),
      width: z.number().optional().describe("Ширина вьюпорта для рендера в px (по умолчанию 1440)."),
    },
    async ({ html, name, width }) => {
      const res = await sendToPlugin({
        type: "import-html",
        html,
        name: name || "Claude Design",
        width: width || 1440,
      });
      if (!res.ok) throw new Error(res.error || "Не удалось отрисовать дизайн.");
      return {
        content: [{
          type: "text",
          text: `Готово. В Figma создан фрейм «${name || "Claude Design"}» (${res.nodeCount || "?"} слоёв) и выделен.`,
        }],
      };
    }
  );

  server.tool(
    "import_url",
    "Загрузить страницу по URL и импортировать её в открытый файл Figma как редактируемые слои. Требуется запущенный плагин «Claude → Figma».",
    {
      url: z.string().url().describe("Адрес страницы для импорта."),
      name: z.string().optional().describe("Имя корневого фрейма в Figma."),
      width: z.number().optional().describe("Ширина вьюпорта для рендера в px (по умолчанию 1440)."),
    },
    async ({ url, name, width }) => {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 claude-to-figma" } });
      if (!r.ok) throw new Error("Не удалось загрузить URL: HTTP " + r.status);
      let html = await r.text();
      const base = `<base href="${url}">`;
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + base) : base + html;
      const res = await sendToPlugin({ type: "import-html", html, name: name || url, width: width || 1440 });
      if (!res.ok) throw new Error(res.error || "Не удалось отрисовать дизайн.");
      return {
        content: [{ type: "text", text: `Импортировано из ${url} (${res.nodeCount || "?"} слоёв).` }],
      };
    }
  );

  server.tool(
    "figma_status",
    "Проверить, подключён ли к мосту плагин Figma.",
    {},
    async () => {
      const n = livePlugins().length;
      return {
        content: [{
          type: "text",
          text: n > 0
            ? `Плагин подключён (соединений: ${n}). Мост: ws://localhost:${wsPort}.`
            : `Плагин не подключён. Открой файл в Figma и запусти плагин «Claude → Figma» (мост: ws://localhost:${wsPort}).`,
        }],
      };
    }
  );

  return server;
}
