@echo off
title Claude to Figma - bridge 3055
cd /d "%~dp0server"
set "PATH=%ProgramFiles%\nodejs;%PATH%"
echo Starting MCP bridge (stdio) for Claude Desktop / manual mode...
echo Keep this window open - the bridge ws://localhost:3055 runs while it is open.
echo.
node mcp-server.js
echo.
echo Server stopped.
pause
