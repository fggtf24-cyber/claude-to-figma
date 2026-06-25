#!/usr/bin/env bash
# Установка облачного relay на свежий Ubuntu/Debian VPS (запуск под root).
# Ставит Node 20, код из репозитория, systemd-сервис и Caddy с авто-HTTPS.
#
# Запуск:
#   export DOMAIN=relay.example.com      # домен, направленный A-записью на IP этого сервера
#   curl -fsSL https://raw.githubusercontent.com/fggtf24-cyber/claude-to-figma/main/deploy/setup-vps.sh | bash
# либо: DOMAIN=relay.example.com bash setup-vps.sh

set -euo pipefail

: "${DOMAIN:?Укажи домен: export DOMAIN=relay.example.com (A-запись должна указывать на IP сервера)}"
REPO="https://github.com/fggtf24-cyber/claude-to-figma"
DIR="/opt/claude-to-figma"

echo "==> Node.js 20 + git"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

echo "==> Код relay"
mkdir -p /opt
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
cd "$DIR/server"
npm ci --omit=dev

echo "==> systemd-сервис"
cat >/etc/systemd/system/c2f-relay.service <<EOF
[Unit]
Description=claude-to-figma cloud relay
After=network.target

[Service]
WorkingDirectory=$DIR/server
ExecStart=/usr/bin/node cloud-relay.js
Environment=PORT=8080
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now c2f-relay

echo "==> Caddy (авто-HTTPS обратный прокси)"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

cat >/etc/caddy/Caddyfile <<EOF
$DOMAIN {
    reverse_proxy localhost:8080
}
EOF
systemctl restart caddy

echo ""
echo "================ ГОТОВО ================"
echo "Проверка:   https://$DOMAIN/health   (должно вернуть ok)"
echo "Коннектор:  https://$DOMAIN/<КОД>/mcp"
echo "Плагин WS:  wss://$DOMAIN/plugin?room=<КОД>"
echo "Статус:     systemctl status c2f-relay  |  journalctl -u c2f-relay -f"
echo "Обновить:   cd $DIR && git pull && cd server && npm ci --omit=dev && systemctl restart c2f-relay"
