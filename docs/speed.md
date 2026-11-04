# Speed

A 60-second film is 1,440 frames at 24 fps. At 1080×1920 that is 2.07 million pixels per frame, shaded by the CPU, 1,440 times. That is where the hour goes.

## Why it is slow

There is no GPU. Chromium falls back to SwiftShader, which rasterises every pixel of every frame in software, on your cores. A real GPU does the same work in parallel across thousands of lanes; a CPU does it a few at a time.

Measured on a 2-core, 2 GB, GPU-less box:

| Output | s/frame | 60 s film (1,440 frames) |
|---|---|---|
| 1080×1920 | 2.51 | ~60 min |
| 720×1280 | 1.17 | ~28 min |
| 540×960 | 0.79 | ~19 min |

Cost is close to linear in pixel count, plus a small fixed overhead per frame (~0.2 s).

## The levers, best first

**1. Use a GPU — 20–50× if you have one.** `render.js` detects `/dev/dri` and switches automatically; the first line of the render log says which path it took.

```
  renderer: GPU (hardware)          # good
  renderer: SwiftShader (software)  # 20-50x slower
```

Force it either way with `--gpu 1` / `--gpu 0`. On a laptop with integrated graphics this alone turns an hour into a couple of minutes. *The 20–50× figure is the usual range for this workload — it is not measured here, because this machine has no GPU.*

**2. Render smaller.** `--draft` gives 540×960 at 20 fps: about 4× faster, soft but perfectly good for checking timing and wording.

```bash
python kit/make.py script.txt --draft      # ~5 min for a minute
python kit/make.py script.txt              # full 1080p
```

**3. Fewer frames.** 20 fps instead of 24 is 17% fewer frames and reads fine for a talking-head explainer.

**4. Parallel workers — only if you have spare cores.**

```bash
python kit/make.py script.txt --workers 4   # on an 8-core machine
```

On the 2-core test box two workers were *slower* than one: SwiftShader already uses every core it can get, so a second browser just makes them fight. A rough rule: one worker per 2 cores, and never more workers than cores ÷ 2.

**5. Make the scene cheaper.** Shadows and MSAA are already off by default — together they cost ~45%. The toon outline pass is nearly free (the outline material is cheap). A scene with fewer lights and fewer overlapping transparent surfaces renders faster.

## What does not help

- **Rendering at 1080p and downscaling.** You pay for every pixel either way.
- **More workers than cores.** Thrashing, as measured above.
- **A bigger chunk timeout.** The timeout only decides how often progress is saved, not how fast frames are made.

## Checking where you are

The render prints progress as it goes, and it is resumable — stop it, start it again, it continues from the last frame on disk. Nothing is lost.
