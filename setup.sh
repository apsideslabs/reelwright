#!/usr/bin/env bash
# One-time setup. Checks what you have, installs what you don't.
set -u
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/3  Python packages"
python3 -m pip install --quiet --upgrade pip 2>/dev/null || true
python3 -m pip install --quiet -r requirements.txt && echo "     ok" || { echo "     failed — try: pip install --user -r requirements.txt"; exit 1; }

say "2/3  Node packages"
if command -v npm >/dev/null 2>&1; then
  npm install --silent && echo "     ok"
else
  echo "     npm not found. Install Node 18+ from https://nodejs.org and re-run."; exit 1
fi

say "3/3  Chromium"
if [ -n "${CHROME:-}" ] && [ -x "${CHROME}" ]; then echo "     using CHROME=$CHROME"
elif command -v chromium >/dev/null 2>&1; then echo "     chromium found"
elif command -v chromium-browser >/dev/null 2>&1; then echo "     chromium-browser found"
elif command -v google-chrome >/dev/null 2>&1; then echo "     google-chrome found"
else
  echo "     No Chromium found."
  echo "     Debian/Ubuntu:  sudo apt install chromium"
  echo "     macOS:          brew install --cask chromium"
  echo "     or download from https://www.chromium.org/getting-involved/download-chromium/"
  echo "     Then set CHROME=/path/to/chromium if it is not on PATH."
fi

say "Ready."
cat <<'TXT'
  python kit/make.py "Your first line. Your second line. That's it."
  make test        # optional: proves the whole pipeline works (~2 min)
TXT
