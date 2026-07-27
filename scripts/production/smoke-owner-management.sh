#!/usr/bin/env bash
set -euo pipefail

# Read-only authentication/authorization smoke test. Supply credentials through
# the shell environment; never place them in a committed file.
: "${APP_URL:?APP_URL is required}" "${SMOKE_ADMIN_EMAIL:?SMOKE_ADMIN_EMAIL is required}" "${SMOKE_ADMIN_PASSWORD:?SMOKE_ADMIN_PASSWORD is required}" "${SMOKE_PARTNER_EMAIL:?SMOKE_PARTNER_EMAIL is required}" "${SMOKE_PARTNER_PASSWORD:?SMOKE_PARTNER_PASSWORD is required}"
tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT

curl --fail --silent --show-error -c "$tmpdir/admin.cookie" -H 'content-type: application/json' -d "{\"email\":\"$SMOKE_ADMIN_EMAIL\",\"password\":\"$SMOKE_ADMIN_PASSWORD\"}" "$APP_URL/api/auth/login" >/dev/null
curl --fail --silent --show-error -b "$tmpdir/admin.cookie" "$APP_URL/dashboard" >/dev/null

curl --fail --silent --show-error -c "$tmpdir/partner.cookie" -H 'content-type: application/json' -d "{\"email\":\"$SMOKE_PARTNER_EMAIL\",\"password\":\"$SMOKE_PARTNER_PASSWORD\"}" "$APP_URL/api/auth/login" >/dev/null
curl --fail --silent --show-error -b "$tmpdir/partner.cookie" "$APP_URL/partner" >/dev/null
status="$(curl --silent --output /dev/null --write-out '%{http_code}' -b "$tmpdir/partner.cookie" "$APP_URL/dashboard")"
[[ "$status" == "302" || "$status" == "307" || "$status" == "403" ]] || { echo "Partner dashboard guard failed: HTTP $status" >&2; exit 1; }
echo "Owner-management authorization smoke checks passed"
