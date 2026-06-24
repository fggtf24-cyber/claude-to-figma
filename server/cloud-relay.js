#!/usr/bin/env node
// Облачный relay: маршрутизирует задания из Claude в плагин нужного пользователя
// по «комнате» (pairing-код). WSS (плагины) + StreamableHTTP MCP (Claude) на одном порту.
//
// Плагин:  wss://<хост>/plugin?room=<КОД>
// Claude:  https://<хост>/<КОД>/mcp   (Custom Connector)
//
// Переиспользует tools.js (import_html / import_url / figma_status); отличие от
// локального моста — всё ключуется по комнате, а не по одному глобальному Set.

import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { buildMcpServer } from "./tools.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

const rooms = new Map();   // код -> Set<ws>
const pending = new Map(); // reqId -> { resolve }

function roomSet(code) {
  if (!rooms.has(code)) rooms.set(code, new Set());
  return rooms.get(code);
}
function livePlugins(code) {
  const s = rooms.get(code);
  return s ? [...s].filter((w) => w.readyState === 1) : [];
}
function sendToRoom(code, payload, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const live = livePlugins(code);
    if (live.length === 0) {
      reject(new Error("Плагин не подключён к этой комнате. Открой плагин «Claude → Figma» и сверь код пары."));
      return;
    }
    const id = randomUUID();
    payload.id = id;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Таймаут: плагин не ответил."));
    }, timeoutMs);
    pending.set(id, { resolve: (m) => { clearTimeout(timer); resolve(m); } });
    for (const w of live) w.send(JSON.stringify(payload));
  });
}

/* --------------------------------- HTTP / MCP --------------------------------- */
const app = express();
app.use(express.json({ limit: "25mb" }));
app.get("/health", (_req, res) => res.send("ok"));

const transports = {}; // sessionId -> transport

app.post("/:code/mcp", async (req, res) => {
  const code = req.params.code;
  const sid = req.headers["mcp-session-id"];
  let transport;
  if (sid && transports[sid]) {
    transport = transports[sid];
  } else if (!sid && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { transports[id] = transport; },
    });
    transport.onclose = () => { if (transport.sessionId) delete transports[transport.sessionId]; };
    const server = buildMcpServer({
      sendToPlugin: (payload) => sendToRoom(code, payload),
      livePlugins: () => livePlugins(code),
      wsPort: "cloud",
    });
    await server.connect(transport);
  } else {
    res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Нет валидной сессии" }, id: null });
    return;
  }
  await transport.handleRequest(req, res, req.body);
});

const sessionRequest = async (req, res) => {
  const sid = req.headers["mcp-session-id"];
  if (!sid || !transports[sid]) { res.status(400).send("Invalid or missing session ID"); return; }
  await transports[sid].handleRequest(req, res);
};
app.get("/:code/mcp", sessionRequest);
app.delete("/:code/mcp", sessionRequest);

/* ------------------------------ WebSocket (плагины) ------------------------------ */
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  let url;
  try { url = new URL(req.url, "http://x"); } catch (e) { socket.destroy(); return; }
  if (url.pathname !== "/plugin") { socket.destroy(); return; }
  const code = url.searchParams.get("room");
  if (!code) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    roomSet(code).add(ws);
    ws.on("message", (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch (e) { return; }
      if (msg.type === "result" && pending.has(msg.id)) pending.get(msg.id).resolve(msg);
    });
    ws.on("close", () => {
      const s = rooms.get(code);
      if (s) { s.delete(ws); if (!s.size) rooms.delete(code); }
    });
    ws.on("error", () => {});
  });
});

httpServer.listen(PORT, () => console.error(`[cloud-relay] слушает :${PORT} (WSS /plugin?room=… , MCP /<код>/mcp)`));
