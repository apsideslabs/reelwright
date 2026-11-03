# Architecture

```
film.json ──► kit/voice.py ──► narration.wav, timings.json, envelope.json
          └─► kit/music.py ──► mix.wav  (score + voice)

kit/build.py ──► build/<slug>/site/
                   scene.js      copied from films/<slug>/
                   timeline.js   generated: FPS, DUR, T{}, LINES{}
                   film.js       generated: the whole film.json as FILM
                   envelope.json generated
                   three.module.js, jsm/, fonts/, assets/   from kit/lib/

kit/render.js ──► build/<slug>/frames/f00000.jpg …
kit/encode.py ──► build/<slug>/<slug>.mp4
```

## The seam that matters

The single design decision that makes this reusable: **the scene never contains a timestamp**. It contains `T.s4`, and `T` is generated from measured speech. Re-record a line and every cut downstream shifts correctly.

```
timings.json  { l5: {start: 29.15, dur: 4.30} }
      │
      ▼  beats: { "s5": "l5" }
timeline.js   export const T = { s5: 29.15, ... }
      │
      ▼
scene.js      if (t < T.s5) return camLerp(...)
```

## Layers in the scene

1. **Set** — static geometry, built once at load: shop, counter, shelves, street, houses
2. **Cast** — cloned skinned meshes, posed per frame through bones
3. **Camera** — keyed positions blended with easing
4. **HUD** — Canvas 2D drawn *after* the 3D pass, in screen space

The HUD lives in 2D deliberately. 3D text under a 9:16 perspective gets cropped by tight framing and shears at the edges; a 2D pass is always crisp, always correctly placed, and free to render.

## Per-frame pipeline

```
update(t)            pose bones, place props, move camera
renderer.render()    3D pass (WebGL)
drawHUD(t, ctx2d)    2D pass — cards, captions, progress bar
vignette + fade      Canvas 2D gradient, cheap
canvas.toDataURL()   JPEG
```

The JPEG goes back through Puppeteer as base64. Avoid `toDataURL` on the *WebGL* canvas — it is dramatically slower than reading from a 2D canvas that has copied it.

## Why software rendering

There is no GPU in a default container, so Chromium falls back to SwiftShader — correct output, slow. Two consequences drive the whole design:

- **Resumability.** `render.js --resume` skips frames already on disk; `build.py` loops with a chunk timeout until all frames exist.
- **Cheap effects.** Shadow maps and MSAA cost 35–50% of frame time; fake contact shadows and no MSAA cost almost nothing. A separate full-screen WebGL overlay pass cost a third of the budget, so the vignette moved to Canvas 2D.

## Memory

x264 at 1080p with default settings needs more than a 2 GB box has. `encode.py` pins `threads=1`, a small `rc-lookahead`, and `bframes=2`. If encoding dies with *Cannot allocate memory*, that is the knob.
