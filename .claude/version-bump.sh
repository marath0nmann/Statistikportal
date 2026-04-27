#!/bin/bash
# Versionsnummer erhöhen und auf main committen (ohne ZIP-Build)
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"

CUR_VER=$(grep -o 'v[0-9]\+' "$REPO/htdocs/index.html" | grep -m1 'v[0-9]' | tr -d 'v')
NEW_VER=$((CUR_VER + 1))
DATUM=$(date '+%B %Y')

# index.html
sed -i "s/v${CUR_VER}/v${NEW_VER}/g" "$REPO/htdocs/index.html"
sed -i "s/?v=[0-9][0-9]*/?v=${NEW_VER}/g" "$REPO/htdocs/index.html"

# README.md
sed -i "s/## Version v[0-9]*/## Version v${NEW_VER}/" "$REPO/README.md"
sed -i "s/| Stand: [^|]*/| Stand: ${DATUM} /" "$REPO/README.md"

# CHANGELOG.md: ## vCUR-Platzhalter oder ## vXXX (aktuelle Nummer) → neue Nummer
sed -i "s/^## vCUR\b/## v${NEW_VER}/" "$REPO/CHANGELOG.md"
sed -i "s/^## v${CUR_VER}\b/## v${NEW_VER}/" "$REPO/CHANGELOG.md"

# COMMIT_EDITMSG: erste - Zeile aus CHANGELOG als Nachricht
CHANGELOG_MSG=$(grep -m1 '^- ' "$REPO/CHANGELOG.md" | sed 's/^- //')
if [ -n "$CHANGELOG_MSG" ]; then
  echo "v${NEW_VER} – ${CHANGELOG_MSG}" > "$REPO/COMMIT_EDITMSG"
else
  echo "v${NEW_VER}" > "$REPO/COMMIT_EDITMSG"
fi

cd "$REPO"
git add htdocs/index.html README.md COMMIT_EDITMSG CHANGELOG.md
git commit -m "$(cat "$REPO/COMMIT_EDITMSG")"
git push origin main
