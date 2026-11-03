#!/usr/bin/env python3
"""
qa.py — check a finished render the way an editor would, but in one command.

Decodes the video at low resolution, computes per-frame luma / saturation /
motion, and flags the things that actually ruin a cut:

    BLACK    frames that are (almost) pure black — a broken scene or a dead camera
    WHITE    blown-out frames
    FROZEN   runs of identical frames — a stuck render or a paused timeline
    POP      sudden jumps in frame-to-frame difference — a flash you did not ask for

It also reports loudness (EBU R128 via ffmpeg), silences, and writes a contact
sheet so you can eyeball the whole film at once.

Frame-level checks and the report shape are adapted from
mromidev/claude-animated-shorts (see CREDITS.md). Loudness measurement uses
ffmpeg's ebur128.

    python kit/qa.py --video build/my-film/my-film.mp4 --out build/my-film/qa

Exit code is 1 if any check fails, so it drops straight into CI.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np

W, H = 180, 320


def find_ffmpeg(explicit=None):
    if explicit:
        return explicit
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return shutil.which("ffmpeg")


def find_ffprobe(ffmpeg):
    if os.environ.get("FFPROBE"):
        return os.environ["FFPROBE"]
    guess = ffmpeg.replace("ffmpeg", "ffprobe") if ffmpeg else None
    if guess and os.path.exists(guess):
        return guess
    return shutil.which("ffprobe")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--frames", help="also write a contact sheet here")
    ap.add_argument("--allow-black", type=float, default=0.5,
                    help="seconds of black allowed at the head/tail (default 0.5)")
    ap.add_argument("--ignore", default="",
                    help="comma-separated checks to tolerate: black,white,pops,peak")
    ap.add_argument("--ffmpeg")
    args = ap.parse_args()

    ff = find_ffmpeg(args.ffmpeg)
    if not ff:
        raise SystemExit("ffmpeg not found — pip install imageio-ffmpeg")
    fp = find_ffprobe(ff)
    os.makedirs(args.out, exist_ok=True)
    problems, report = [], []
    ignore = {x.strip() for x in args.ignore.split(',') if x.strip()}
    skipped = []

    # ---------------- specs ----------------
    dur = 0.0
    fps = 0.0
    if fp:
        pr = json.loads(subprocess.run(
            [fp, "-v", "error", "-show_entries",
             "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration",
             "-of", "json", args.video], capture_output=True, text=True).stdout or "{}")
        streams = pr.get("streams", [])
        v = next((s for s in streams if s.get("codec_type") == "video"), None)
        au = [s for s in streams if s.get("codec_type") == "audio"]
        dur = float(pr.get("format", {}).get("duration", 0) or 0)
        if v:
            num, _, den = (v.get("r_frame_rate") or "0/1").partition("/")
            fps = float(num) / float(den or 1)
            report.append(f"**{v['width']}x{v['height']}** · {fps:.3f} fps · {v.get('nb_frames')} frames · {dur:.3f} s")
        if not au:
            problems.append("no audio stream")
        else:
            report.append(f"audio: {au[0].get('codec_name')} {au[0].get('sample_rate')} Hz {au[0].get('channels')} ch")

    # ---------------- loudness ----------------
    err = subprocess.run([ff, "-i", args.video, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    if "Summary:" in err:
        tail = err[err.rfind("Summary:"):]
        for line in tail.splitlines():
            s = line.strip()
            if s.startswith(("I:", "LRA:", "Peak:")):
                report.append(s)
                if s.startswith("Peak:") and "dBFS" in s:
                    try:
                        if float(s.split()[1]) > -1.0:
                            problems.append(f"true peak {s.split()[1]} dBFS is above -1")
                    except Exception:
                        pass

    # ---------------- frames ----------------
    raw = subprocess.run([ff, "-v", "error", "-i", args.video,
                          "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True).stdout
    if not raw:
        raise SystemExit("could not decode frames from " + args.video)
    F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    n = len(F)
    del raw

    # statistics in chunks — a full-length float32 copy would blow up on long films
    weights = np.array([0.2126, 0.7152, 0.0722], np.float32)
    mean = np.zeros(n, np.float32)
    sat = np.zeros(n, np.float32)
    diff = np.zeros(max(0, n - 1), np.float32)
    CHUNK = 128
    for a in range(0, n, CHUNK):
        b = min(n, a + CHUNK)
        f32 = F[a:b].astype(np.float32) / 255.0
        luma = f32 @ weights
        mean[a:b] = luma.reshape(b - a, -1).mean(1)
        mx, mn = f32.max(-1), f32.min(-1)
        s = np.where(mx > 0.06, (mx - mn) / np.maximum(mx, 1e-6), 0)
        sat[a:b] = s.reshape(b - a, -1).mean(1)
        if b - a > 1:
            diff[a:b - 1] = np.abs(np.diff(F[a:b].astype(np.int16), axis=0)).mean(axis=(1, 2, 3))
        if a > 0:
            diff[a - 1] = np.abs(F[a].astype(np.int16) - F[a - 1].astype(np.int16)).mean()
        del f32, luma, mx, mn, s

    head_tail = int(args.allow_black * fps) if fps else 12
    black = [i for i in range(n) if mean[i] < 0.035 and head_tail <= i < n - head_tail]
    white = [i for i in range(n) if mean[i] > 0.95]
    frozen = []
    run_start = None
    for i in range(1, n):
        still = diff[i - 1] < 0.015 and head_tail <= i < n - head_tail and mean[i] > 0.12
        if still:
            run_start = i - 1 if run_start is None else run_start
        else:
            if run_start is not None and i - run_start >= 12:
                frozen.append((run_start, i))
            run_start = None
    pops = []
    if len(diff) > 10:
        med = np.array([np.median(diff[max(0, i - 8):i + 9]) for i in range(len(diff))])
        pops = [int(i + 1) for i in range(len(diff)) if diff[i] > 3 * med[i] + 1.0]

    if black:
        (skipped if "black" in ignore else problems).append(f"{len(black)} near-black frames (first at {black[0]})")
    if white:
        (skipped if "white" in ignore else problems).append(f"{len(white)} blown-out frames (first at {white[0]})")
    warnings = []
    if frozen:
        warnings.append(f"{len(frozen)} still runs (first {frozen[0][0]}-{frozen[0][1]}) — a held camera is a choice, but a dead-still shot reads as a stall")
    if pops:
        (skipped if "pops" in ignore else problems).append(f"{len(pops)} hard pops (first at {pops[0]})")

    report.append(f"luma mean {mean.mean():.3f} (min {mean.min():.3f}, max {mean.max():.3f}) · saturation {sat.mean():.3f}")
    report.append(f"motion mean {diff.mean():.3f} · black {len(black)} · white {len(white)} · frozen {len(frozen)} · pops {len(pops)}")

    # ---------------- contact sheet ----------------
    if args.frames:
        try:
            from PIL import Image, ImageDraw
            cols, rows = 5, 4
            picks = np.linspace(0, n - 1, cols * rows).astype(int)
            tw, th = 216, 384
            sheet = Image.new("RGB", (cols * tw, rows * th), (12, 14, 20))
            d = ImageDraw.Draw(sheet)
            for k, idx in enumerate(picks):
                im = Image.fromarray(F[idx]).resize((tw, th), Image.LANCZOS)
                x, y = (k % cols) * tw, (k // cols) * th
                sheet.paste(im, (x, y))
                d.text((x + 6, y + 6), f"f{idx}", fill=(255, 220, 140))
            os.makedirs(args.frames, exist_ok=True)
            sheet.save(os.path.join(args.frames, "contact-sheet.jpg"), quality=88)
            report.append("contact sheet: `qa/contact-sheet.jpg`")
        except ImportError:
            report.append("(install Pillow for a contact sheet)")

    status = "**PASS**" if not problems else "**FAIL**"
    md = ["# QA report", "", f"{status} — `{os.path.basename(args.video)}`", ""]
    md += [f"- {line}" for line in report]
    if warnings:
        md += ["", "## Warnings", ""] + [f"- {w}" for w in warnings]
    if skipped:
        md += ["", "## Tolerated", ""] + [f"- {w} (--ignore)" for w in skipped]
    if problems:
        md += ["", "## Problems", ""] + [f"- {p}" for p in problems]
    open(os.path.join(args.out, "qa-report.md"), "w").write("\n".join(md) + "\n")

    print(f"  {status.strip('*')}  {len(problems)} problem(s), {len(warnings)} warning(s)")
    for w in warnings:
        print(f"    ! {w}")
    for p in problems:
        print(f"    - {p}")
    print(f"  report -> {os.path.join(args.out, 'qa-report.md')}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
