#!/usr/bin/env python3
"""
doctor.py — what will work on this machine, before you spend an hour finding out.

    python kit/doctor.py

Checks the OS and architecture, the runtimes, Chromium, the graphics backend,
ffmpeg, the voice models and the film files. Prints a report and exits non-zero
if something essential is missing.
"""
from __future__ import annotations

import glob
import json
import os
import platform
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OK, WARN, BAD = "ok  ", "warn", "FAIL"
rows: list[tuple[str, str, str]] = []


def add(state: str, what: str, detail: str = "") -> None:
    rows.append((state, what, detail))


def have(cmd: str) -> str | None:
    return shutil.which(cmd)


def main() -> int:
    add(OK, "os", f"{platform.system()} {platform.release()} · {platform.machine()}")
    add(OK, "python", platform.python_version())

    node = have("node")
    if node:
        v = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
        major = int(v.lstrip("v").split(".")[0]) if v.lstrip("v")[:1].isdigit() else 0
        add(OK if major >= 18 else BAD, "node", f"{v} (need 18+)")
    else:
        add(BAD, "node", "not found — install Node 18+")

    chrome = os.environ.get("CHROME") or have("chromium") or have("chromium-browser") or have("google-chrome")
    add(OK if chrome else BAD, "chromium", chrome or "not found — needed to render")

    # graphics
    gpu = os.path.isdir("/dev/dri")
    if platform.system() == "Darwin":
        add(OK, "gpu", "macOS — Metal via ANGLE, hardware expected")
    elif platform.system() == "Windows":
        add(OK, "gpu", "Windows — D3D11 via ANGLE, hardware expected")
    else:
        add(OK if gpu else WARN, "gpu", "/dev/dri present" if gpu else "no /dev/dri — software rendering, 20-50x slower")
    mesa = bool(glob.glob("/usr/lib/*/libGL.so*") or glob.glob("/usr/lib/libGL.so*"))
    add(OK if mesa else WARN, "mesa", "libGL found (llvmpipe possible)" if mesa else "no libGL — SwiftShader only")
    disp = os.environ.get("DISPLAY")
    add(OK if disp else WARN, "display", f"DISPLAY={disp}" if disp else "headless: Mesa/ANGLE-gl may not initialise")

    try:
        import imageio_ffmpeg
        add(OK, "ffmpeg", imageio_ffmpeg.get_ffmpeg_exe())
    except Exception:
        add(BAD if not have("ffmpeg") else OK, "ffmpeg", have("ffmpeg") or "pip install imageio-ffmpeg")

    for mod in ("numpy", "piper", "PIL"):
        try:
            __import__(mod)
            add(OK, f"python:{mod}", "installed")
        except Exception:
            add(WARN if mod == "PIL" else BAD, f"python:{mod}", "missing — pip install -r requirements.txt")

    voices = glob.glob(os.path.join(ROOT, "voices", "*.onnx"))
    add(OK if voices else WARN, "voices", f"{len(voices)} model(s) in voices/ (downloaded on first use)")

    films = glob.glob(os.path.join(ROOT, "films", "*", "film.json"))
    bad = []
    for f in films:
        try:
            json.load(open(f, encoding="utf-8"))
        except Exception as e:
            bad.append(f"{os.path.relpath(f, ROOT)}: {e}")
    add(OK if not bad else BAD, "films", f"{len(films)} film(s) parse" if not bad else "; ".join(bad))

    width = max(len(r[1]) for r in rows) + 2
    print()
    for state, what, detail in rows:
        print(f"  [{state}] {what.ljust(width)} {detail}")
    failures = [r for r in rows if r[0] == BAD]
    warns = [r for r in rows if r[0] == WARN]
    print(f"\n  {len(rows) - len(failures) - len(warns)} ok · {len(warns)} warning(s) · {len(failures)} failure(s)")
    if failures:
        print("  fix the failures above, then re-run:  python kit/doctor.py")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
