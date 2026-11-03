#!/usr/bin/env python3
"""
selftest.py — prove the whole pipeline works, end to end, in about two minutes.

Builds a throwaway three-line film at low resolution through every stage:
voice -> music -> mix -> site -> render -> encode -> qa, then checks the
artefacts and the QA verdict. This is the test CI should run, and the first
thing to run after changing anything in kit/.

    python kit/selftest.py            # full run
    python kit/selftest.py --keep     # leave build/selftest for inspection

Exit code 0 on pass, 1 on fail.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, "kit")
BUILD = os.path.join(ROOT, "build", "selftest")
FILM_DIR = os.path.join(BUILD, "film")

FILM = {
    "slug": "selftest",
    "title": "Selftest",
    "fps": 24,
    "size": [270, 480],
    "style": "toon",
    "safeArea": "all",
    "voice": {"model": "en_US-lessac-medium", "length_scale": 1.0, "pitch": 0.98, "gain": 0.85},
    "lead": 0.4, "gap": 0.25, "tail": 0.4,
    "lines": [
        {"id": "l1", "text": "This is a test."},
        {"id": "l2", "text": "The pipeline is running."},
        {"id": "l3", "text": "And it finished."}
    ],
    "beats": {k: "l3" for k in ["s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14"]},
    "grade": {"exposure": 1.28, "lift": [35, 19, 20], "vignette": 0.42},
    "graphics": {
        "title": {"heading": "SELFTEST", "sub": "end to end", "accent": "#e8b64c"},
        "steps": [
            {"n": "1", "label": "ONE", "color": "#e0574a"},
            {"n": "2", "label": "TWO", "color": "#e08a3c"},
            {"n": "3", "label": "THREE", "color": "#e0c23c"},
            {"n": "4", "label": "FOUR", "color": "#5ab86a"},
            {"n": "5", "label": "FIVE", "color": "#4a9be0"},
            {"n": "6", "label": "SIX", "color": "#9a6ae0"}
        ],
        "end": {"line1": "PIPELINE", "line2": "OK", "accent": "#e8b64c"}
    },
    "fx": [{"at": "l2", "offset": 0.4, "kind": "sparkle", "count": 8, "dur": 0.6}],
    "music": {"bed_gain": 0.4, "cues": [
        {"at": "l1", "inst": "pad", "note": "C3", "dur": 4},
        {"at": "l1", "inst": "pluck", "every": 0.5, "count": 4, "notes": ["C4", "E4", "G4", "C5"]}
    ]},
    "audio": {"target_lufs": -14.0, "ceiling_dbtp": -1.5, "duck_db": -3.5}
}

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    CHECKS.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{('  — ' + detail) if detail and not ok else ''}")


def run(cmd: list[str], timeout: int = 900) -> int:
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    if p.returncode != 0:
        print("    stdout:", (p.stdout or "")[-1200:])
        print("    stderr:", (p.stderr or "")[-1200:])
    return p.returncode


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--voice-model", default="en_US-lessac-medium")
    args = ap.parse_args()

    FILM["voice"]["model"] = args.voice_model
    shutil.rmtree(BUILD, ignore_errors=True)
    os.makedirs(FILM_DIR, exist_ok=True)

    film_path = os.path.join(FILM_DIR, "film.json")
    json.dump(FILM, open(film_path, "w"), indent=1)

    # a film needs a scene; reuse the worked example's, which is what new-film.sh does
    scene_src = os.path.join(ROOT, "films", "kuch-bhi-kaise-bechein", "scene.js")
    shutil.copy2(scene_src, os.path.join(FILM_DIR, "scene.js"))

    print("1/3  building (voice, music, mix, site, render, encode, qa)")
    rc = run([sys.executable, os.path.join(KIT, "build.py"), "--film", film_path,
              "--build", BUILD, "--query", "w=270&h=480", "--qa-ignore", "pops"])
    check("build.py exits 0", rc == 0)

    print("2/3  checking artefacts")
    for rel, label in [("narration.wav", "narration"), ("timings.json", "timings"),
                       ("music.wav", "score stem"), ("mix.wav", "mix"),
                       ("mix-report.md", "mix report"), ("site/timeline.js", "generated timeline"),
                       ("selftest.mp4", "encoded video")]:
        p = os.path.join(BUILD, rel)
        check(f"{label} exists", os.path.exists(p) and os.path.getsize(p) > 100,
              p)

    timings_path = os.path.join(BUILD, "timings.json")
    if os.path.exists(timings_path):
        t = json.load(open(timings_path))
        check("timeline covers every line", len(t.get("lines", {})) == len(FILM["lines"]),
              str(list(t.get("lines", {}))[:3]))
        check("duration is sane (2–30 s)", 2 <= t.get("total", 0) <= 30, f"{t.get('total')}s")

    frames_dir = os.path.join(BUILD, "frames")
    n_frames = len([f for f in os.listdir(frames_dir)]) if os.path.isdir(frames_dir) else 0
    check("frames rendered", n_frames > 20, f"{n_frames} frames")

    print("3/3  checking the QA verdict")
    qa_path = os.path.join(BUILD, "qa", "qa-report.md")
    check("qa report written", os.path.exists(qa_path))
    if os.path.exists(qa_path):
        report = open(qa_path).read()
        check("qa passed", "**PASS**" in report,
              "; ".join(l for l in report.splitlines() if l.startswith("- "))[:200])
        check("loudness was measured", "LUFS" in report)

    failed = [c for c in CHECKS if not c[1]]
    print(f"\n{'PASS' if not failed else 'FAIL'}  {len(CHECKS) - len(failed)}/{len(CHECKS)} checks")
    if not args.keep and not failed:
        shutil.rmtree(BUILD, ignore_errors=True)
    elif failed:
        print(f"  left {BUILD} for inspection")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
