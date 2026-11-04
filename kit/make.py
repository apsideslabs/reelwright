#!/usr/bin/env python3
"""
make.py — the one command. Give it words, get a video.

    python kit/make.py "Three sentences. That is all you need. Try it."
    python kit/make.py my-script.txt
    python kit/make.py my-script.txt --lang hi --style toon --out promo.mp4

It writes a film for you — script split into lines, voice picked for the
language, captions on, sensible defaults everywhere — then builds it.

Everything it decides can be overridden. If you outgrow it, the film it writes
is a normal film.json you can edit by hand; see docs/film-format.md.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, "kit")

# language -> a good default Piper voice
VOICES = {
    "en": "en_US-lessac-medium",
    "hi": "hi_IN-pratham-medium",
    "es": "es_ES-davefx-medium",
    "fr": "fr_FR-siwis-medium",
    "de": "de_DE-thorsten-medium",
    "it": "it_IT-riccardo-x_low",
    "pt": "pt_BR-faber-medium",
    "ru": "ru_RU-dmitri-medium",
    "ar": "ar_JO-kareem-medium",
    "zh": "zh_CN-huayan-medium",
    "nl": "nl_NL-mls-medium",
    "pl": "pl_PL-darkman-medium",
    "tr": "tr_TR-dfki-medium",
    "vi": "vi_VN-vais1000-medium",
}

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
CJK = re.compile(r"[\u4e00-\u9fff]")


def guess_language(text: str) -> str:
    if DEVANAGARI.search(text):
        return "hi"
    if CJK.search(text):
        return "zh"
    return "en"


def split_script(text: str, max_len: int = 150) -> list[str]:
    """Paragraphs first; a long paragraph is split on sentences."""
    out: list[str] = []
    for para in [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]:
        para = " ".join(para.split())
        # always split on sentences: one caption per sentence reads far better
        buf = ""
        for sent in re.split(r"(?<=[.!?।])\s+", para):
            if not sent:
                continue
            # merge only very short sentences, so captions never flash for 0.4 s
            if buf and len(buf) + len(sent) + 1 <= 60:
                buf = f"{buf} {sent}".strip()
            elif len(buf) + len(sent) + 1 <= max_len and not buf:
                buf = f"{buf} {sent}".strip()
            else:
                if buf:
                    out.append(buf)
                buf = sent
        if buf:
            out.append(buf)
    return out or ["(nothing to say)"]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s[:40] or "my-video")


def default_music():
    return {"bed_gain": 0.40, "cues": [
        {"at": "l1", "inst": "pad", "note": "C3", "dur": 8, "gain": 0.9},
        {"at": "l1", "inst": "pluck", "every": 1.1, "count": 8,
         "notes": ["C4", "E4", "G4", "C5", "G4", "E4", "D4", "C4"]},
    ]}


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Write words, get a vertical video.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='example:  python kit/make.py "Your script here." --lang en --style toon')
    ap.add_argument("script", help="a .txt file, or the script itself in quotes")
    ap.add_argument("--out", help="output file (default <name>.mp4)")
    ap.add_argument("--name", help="short name for the project")
    ap.add_argument("--lang", help="en, hi, es, fr, de, it, pt, ru, ar, zh, nl, pl, tr, vi")
    ap.add_argument("--voice", help="any Piper voice id, overrides --lang")
    ap.add_argument("--style", default="toon", choices=["toon", "real"])
    ap.add_argument("--size", default="1080x1920", help="e.g. 720x1280 for a faster render")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--title", help="title card text (default: first line)")
    ap.add_argument("--no-captions", action="store_true", help="burn no subtitles")
    ap.add_argument("--steps", help="comma-separated checklist items, e.g. 'Problem,Agitate,Solution'")
    ap.add_argument("--dry-run", action="store_true", help="write the film but do not render")
    args = ap.parse_args()

    # ---- read the script ----
    if os.path.exists(args.script):
        text = open(args.script, encoding="utf-8").read()
        base = os.path.splitext(os.path.basename(args.script))[0]
    else:
        text = args.script
        base = None

    lines = split_script(text)
    lang = args.lang or guess_language(text)
    voice = args.voice or VOICES.get(lang, VOICES["en"])
    name = args.name or base or slugify(lines[0])
    w, h = (int(x) for x in args.size.lower().split("x"))

    # ---- assemble a film ----
    ids = [f"l{i + 1}" for i in range(len(lines))]
    beats = {f"s{i}": ids[min(i - 2, len(ids) - 1)] for i in range(2, 15)}

    # a title card needs a few words, not a paragraph
    def short_title(text: str) -> str:
        t = re.split(r"(?<=[.!?।])\s", text)[0].strip()
        if len(t) > 46:
            t = t[:43].rsplit(" ", 1)[0] + "…"
        return t

    graphics = {}
    if args.title or lines:
        graphics["title"] = {"heading": args.title or short_title(lines[0]), "accent": "#e8b64c"}
    if args.steps:
        palette = ["#e0574a", "#e08a3c", "#e0c23c", "#5ab86a", "#4a9be0", "#9a6ae0"]
        graphics["steps"] = [
            {"n": str(i + 1), "label": s.strip(), "color": palette[i % len(palette)]}
            for i, s in enumerate(args.steps.split(",")) if s.strip()
        ]

    film = {
        "slug": name,
        "title": args.title or lines[0][:60],
        "fps": args.fps,
        "size": [w, h],
        "style": args.style,
        "safeArea": "all",
        "grade": {"exposure": 1.28, "lift": [35, 19, 20], "vignette": 0.42},
        "captions": not args.no_captions,
        "voice": {"model": voice, "length_scale": 1.06, "pitch": 0.97, "gain": 0.85},
        "lead": 1.2, "gap": 0.42, "tail": 1.0,
        "lines": [{"id": i, "text": t} for i, t in zip(ids, lines)],
        "beats": beats,
        "graphics": graphics,
        "music": default_music(),
        "audio": {"target_lufs": -14.0, "ceiling_dbtp": -1.5, "duck_db": -3.5},
    }

    film_dir = os.path.join(ROOT, "films", name)
    os.makedirs(film_dir, exist_ok=True)
    film_path = os.path.join(film_dir, "film.json")
    json.dump(film, open(film_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    scene = os.path.join(film_dir, "scene.js")
    if not os.path.exists(scene):
        shutil.copy2(os.path.join(ROOT, "templates", "scene.js"), scene)

    print(f"script   {len(lines)} line(s), {sum(len(l.split()) for l in lines)} words")
    print(f"voice    {voice}   ({lang})")
    print(f"look     {args.style}   {w}x{h} @ {args.fps}fps")
    print(f"film     {os.path.relpath(film_path, ROOT)}")

    if args.dry_run:
        print("\ndry run — edit that file, then:  python kit/build.py --film", os.path.relpath(film_path, ROOT))
        return 0

    # ---- build it (fresh: the script may have changed since last time) ----
    shutil.rmtree(os.path.join(ROOT, "build", name), ignore_errors=True)
    cmd = [sys.executable, os.path.join(KIT, "build.py"), "--film", film_path]
    rc = subprocess.run(cmd, cwd=ROOT).returncode
    if rc != 0:
        print("\nbuild failed — the log above says why. Common causes:")
        print("  · dependencies:  pip install -r requirements.txt && npm install")
        print("  · Chromium missing: install it, or set CHROME=/path/to/chromium")
        return rc

    built = os.path.join(ROOT, "build", name, f"{name}.mp4")
    if os.path.exists(built):
        dest = args.out or os.path.join(ROOT, f"{name}.mp4")
        shutil.copy2(built, dest)
        size_mb = os.path.getsize(dest) / 1e6
        print(f"\nDone.  {dest}  ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
