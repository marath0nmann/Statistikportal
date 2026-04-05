#!/bin/bash
# build.sh – Automatischer Build für das Statistikportal
# Liest aktuelle Version aus index.html, erhöht um 1, baut paket_vXXX.zip

set -e
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="/mnt/user-data/outputs"

# ── Version aus index.html lesen und erhöhen ────────────────────────────────
CUR_VER=$(grep -o 'v[0-9]\+' "$REPO_DIR/htdocs/index.html" | grep -m1 'v[0-9]' | tr -d 'v')
NEW_VER=$((CUR_VER + 1))
PKG="paket_v${NEW_VER}"

echo ""
echo "🔢 Version: v${CUR_VER} → v${NEW_VER}"

# ── index.html aktualisieren ────────────────────────────────────────────────
sed -i.bak "s/v${CUR_VER}/v${NEW_VER}/g" "$REPO_DIR/htdocs/index.html"
rm -f "$REPO_DIR/htdocs/index.html.bak"
echo "✓ index.html → v${NEW_VER}"

# ── ZIP bauen ───────────────────────────────────────────────────────────────
TMP="$REPO_DIR/../${PKG}"
rm -rf "$TMP"
cp -r "$REPO_DIR" "$TMP"
rm -f "$OUT_DIR/${PKG}.zip"
cd "$REPO_DIR/.."
zip -r "$OUT_DIR/${PKG}.zip" "${PKG}/" \
  --exclude "${PKG}/.git/*" \
  --exclude "${PKG}/htdocs/js/*.bak" \
  --exclude "__MACOSX/*" \
  -q
rm -rf "$TMP"

echo "✓ $(du -sh "$OUT_DIR/${PKG}.zip" | cut -f1)  →  $OUT_DIR/${PKG}.zip"
echo ""
