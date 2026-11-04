#!/usr/bin/env python3
"""
voice.py — narration synthesis, timing measurement and lip-sync envelope.

Takes the `lines` block of a film.json, speaks each line with Piper, lays the
lines out on a timeline with gaps, and writes three artefacts:

    narration.wav   the voice track, 48 kHz mono
    timings.json    {total, lines: {id: {start, dur}}}  <- drives every cut
    envelope.json   {fps, data: [...]}                  <- drives the mouth

Everything downstream (scene timeline, score, render length) is derived from
timings.json, so you never hand-time a cut again.

Usage
-----
    python kit/voice.py --film films/my-film/film.json --out build/my-film
    python kit/voice.py --download hi_IN-pratham-medium
"""
from __future__ import annotations

import argparse
import json
import re
import os
import sys
import wave

import numpy as np

SR_OUT = 48000
ENV_FPS = 30
HF_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"


# --------------------------------------------------------------------------- #
# voice download
# --------------------------------------------------------------------------- #
def download_voice(model: str, voices_dir: str) -> str:
    """Fetch a Piper voice from HuggingFace. `model` looks like hi_IN-pratham-medium."""
    import urllib.request

    lang, region, name, quality = model.split("-")[0].split("_") + model.split("-")[1:]
    path = f"{lang}/{lang}_{region}/{name}/{quality}/{model}"
    os.makedirs(voices_dir, exist_ok=True)
    onnx = os.path.join(voices_dir, f"{model}.onnx")
    if not os.path.exists(onnx):
        print(f"  downloading {model} ...")
        urllib.request.urlretrieve(f"{HF_URL}/{path}.onnx", onnx)
        urllib.request.urlretrieve(f"{HF_URL}/{path}.onnx.json", onnx + ".json")
    return onnx


# --------------------------------------------------------------------------- #
# audio helpers
# --------------------------------------------------------------------------- #
def resample(x: np.ndarray, sr_from: int, sr_to: int) -> np.ndarray:
    n = int(len(x) * sr_to / sr_from)
    return np.interp(np.arange(n) * (sr_from / sr_to), np.arange(len(x)), x)


