<div align="center">

<img src="assets/banner.svg" alt="Reelwright — vertical explainer videos, built from a script" width="100%">

<br>

**Write a script. Get a finished vertical video.** Voice, score, characters, motion graphics and frames — all generated from one JSON file. No editor, no stock footage, no licences to clear.

[![License: MIT](https://img.shields.io/badge/license-MIT-e8b64c.svg?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10%2B-3776ab.svg?style=flat-square&logo=python&logoColor=white)](requirements.txt)
[![Node](https://img.shields.io/badge/node-18%2B-339933.svg?style=flat-square&logo=node.js&logoColor=white)](package.json)
[![three.js](https://img.shields.io/badge/three.js-r169-000000.svg?style=flat-square&logo=three.js&logoColor=white)](kit/lib/three.module.js)
[![No GPU](https://img.shields.io/badge/GPU-not%20required-5ab86a.svg?style=flat-square)](#performance)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-e0574a.svg?style=flat-square)](CONTRIBUTING.md)

`#vertical-video` `#explainer` `#three.js` `#text-to-speech` `#procedural-audio` `#ffmpeg` `#reels` `#shorts` `#pipeline`

</div>

---

Reelwright turns a written script into a narrated 9:16 film: a TTS voice measured to the millisecond, a score synthesised from sine waves, a rigged 3D character who moves his lips to the narration, motion graphics that stay crisp at any camera angle, and an MP4 at the end. It ran the 85-second Hindi explainer in [`films/kuch-bhi-kaise-bechein`](films/kuch-bhi-kaise-bechein) on a **2-core, 2 GB, GPU-less box**.

<div align="center">
<img src="docs/stills/frame-title.jpg" width="24%" alt="title card">
<img src="docs/stills/frame-steps.jpg" width="24%" alt="six-step checklist">
<img src="docs/stills/frame-sale.jpg" width="24%" alt="the sale">
</div>

## Contents

- [Why it exists](#why-it-exists)
- [Quickstart](#quickstart)
- [How it works](#how-it-works)
- [The script format](#the-script-format)
- [Styles](#styles)
- [Safe areas](#safe-areas)
- [Performance](#performance)
- [Portability](#portability)
- [Quality control](#quality-control)
- [Project layout](#project-layout)
- [Craft rules](#craft-rules)
- [Roadmap](#roadmap)
- [Credits](#credits)
- [Licence](#licence)

## Why it exists

Making a decent explainer normally means an editor, a voice artist, a stock subscription and a licence audit. Reelwright replaces all four with a pipeline you can read:

| Normally | Here |
|---|---|
| Record voice, hand-time every cut | `voice.py` measures each line; the timeline is **generated** from it |
| Licence stock music | Score synthesised from sine waves, described as JSON cues |
| Rig a character in Blender | A rigged avatar posed bone-by-bone in code, lip-synced from the narration |
| Animate titles in After Effects | Motion graphics drawn in Canvas 2D at 1080×1920, in the same pass |
| Export and hope | `qa.py` checks every frame for black, blown, frozen and pop frames, plus loudness |
| Pick a look in a render engine | `"style": "toon"` gives cel shading + ink outlines; `"real"` gives lit surfaces |

## Quickstart

```bash
git clone https://github.com/apsideslabs/reelwright && cd reelwright
./setup.sh                                              # python + node + chromium check

python kit/make.py "Everyone said the shop was finished. Then one question changed everything."
# -> everyone-said-the-shop-was-finished.mp4
```

That is the whole beginner path: words in, vertical video out, captions and voice included. **[START-HERE.md](START-HERE.md)** is the one-page version.

Want control? `make.py` writes a plain `film.json` you can edit and rebuild:

```bash
python kit/make.py myscript.txt --lang hi --style toon --steps "Problem,Solution,Proof"
$EDITOR films/my-story/film.json                        # lines, colours, music cues
python kit/build.py --film films/my-story/film.json
```

Prove the whole chain works, in about two minutes:

```bash
make test     # builds a 3-line film end to end at low res — 14 checks
```

Preview in seconds instead of an hour:

```bash
make preview FILM=films/my-film/film.json
# renders three stills at quarter size into build/my-film/preview/
```

## How it works

```
film.json ──► voice.py ──► narration.wav + timings.json + envelope.json
          └─► music.py ──► music.wav (score stem) + cues.json
                                    │
                                    ▼
                             mix.py ──► mix.wav  (ducked, -14 LUFS, stems, report)
                                    │
build.py ──► build/<slug>/site/     │
              timeline.js  ◄────────┘  every cut derived from measured speech
              film.js
              scene.js
                │
render.js ──► frames/f00000.jpg …   (resumable, chunkable)
                │
encode.py ──► <slug>.mp4 ──► qa.py ──► qa/qa-report.md + contact sheet
```

**The one idea worth stealing:** no scene ever contains a timestamp. It contains `T.s4`, and `T` is generated from the audio. Change a word and the whole film re-times itself.

```js
// films/*/scene.js
if (t < T.s3) return camLerp(K.wide, K.medium, easeInOut(seg(t, T.s2, T.s2 + 1.6)));
```

## The script format

Everything a film needs lives in one file — narration, scene beats, on-screen text, music cues. Full reference — every field, type and default — in [`docs/film-format.md`](docs/film-format.md). The format is frozen at `schema: 1`.

```jsonc
{
  "slug": "my-film",
  "fps": 24,
  "voice": { "model": "hi_IN-pratham-medium", "length_scale": 1.09, "pitch": 0.955 },
  "lines": [
    { "id": "l1", "text": "This is where your story starts." },
    { "id": "l2", "text": "Then say the thing that changes how they see it." }
  ],
  "beats": { "s2": "l2", "s3": "l3" },
  "graphics": {
    "title": { "heading": "MY FILM", "sub": "a one-line promise" },
    "steps": [ { "n": "1", "label": "PROBLEM", "color": "#e0574a" } ]
  },
  "music": {
    "bed_gain": 0.42,
    "cues": [ { "at": "l1", "inst": "pad", "note": "C3", "dur": 9 } ]
  }
}
```

## Styles

One flag changes the whole look:

```jsonc
{ "style": "toon" }   // cel shading, four-step ramp, inverted-hull ink outlines
{ "style": "real" }   // lit surfaces, soft shading (default)
```

Toon mode swaps every material for `MeshToonMaterial` and renders through three.js's `OutlineEffect` — the flat-colour-plus-ink look most animated shorts are built from. Screen-space `fx` cues (`impact`, `sparkle`) punch beats on top. Details and tuning in [`docs/styles.md`](docs/styles.md).

## Portability

Nothing here is load-bearing on one vendor. The film is plain JSON; the voice is a `.wav` plus a timings file; the scene is a web page exposing `renderFrame(i)`; the encoder is ffmpeg. Any one can be replaced without touching the others — that is what makes it survive a library dying.

Graphics backends are tried in order and fall back automatically: **hardware → Mesa llvmpipe → SwiftShader**, with the winner cached. SwiftShader is deprecated upstream, so it is the last resort rather than the only option.

```bash
make doctor     # OS, GPU, backends, ffmpeg, voices, films — before you wait an hour
```

Full guarantees, and the honest list of what is *not* guaranteed, in [`docs/portability.md`](docs/portability.md).

## Safe areas

Vertical platforms paint their interface over your video. Reelwright lays every graphic inside the box TikTok, Reels and Shorts all leave clear — **x 120–880, y 290–1240** on a 1080×1920 frame — because before 1.4 the last two steps of a six-step checklist sat under TikTok's caption block.

```jsonc
{ "safeArea": "all" }   // all | tiktok | reels | shorts | none
```

Check any frame with `?safe=1` on the render URL; details and the pixel table in [`docs/safe-areas.md`](docs/safe-areas.md).

## Performance

No GPU required — Chromium falls back to SwiftShader, which is correct but slow. Measured on a 2-core, 2 GB, GPU-less box:

| Resolution | Per frame | 60 s at 24 fps |
|---|---|---|
| 1080×1920 | 2.5 s | ~60 min |
| 720×1280 | 1.2 s | ~28 min |
| 540×960 (`--draft`) | 0.8 s | ~19 min |

**A GPU is 20–50× faster** and is detected automatically — the render log's first line tells you which path it took. Without one, `--draft` is the fast way to check timing and wording. Full breakdown, including why extra workers don't always help: [`docs/speed.md`](docs/speed.md).

Rendering is **resumable**: `render.js --resume` skips frames already on disk, and `build.py` loops in chunks until the film is complete. Kill it, run it again, it continues. On a 2 GB box, `encode.py` pins x264 to one thread; without that it dies with *Cannot allocate memory*.

## Quality control

`qa.py` is the part that keeps you honest. It decodes the finished MP4 at low resolution and reports:

```
PASS  0 problem(s), 2 warning(s)
  ! 3 still runs — a held camera is a choice, but a dead-still shot reads as a stall
luma mean 0.412 · motion mean 0.284 · black 0 · white 0 · pops 0
integrated loudness -14.2 LUFS · true peak -1.6 dBTP
```

It exits non-zero on failure, so it drops straight into CI. See [`docs/qa.md`](docs/qa.md).

## Project layout

```
kit/            the pipeline: voice, music, mix, render, encode, qa, build
kit/lib/        three.js, loaders, SkeletonUtils, Devanagari font, rigged avatar
films/          one directory per film: film.json + scene.js
templates/      starter film.json and index.html
docs/           format reference, customising, architecture, qa, troubleshooting
assets/         logo and banner
```

## Craft rules

Distilled from a careful study of the form (see [CREDITS](CREDITS.md)) and from rendering this kit's own films:

1. **A reaction lands 0–3 frames before its word.** Late feels like a delay, early feels like a prediction.
2. **The camera never fully stops.** A constant ~0.14 %/frame push is the difference between a hold and a stall.
3. **Blink in four frames** — half, shut, shut, half — every 0.5–2.3 s, and on every expression change.
4. **No crushed blacks.** Lift the floor slightly; pure black reads as a dead pixel, not a shadow.
5. **Time comes from the audio.** Never hand-place a cut you can measure.
6. **Never pure black.** Lift the floor to a warm (35,19,20) — see [docs/craft.md](docs/craft.md) for the numbers.

## Roadmap

- [ ] Word-level timing from Piper alignments (currently line-level)
- [ ] A second rigged avatar so casts stop sharing a face
- [ ] Optional depth-of-field pass (currently faked with fog)
- [ ] WebM/ProRes output alongside H.264

## Credits

Built by [@apsideslabs](https://github.com/apsideslabs). Adopts techniques from **[mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts)** (MIT) — see [`CREDITS.md`](CREDITS.md) for exactly what was taken and why.

Bundled third-party assets: [three.js](https://threejs.org) (MIT), a Ready Player Me sample avatar, [Noto Sans Devanagari](https://fonts.google.com/noto) (OFL), [Piper](https://github.com/rhasspy/piper) voices. Full table in [`NOTICE.md`](NOTICE.md).

## Licence

Code MIT — see [LICENSE](LICENSE). Check the licence of the specific Piper voice you ship.
