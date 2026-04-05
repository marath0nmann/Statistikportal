#!/bin/bash
# commit.sh – Schnell-Commit für Statistikportal
# Verwendung: ./commit.sh
# Die Commit-Message ist in COMMIT_EDITMSG vorausgefüllt (von Claude).

set -e

# Repo-Verzeichnis (hier liegt commit.sh)
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Neuestes Paket aus Downloads ins Repo kopieren ──────────────────────────
DOWNLOADS_DIR="$HOME/Downloads"

# Höchste Versionsnummer finden – matcht paket_vXXX und paket_vXXX.zip
LATEST=$(ls -d "$DOWNLOADS_DIR"/paket_v* 2>/dev/null | sort -V | tail -1)

if [[ -z "$LATEST" ]]; then
  echo "⚠️  Kein paket_vXXX oder paket_vXXX.zip in $DOWNLOADS_DIR gefunden."
  exit 1
fi

# Falls sort die ZIP-Datei gewählt hat: Verzeichnis ableiten und ggf. entpacken
if [[ "$LATEST" == *.zip ]]; then
  VER=$(basename "$LATEST" .zip)
  PAKET_DIR="$DOWNLOADS_DIR/$VER"
  if [[ ! -d "$PAKET_DIR" ]]; then
    echo ""
    echo "📦 Entpacke $(basename "$LATEST") …"
    unzip -q -o "$LATEST" -d "$DOWNLOADS_DIR"
    echo "   ✓ Entpackt nach $PAKET_DIR"
  fi
  LATEST_PAKET="$PAKET_DIR"
else
  LATEST_PAKET="$LATEST"
fi

echo ""
echo "📦 Neuestes Paket: $(basename "$LATEST_PAKET")"
echo "   Kopiere nach: $REPO_DIR"
cp -rf "$LATEST_PAKET"/. "$REPO_DIR/"
echo "   ✓ Dateien übertragen"

# ── Ins Repo-Verzeichnis wechseln ───────────────────────────────────────────
cd "$REPO_DIR"

# COMMIT_EDITMSG ins .git-Verzeichnis kopieren
cp COMMIT_EDITMSG .git/COMMIT_EDITMSG

# Status anzeigen
echo ""
echo "📋 Geänderte Dateien:"
git status --short
echo ""

# Commit-Message aus COMMIT_EDITMSG lesen (erste nicht-leere Zeile)
MSG=$(grep -v '^#' .git/COMMIT_EDITMSG | sed '/^$/d' | head -1)
echo "💬 Commit-Message: $MSG"
echo ""

git add -A
git commit -F .git/COMMIT_EDITMSG
echo ""
echo "✅ Committed: $MSG"
echo ""
git push