def synthesise(text: str, voice, cfg, pitch: float) -> np.ndarray:
    """Speak one line. `pitch` < 1 lowers the voice and slows it a touch."""
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as fh:
        tmp = fh.name
    try:
        with wave.open(tmp, "wb") as w:
            voice.synthesize_wav(text, w, syn_config=cfg)
        w = wave.open(tmp)
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
        w.close()
    finally:
        os.unlink(tmp)

    # pitch shift by resampling: lower pitch also stretches time, which is
    # exactly the "slower + deeper" pairing most explainer narration wants.
    if abs(pitch - 1.0) > 1e-3:
        data = resample(data, sr, int(sr * pitch))
        sr = int(sr * pitch)
    return resample(data, sr, SR_OUT)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--film", help="path to film.json")
    ap.add_argument("--out", help="output directory, e.g. build/my-film")
    ap.add_argument("--voices", default="voices", help="where Piper .onnx voices live")
    ap.add_argument("--download", help="download a Piper voice id and exit")
    args = ap.parse_args()

    if args.download:
        print(download_voice(args.download, args.voices))
        return 0

    if not (args.film and args.out):
        ap.error("--film and --out are required")

    film = json.load(open(args.film, encoding="utf-8"))
    vc = film.get("voice", {})
    model = vc.get("model", "en_US-lessac-medium")
    gap = float(film.get("gap", 0.5))
    lead = float(film.get("lead", 1.3))
    tail = float(film.get("tail", 1.2))

    onnx = download_voice(model, args.voices)

    from piper import PiperVoice
    from piper.config import SynthesisConfig

    print(f"  voice: {model}")
    voice = PiperVoice.load(onnx, config_path=onnx + ".json")
    cfg = SynthesisConfig(
        length_scale=float(vc.get("length_scale", 1.0)),
        noise_scale=float(vc.get("noise_scale", 0.667)),
        noise_w_scale=float(vc.get("noise_w", 0.8)),
    )

    os.makedirs(args.out, exist_ok=True)
    clips, timings = [], {}
    total = lead

    for line in film["lines"]:
        audio = synthesise(line["text"], voice, cfg, float(vc.get("pitch", 1.0)))
        audio = audio / (np.max(np.abs(audio)) + 1e-9) * float(vc.get("gain", 0.85))
        timings[line["id"]] = {"start": round(total, 3), "dur": round(len(audio) / SR_OUT, 3)}
        clips.append((total, audio))
        total += len(audio) / SR_OUT + gap
        print(f"    {line['id']:<4} {timings[line['id']]['start']:7.2f}s  {timings[line['id']]['dur']:5.2f}s")

    duration = total + tail
    track = np.zeros(int(duration * SR_OUT), dtype=np.float32)
    for start, audio in clips:
        i0 = int(start * SR_OUT)
        track[i0:i0 + len(audio)] += audio

    # gentle high-pass + peak normalise
    track = np.diff(track, prepend=track[:1]) * 0.30 + track * 0.88
    track = np.clip(track / (np.max(np.abs(track)) + 1e-9) * 0.90, -1, 1)

    with wave.open(os.path.join(args.out, "narration.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR_OUT)
        w.writeframes((track * 32767).astype("<i2").tobytes())

    # lip-sync envelope: RMS per video frame, normalised
    step = int(SR_OUT / ENV_FPS)
    env = np.array([float(np.sqrt(np.mean(np.abs(track[i:i + step]) ** 2)))
                    for i in range(0, len(track) - step, step)])
    env = np.clip(env / (np.percentile(env, 97) + 1e-9), 0, 1)

    json.dump({"fps": ENV_FPS, "data": [round(float(v), 3) for v in env]},
              open(os.path.join(args.out, "envelope.json"), "w"))
    json.dump({"total": round(duration, 3), "lines": timings},
              open(os.path.join(args.out, "timings.json"), "w"), indent=1)

    # ---- word timings ----
    # Piper returns phoneme alignments only for some voices, so words are spread
    # across each line in proportion to their length and each boundary is then
    # snapped to the quietest point nearby. Approximate by design: within about
    # 100 ms, well inside what a caption can show. Used for karaoke captions.
    words = []
    for line in film["lines"]:
        lid = line["id"]
        if lid not in timings:
            continue
        start, dur = timings[lid]["start"], timings[lid]["dur"]
        toks = [w for w in re.split(r"\s+", line["text"].strip()) if w]
        if not toks:
            continue
        weights = [max(1, len(re.sub(r"[^\w\u0900-\u097F]", "", w))) for w in toks]
        total_w = sum(weights)
        seg = track[int(start * SR_OUT):int((start + dur) * SR_OUT)]
        acc, w_start = 0, start
        for i, (w, wt) in enumerate(zip(toks, weights)):
            acc += wt
            w_end = start + dur * acc / total_w
            if 0 < i < len(toks) - 1 and len(seg) > 0:
                guess = int((w_end - start) * SR_OUT)
                lo, hi = max(0, guess - int(0.12 * SR_OUT)), min(len(seg), guess + int(0.12 * SR_OUT))
                if hi - lo > 720:
                    win = 480
                    energies = [float(np.abs(seg[j:j + win]).mean()) for j in range(lo, hi - win, 240)]
                    if energies:
                        w_end = start + (lo + int(np.argmin(energies)) * 240 + win // 2) / SR_OUT
            words.append({"line": lid, "w": w, "start": round(w_start, 3), "end": round(w_end, 3)})
            w_start = w_end
    json.dump(words, open(os.path.join(args.out, "words.json"), "w"), ensure_ascii=False)
    print(f"  words.json     {len(words)} words")

    print(f"  total {duration:.2f}s  ->  {args.out}/narration.wav")
    return 0


if __name__ == "__main__":
    sys.exit(main())
