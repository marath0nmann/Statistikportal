#!/bin/bash
# commit.sh – Schnell-Commit für TuS Oedt Statistik
# Verwendung: ./commit.sh
# Die Commit-Message ist in .git/COMMIT_EDITMSG vorausgefüllt (von Claude).

set -e

# Ins Repo-Verzeichnis wechseln (auch wenn Skript von woanders aufgerufen wird)
cd "$(dirname "$0")"

# Status anzeigen
echo ""
echo "📋 Geänderte Dateien:"
git status --short
echo ""

# Commit-Message aus COMMIT_EDITMSG lesen (erste nicht-leere Zeile)
MSG=$(grep -v '^#' .git/COMMIT_EDITMSG | sed '/^$/d' | head -1)
echo "💬 Commit-Message: $MSG"
echo ""

# Bestätigung
read -p "➡️  Alles committen? [j/N] " confirm
if [[ "$confirm" != "j" && "$confirm" != "J" ]]; then
  echo "Abgebrochen."
  exit 0
fi

git add -A
git commit -F .git/COMMIT_EDITMSG
echo ""
echo "✅ Committed: $MSG"
echo ""
echo "Zum Pushen: git push"
