#!/usr/bin/env python3
"""
mix.py — duck the score under the voice, hit a broadcast loudness target, and
write stems + a report you can actually read.

Three things here are borrowed in spirit from mromidev/claude-animated-shorts
(see CREDITS.md): ducking keyed to *speech*, normalising to an integrated
loudness target rather than peak, and emitting stems plus a human-readable
report so the mix can be reviewed without a DAW.

    python kit/mix.py --build build/my-film --target -14 --ceiling -1.5

Writes into the build directory:
    mix.wav          the master
    stems/voice.wav  voice at its final gain
    stems/music.wav  score at its final, ducked gain
    mix-report.md    loudness, ducking depth, peak
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import wave

import numpy as np

SR = 48000


# --------------------------------------------------------------------------- #
# ITU-R BS.1770 loudness (K-weighting + gated integrated LUFS)
# --------------------------------------------------------------------------- #
def _biquad(x, b, a):
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        x2, x1, y2, y1 = x1, x[i], y1, v
        y[i] = v
    return y


def k_weight(x):
    """Stage 1 high-shelf (+4 dB @ ~1.7 kHz) and stage 2 high-pass (38 Hz), 48 kHz coefficients."""
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return _biquad(_biquad(x, b1, a1), b2, a2)


def integrated_lufs(sig):
    """Integrated loudness of a stereo signal (n, 2) in LUFS."""
    if sig.ndim == 1:
        sig = np.stack([sig, sig], axis=1)
    kw = np.stack([k_weight(sig[:, 0]), k_weight(sig[:, 1])], axis=1)
    block, hop = int(0.4 * SR), int(0.1 * SR)
    if len(kw) < block:
        return -70.0
    power = []
    for start in range(0, len(kw) - block, hop):
        seg = kw[start:start + block]
        power.append(np.mean(seg ** 2) * 2.0)          # 2 channels
    power = np.array(power)
    with np.errstate(divide="ignore"):
        loud = -0.691 + 10 * np.log10(power + 1e-12)
    gated = loud[loud > -70.0]
    if len(gated) == 0:
        return -70.0
    rel = gated.mean() - 10.0
    gated = gated[gated > rel]
    return float(-0.691 + 10 * np.log10(np.mean(10 ** ((gated + 0.691) / 10)) + 1e-12))


def true_peak(sig):
    """Approximate true peak: sample peak plus inter-sample overshoot via 4x linear upsample."""
    if sig.ndim == 1:
        sig = sig[:, None]
    peak = 0.0
    for ch in range(sig.shape[1]):
        x = sig[:, ch]
        up = np.interp(np.linspace(0, len(x) - 1, len(x) * 4), np.arange(len(x)), x)
        peak = max(peak, float(np.max(np.abs(up))), float(np.max(np.abs(x))))
    return peak


# --------------------------------------------------------------------------- #
def read_wav(path):
    w = wave.open(path)
    sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
    data = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    w.close()
    data = data.reshape(-1, ch)
    if ch == 1:
        data = np.repeat(data, 2, axis=1)
    return data, sr


def write_wav(path, data, sr=SR):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as f:
        f.setnchannels(data.shape[1] if data.ndim > 1 else 1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(pcm.tobytes())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--build", required=True)
    ap.add_argument("--target", type=float, default=-14.0, help="integrated LUFS target (-14 suits social platforms)")
    ap.add_argument("--ceiling", type=float, default=-1.5, help="true peak ceiling in dBTP")
    ap.add_argument("--duck", type=float, default=-3.5, help="how far the score dips under speech, dB")
    ap.add_argument("--music-gain", type=float, default=0.0, help="extra dB on the score before ducking")
    args = ap.parse_args()

    voice, _ = read_wav(os.path.join(args.build, "narration.wav"))
    music_path = os.path.join(args.build, "music.wav")
    if not os.path.exists(music_path):
        raise SystemExit("music.wav missing — run kit/music.py first")
    music, _ = read_wav(music_path)

    n = min(len(voice), len(music))
    voice, music = voice[:n], music[:n]

    # ---- ducking keyed to the voice envelope, not to the mixed audio ----
    win = int(0.05 * SR)
    env = np.sqrt(np.convolve((voice ** 2).mean(axis=1), np.ones(win) / win, mode="same"))
    env = env / (np.percentile(env[env > 0], 90) + 1e-9)
    # smooth attack/release so the bed breathes rather than pumps
    alpha = 1 - np.exp(-1 / (0.12 * SR / win))
    smooth_env = np.zeros_like(env)
    acc = 0.0
    for i in range(0, len(env), win):
        acc += alpha * (env[i] - acc)
        smooth_env[i:i + win] = acc
    duck_db = args.duck * np.clip(smooth_env, 0, 1)
    music = music * (10 ** ((duck_db + args.music_gain) / 20.0))[:, None]

    mix = voice + music

    # ---- normalise to the loudness target, then limit to the ceiling ----
    lufs = integrated_lufs(mix)
    gain = 10 ** ((args.target - lufs) / 20.0)
    mix *= gain
    peak = true_peak(mix)
    ceiling = 10 ** (args.ceiling / 20.0)
    if peak > ceiling:
        mix = ceiling * np.tanh(mix / ceiling)   # unity for small signals, soft above

    fade_in = int(0.05 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    fade_out = int(0.7 * SR)
    mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]

    write_wav(os.path.join(args.build, "mix.wav"), mix)
    write_wav(os.path.join(args.build, "stems", "voice.wav"), voice * gain)
    write_wav(os.path.join(args.build, "stems", "music.wav"), music * gain)

    final_lufs = integrated_lufs(mix)
    final_peak = true_peak(mix)
    duck_depth = float(np.abs(duck_db).max())
    report = f"""# Mix report

| | |
|---|---|
| duration | {len(mix) / SR:.2f} s |
| sample rate | {SR} Hz stereo |
| integrated loudness | **{final_lufs:.1f} LUFS** (target {args.target:.1f}) |
| true peak | **{20 * np.log10(final_peak + 1e-12):.1f} dBTP** (ceiling {args.ceiling:.1f}) |
| ducking | score dips up to **{duck_depth:.1f} dB** while the voice speaks |
| master gain applied | {20 * np.log10(gain):+.1f} dB |

Stems are in `stems/`. The ducking envelope is derived from the narration, so it
re-times itself when the script changes.
"""
    open(os.path.join(args.build, "mix-report.md"), "w").write(report)
    print(f"  mix.wav  {final_lufs:.1f} LUFS  {20 * np.log10(final_peak):.1f} dBTP  duck {duck_depth:.1f} dB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
