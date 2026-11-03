#!/usr/bin/env python3
"""
music.py — procedural score and sound effects, mixed under the narration.

No samples, no licensing, no downloads: every sound is synthesised from sine
waves and noise. The score is described declaratively in film.json, so you can
re-cut the music without touching Python:

    "music": {
      "bed_gain": 0.42,
      "cues": [
        {"at": "l1",  "inst": "pad",   "note": "C3", "dur": 9},
        {"at": "l1",  "inst": "pluck", "note": "C4", "every": 1.15, "count": 6},
        {"at": "s5",  "inst": "pop",   "every": 0.68, "count": 6,
                      "notes": ["C4","D4","E4","G4","A4","C5"]},
        {"at": "l13", "inst": "coin",  "offset": 2.5}
      ]
    }

`at` is a line id from the script (or any key in timings.json). `every` repeats
the cue at a fixed interval, `count` times. Instruments: pad, pluck, bell, pop,
whoosh, coin.

Usage
-----
    python kit/music.py --film films/my-film/film.json --build build/my-film
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import wave

import numpy as np

SR = 48000
NOTES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6,
         "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def note_to_freq(name: str) -> float:
    """'C4' -> 261.63, 'F#3' -> 185.0"""
    name = name.strip()
    pitch, octave = name[:-1], int(name[-1])
    semis = NOTES[pitch.upper()] + (octave - 4) * 12
    return 440.0 * (2 ** ((semis - 9) / 12))


# --------------------------------------------------------------------------- #
# instruments — all mono float32, peak roughly <= 1
# --------------------------------------------------------------------------- #
def _env(n, atk=0.005, dec=6.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / atk) * np.exp(-t * dec)


def pad(f, dur, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum((1.0 / h) * np.sin(2 * np.pi * f * h * t + h * 0.6) for h in (1, 2, 3, 4))
    e = np.minimum(1, t / 0.6) * np.minimum(1, np.clip((dur - t) / 1.0, 0, 1))
    return s * e * amp * 0.035


def pluck(f, dur=0.9, amp=1.0, dec=5.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) + 0.15 * np.sin(6 * np.pi * f * t)
    return s * _env(n, 0.004, dec) * amp * 0.14


def bell(f, dur=1.6, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.01 * t) + 0.2 * np.sin(2 * np.pi * f * 3.02 * t)
    return s * _env(n, 0.003, 2.6) * amp * 0.11


def pop(f=480, dur=0.12, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + 2.2 * t) * t) * _env(n, 0.002, 24) * amp * 0.2


def whoosh(dur=0.4, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = np.random.RandomState(4).randn(n)
    y = np.zeros(n)
    acc = 0.0
    for i in range(n):
        acc += 0.08 * (nz[i] - acc)
        y[i] = acc
    return y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2 * amp * 2.0


def coin(amp=1.0):
    out = np.zeros(int(0.8 * SR))
    for k, f in enumerate([1318, 1760, 2637]):
        b = bell(f, 0.6, 1.0)
        i0 = int(k * 0.05 * SR)
        out[i0:i0 + len(b)] += b[: len(out) - i0]
    return out * amp


INSTRUMENTS = {"pad": pad, "pluck": pluck, "bell": bell, "pop": pop, "whoosh": whoosh, "coin": coin}


# --------------------------------------------------------------------------- #
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--film", required=True)
    ap.add_argument("--build", required=True, help="directory holding narration.wav + timings.json")
    args = ap.parse_args()

    film = json.load(open(args.film, encoding="utf-8"))
    timings = json.load(open(os.path.join(args.build, "timings.json")))
    total = timings["total"]
    n_total = int(total * SR)
    left = np.zeros(n_total)
    right = np.zeros(n_total)
    rng = np.random.RandomState(11)

    def add(sig, t0, pan=0.0, gain=1.0):
        i0 = int(t0 * SR)
        if i0 >= n_total:
            return
        if i0 < 0:
            sig, i0 = sig[-i0:], 0
        n = min(len(sig), n_total - i0)
        if n <= 0:
            return
        th = (pan + 1) * math.pi / 4
        left[i0:i0 + n] += sig[:n] * gain * math.cos(th)
        right[i0:i0 + n] += sig[:n] * gain * math.sin(th)

    # room tone so silence never feels digital
    left += rng.randn(n_total) * 0.0025
    right += rng.randn(n_total) * 0.0025

    spec = film.get("music", {})
    for cue in spec.get("cues", []):
        at = cue["at"]
        if at not in timings["lines"] and at not in timings:
            print(f"  ! cue at unknown key {at!r}, skipped")
            continue
        t0 = (timings["lines"][at]["start"] if at in timings["lines"] else timings[at])
        t0 += float(cue.get("offset", 0.0))
        inst = INSTRUMENTS[cue.get("inst", "pluck")]
        every = float(cue.get("every", 0))
        count = int(cue.get("count", 1))
        notes = cue.get("notes") or [cue.get("note", "C4")]
        gain = float(cue.get("gain", 1.0))
        pan = float(cue.get("pan", 0.0))
        dur = float(cue.get("dur", 0.9))
        amp = float(cue.get("amp", 1.0))
        for k in range(count):
            note = notes[k % len(notes)]
            f = note_to_freq(note) if isinstance(note, str) else float(note)
            t = t0 + k * every
            try:
                sig = inst(f, dur, amp) if inst in (pad, pluck, bell) else inst(amp=amp)
            except TypeError:
                sig = inst(amp=amp)
            add(sig, t, pan + 0.06 * k, gain)

    music = np.stack([left, right], axis=1)
    music = music / (np.max(np.abs(music)) + 1e-9) * float(spec.get("bed_gain", 0.42))

    w = wave.open(os.path.join(args.build, "narration.wav"))
    nar = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    w.close()
    nar = np.pad(nar, (0, max(0, n_total - len(nar))))[:n_total]

    mix = music + nar[:, None]
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 1.04
    mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.93
    fi = int(0.05 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(0.7 * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]

    with wave.open(os.path.join(args.build, "mix.wav"), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())

    print(f"  mix.wav  {len(mix) / SR:.2f}s  peak {float(np.max(np.abs(mix))):.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
