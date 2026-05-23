#!/bin/bash
# =============================================================
# deploy/setup.sh — One-time server setup for arasgroup.app
# Run as root on the VPS: bash setup.sh
# =============================================================
set -e

APP_DIR="/var/www/arasgroup.app"
REPO="https://github.com/MrCCcrew/arasgroup.git"
DOMAIN="arasgroup.app"
NODE_VERSION="20"

echo "======================================================"
echo "  Arasgroup — Server Setup"
echo "======================================================"

# ── 1. System packages ──────────────────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get install -y git curl wget nginx certbot python3-certbot-nginx ufw mysql-client

# ── 2. Node.js via nvm ──────────────────────────────────────
echo "[2/8] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v)   npm: $(npm -v)"

# ── 3. PM2 ──────────────────────────────────────────────────
echo "[3/8] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── 4. App directory ────────────────────────────────────────
echo "[4/8] Creating app directory..."
mkdir -p "$APP_DIR"
mkdir -p /var/log/pm2

# ── 5. Clone / pull repo ────────────────────────────────────
echo "[5/8] Cloning repository..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repo already exists — pulling latest..."
  cd "$APP_DIR" && git pull origin main
else
  git clone "$REPO" "$APP_DIR"
fi

# ── 6. Nginx config ─────────────────────────────────────────
echo "[6/8] Setting up Nginx..."
cp "$APP_DIR/deploy/nginx.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t && systemctl reload nginx
echo "  ✓ Nginx configured"

# ── 7. Firewall ─────────────────────────────────────────────
echo "[7/8] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "  ✓ UFW configured"

# ── 8. SSL (Let's Encrypt) ──────────────────────────────────
echo "[8/8] Issuing SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
  --email admin@arasgroup.app --redirect || echo "  ⚠ Certbot failed — run manually"

echo ""
echo "======================================================"
echo "  Setup complete!"
echo "  Next step: copy .env to $APP_DIR/.env"
echo "  Then run:  bash $APP_DIR/deploy/deploy.sh"
echo "======================================================"
