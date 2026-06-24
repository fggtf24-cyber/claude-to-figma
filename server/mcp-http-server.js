#!/usr/bin/env node
// MCP-сервер (HTTP / StreamableHTTP) для claude.ai в браузере.
// Запускается локально, наружу выставляется туннелем (cloudflared / ngrok),
// и добавляется в claude.ai как Custom Connector. Мост к плагину — локальный.
//
// Эндпоинт: http://localhost:<MCP_PORT><BASE>/mcp
//   где BASE = "/<AUTH_TOKEN>", если задан AUTH_TOKEN (рекомендуется для туннеля).
//
// Переменные окружения:
//   MCP_PORT     — порт HTTP-сервера (по умолчанию 3056)
//   PORT         — порт WebSocket-моста к плагину (по умолчанию 3055)
//   AUTH_TOKEN   — секрет в URL-пути; без него эндпоинт открыт (только для локали)

import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { startBridge } from "./bridge.js";
import { buildMcpServer } from "./tools.js";

const WS_PORT = process.env.PORT ? Number(process.env.PORT) : 3055;
const HTTP_PORT = process.env.MCP_PORT ? Number(process.env.MCP_PORT) : 3056;
const TOKEN = process.env.AUTH_TOKEN || "";
const BASE = TOKEN ? "/" + TOKEN : "";

const { sendToPlugin, livePlugins } = startBridge(WS_PORT);

const app = express();
app.use(express.json({ limit: "25mb" })); // артефакты Claude бывают объёмными

const transports = {}; // sessionId -> transport

app.post(`${BASE}/mcp`, async (req, res) => {
  const sid = req.headers["mcp-session-id"];
  let transport;
  if (sid && transports[sid]) {
    transport = transports[sid];
  } else if (!sid && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { transports[id] = transport; },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };
    const server = buildMcpServer({ sendToPlugin, livePlugins, wsPort: WS_PORT });
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: нет валидной сессии" },
      id: null,
    });
    return;
  }
  await transport.handleRequest(req, res, req.body);
});

// SSE-поток и завершение сессии используют существующий transport по sessionId
const sessionRequest = async (req, res) => {
  const sid = req.headers["mcp-session-id"];
  if (!sid || !transports[sid]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sid].handleRequest(req, res);
};
app.get(`${BASE}/mcp`, sessionRequest);
app.delete(`${BASE}/mcp`, sessionRequest);

app.listen(HTTP_PORT, () => {
  console.error(`[claude-to-figma] MCP (HTTP) на http://localhost:${HTTP_PORT}${BASE}/mcp`);
  console.error(`[claude-to-figma] WebSocket-мост: ws://localhost:${WS_PORT}`);
  if (!TOKEN) {
    console.error("ВНИМАНИЕ: AUTH_TOKEN не задан — эндпоинт открыт. Перед запуском туннеля задай AUTH_TOKEN.");
  }
});
