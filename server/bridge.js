// bridge.js — общий WebSocket-мост между MCP-сервером и плагином Figma.
// Плагин подключается клиентом, MCP-серверы (stdio или HTTP) шлют ему задания.

import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

export function startBridge(port) {
  const wss = new WebSocketServer({ port });
  const plugins = new Set();   // подключённые сокеты плагина
  const pending = new Map();   // id запроса -> resolve

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch (e) { return; }
      if (msg.role === "plugin") plugins.add(ws);
      if (msg.type === "result" && pending.has(msg.id)) pending.get(msg.id).resolve(msg);
    });
    ws.on("close", () => plugins.delete(ws));
    ws.on("error", () => plugins.delete(ws));
  });
  wss.on("error", (e) => console.error("[bridge] ошибка:", e.message));

  const livePlugins = () => [...plugins].filter((w) => w.readyState === 1 /* OPEN */);

  function sendToPlugin(payload, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const live = livePlugins();
      if (live.length === 0) {
        reject(new Error("Плагин Figma не подключён. Открой файл в Figma и запусти плагин «Claude → Figma»."));
        return;
      }
      const id = randomUUID();
      payload.id = id;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Таймаут: плагин не ответил за " + timeoutMs / 1000 + " c."));
      }, timeoutMs);
      pending.set(id, { resolve: (m) => { clearTimeout(timer); resolve(m); } });
      for (const w of live) w.send(JSON.stringify(payload));
    });
  }

  return { sendToPlugin, livePlugins };
}
