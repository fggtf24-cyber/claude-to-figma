#!/usr/bin/env node
// MCP-сервер (stdio) для Claude Desktop / Claude Code.
// Поднимает WebSocket-мост к плагину и общается с Claude по stdio.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startBridge } from "./bridge.js";
import { buildMcpServer } from "./tools.js";

const WS_PORT = process.env.PORT ? Number(process.env.PORT) : 3055;

const { sendToPlugin, livePlugins } = startBridge(WS_PORT);
const server = buildMcpServer({ sendToPlugin, livePlugins, wsPort: WS_PORT });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[claude-to-figma] MCP (stdio) запущен. WebSocket-мост: ws://localhost:${WS_PORT}`);
