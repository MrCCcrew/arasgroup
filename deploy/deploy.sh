#!/bin/bash
# =============================================================
# deploy/deploy.sh — Deploy / update arasgroup.app
# Run on the VPS: bash /var/www/arasgroup.app/deploy/deploy.sh
# =============================================================
set -e

APP_DIR="/var/www/arasgroup.app"
APP_NAME="arasgroup"
BRANCH="main"

echo "======================================================"
echo "  Arasgroup — Deploy  ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "======================================================"

cd "$APP_DIR"

# ── 1. Pull latest code ─────────────────────────────────────
echo "[1/6] Pulling latest code from $BRANCH..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
echo "  ✓ Code updated — $(git log -1 --format='%h %s')"

# ── 2. Install dependencies ─────────────────────────────────
echo "[2/6] Installing dependencies..."
npm ci --omit=dev
echo "  ✓ Dependencies installed"

# ── 3. Generate Prisma client ───────────────────────────────
echo "[3/6] Generating Prisma client..."
npx prisma generate
echo "  ✓ Prisma client generated"

# ── 4. Run DB migrations (safe — no data loss) ──────────────
echo "[4/6] Pushing database schema..."
npx prisma db push --accept-data-loss=false
echo "  ✓ Database schema up to date"

# ── 5. Build Next.js ────────────────────────────────────────
echo "[5/6] Building Next.js application..."
npm run build
echo "  ✓ Build complete"

# ── 6. Restart PM2 ─────────────────────────────────────────
echo "[6/6] Restarting application..."
# Load only the protected GPS-stop password hash for PM2. Other .env settings
# remain private to the server and are not copied into the process environment.
if [ -f ".env" ]; then
  DRIVER_TRACKING_STOP_PASSWORD_HASH_LINE="$(grep '^DRIVER_TRACKING_STOP_PASSWORD_HASH=' .env || true)"
  if [ -n "$DRIVER_TRACKING_STOP_PASSWORD_HASH_LINE" ]; then
    export "$DRIVER_TRACKING_STOP_PASSWORD_HASH_LINE"
  fi
fi
if pm2 list | grep -q "$APP_NAME"; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save
echo "  ✓ Application restarted"

echo ""
echo "======================================================"
echo "  Deploy complete! → https://arasgroup.app"
echo "======================================================"
