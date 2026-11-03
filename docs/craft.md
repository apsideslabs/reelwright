# Craft targets

Numbers, not adjectives. These are measured targets you can check a frame against with [`kit/qa.py`](../kit/qa.py) and a handful of lines of numpy.

Most of them come from a measured study of a reference channel — 20 vertical shorts, ~32,000 frames — published in [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) under MIT (see [CREDITS](../CREDITS.md)). That study is about a 2D-cartoon-in-3D style; the *measurements* below are style-independent and are what this kit targets.

## Picture

| Metric | Reference | This kit (default) | Notes |
|---|---|---|---|
| luma median | 0.43 – 0.57 | — | raise `grade.exposure` until a mid-shot lands here |
| luma p99 | 0.90 – 1.00 | ≥ 0.90 | if there are no near-whites, the image is flat |
| luma p5 (non-ink) | 0.03 – 0.11 | ≥ 0.10 | darks, but not crushed |
| **black point** | **(35, 19, 20)** warm | **`grade.lift`** | never pure black — `(0,0,0)` reads as a dead pixel |
| saturation | 0.38 – 0.65 | 0.38 – 0.46 | flat grey is the amateur tell |
| vignette (corner ÷ centre) | 0.86 | 0.86 – 0.90 | `grade.vignette`, ~0.42 alpha at the corners |
| background DOF | on in ~⅓ of shots, σ≈4 px @720p | not implemented | roadmap |

The black point is the single cheapest improvement in the whole file. Canvas has no lift/gamma control, but `globalCompositeOperation = 'lighten'` with a fill of `rgb(35,19,20)` raises every channel below that value and leaves everything above it untouched — a black lift in one line, free per frame. Apply it **last**, after the vignette, or the vignette re-crushes the corners.

## Timing

| Metric | Reference | Notes |
|---|---|---|
| words per second | 3.5 – 4.1 (median 3.7) | fast, steady, almost no gaps |
| pause > 0.25 s | < 1 s per video | dead air is the thing viewers click away from |
| integrated loudness | −14 LUFS | `audio.target_lufs` |
| loudness range | ~2.4 LU | heavily compressed; the bed sits 5–10 dB under speech |
| music under voice | 5 – 10 dB | `audio.duck_db` + `music.bed_gain` |

This kit's Hindi example runs at ~1.8 words/s on purpose — the brief was "deeper and not very fast". That is a deliberate deviation from the reference, not an accident; note it if you copy the pacing.

## Motion

1. **A reaction lands 0–3 frames before its word.** Late reads as a delay; early reads as a prediction.
2. **The camera never fully stops.** A constant ~0.14 %/frame push separates a hold from a stall. Implemented in `scene.js` on top of every camera key.
3. **Cuts are the exception.** The reference has 0–1 hard cuts per video; place and time changes are continuous camera moves or 6–8 frame crossfades.
4. **Blink in four frames** — half, shut, shut, half — every 0.5–2.3 s, plus one on every expression change. A symmetric V reads as a flinch. Implemented in `blinkAt()`.
5. **Walks are planted and bouncy**: 3–7 % body bob, 1–7° lean per step, 9–12 frames per step, and the stance foot does not slide.

## Structure

The reference script formula, from the same study — useful as a checklist even for an explainer:

1. **Hook** = a paradox stated as fact, in sentence one, no setup.
2. **Setting** in one or two lines, present tense, concrete.
3. **Escalation**, three to six beats, stakes climbing.
4. **Mystery beat** — a question, or "Wait…".
5. **Pivot** — "You see," → the actual mechanism, through an everyday analogy.
6. **Ironic payoff** in the last sentence; end on the last word.

No intro, no logo, no outro, no CTA — voice starts within 4 frames of picture.

## How to check a frame

```python
import numpy as np
from PIL import Image
a = np.asarray(Image.open("frame.jpg").convert("RGB"), np.float32) / 255
Y = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
print("median", np.median(Y), "p99", np.percentile(Y, 99))
dark = a.reshape(-1, 3)[np.argsort(Y.ravel())[:Y.size // 200]].mean(0) * 255
print("black point", dark.round())     # want ≈ (35, 19, 20)
```
