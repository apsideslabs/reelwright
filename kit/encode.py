#!/usr/bin/env python3
"""
encode.py — frames + audio -> H.264 mp4, tuned for low-memory machines.

Defaults are chosen for a 2 GB / 2-core box: single-threaded x264, small
lookahead. On a normal machine pass --fast to use more threads.

    python kit/encode.py --frames build/x/frames --audio build/x/mix.wav \
                         --fps 24 --out build/x/film.mp4

ffmpeg resolution order: --ffmpeg, $FFMPEG, `imageio-ffmpeg`, `ffmpeg` on PATH.
"""
from __future__ import annotations

import argparse
import glob
import os
import shutil
import subprocess
import sys


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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps", type=float, default=24)
    ap.add_argument("--crf", type=int, default=19)
    ap.add_argument("--ffmpeg")
    ap.add_argument("--fast", action="store_true", help="use all cores (more RAM)")
    args = ap.parse_args()

    frames = sorted(glob.glob(os.path.join(args.frames, "*.jpg")))
    if not frames:
        raise SystemExit(f"no frames in {args.frames}")
    first = os.path.basename(frames[0])
    pattern = os.path.join(args.frames, first.replace("0", "%0", 1) if False else "f%05d.jpg")
    ff = find_ffmpeg(args.ffmpeg)
    if not ff:
        raise SystemExit("ffmpeg not found — pip install imageio-ffmpeg")

    cmd = [ff, "-y", "-framerate", str(args.fps), "-i", pattern, "-i", args.audio,
           "-vf", "scale=in_range=full:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(args.crf),
           "-pix_fmt", "yuv420p", "-movflags", "+faststart",
           "-c:a", "aac", "-b:a", "160k", "-shortest", args.out]
    if not args.fast:
        cmd[1:1] = ["-threads", "1"]
        cmd += ["-x264-params", "rc-lookahead=8:ref=2:bframes=2:threads=1"]

    print(f"  encoding {len(frames)} frames -> {args.out}")
    subprocess.run(cmd, check=True)
    size = os.path.getsize(args.out) / 1e6
    print(f"  {args.out}  {size:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
