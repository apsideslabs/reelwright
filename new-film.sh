#!/usr/bin/env bash
# Scaffold a new film from the worked example.
#   ./new-film.sh my-film
set -euo pipefail
slug="${1:-}"
if [ -z "$slug" ]; then echo "usage: ./new-film.sh <slug>"; exit 2; fi
src="films/kuch-bhi-kaise-bechein"
dst="films/$slug"
if [ -e "$dst" ]; then echo "$dst already exists"; exit 1; fi
mkdir -p "$dst"
cp "$src/scene.js" "$dst/scene.js"
python3 - "$src/film.json" "$dst/film.json" "$slug" <<'PY'
import json, sys
src, dst, slug = sys.argv[1:4]
film = json.load(open(src, encoding="utf-8"))
film["slug"] = slug
film["title"] = slug.replace("-", " ").title()
json.dump(film, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"wrote {dst}")
PY
echo "next:"
echo "  1. edit $dst/film.json (lines, beats, graphics, music)"
echo "  2. python kit/build.py --film $dst/film.json"
