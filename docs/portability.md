# Portability and longevity

Nobody can promise a piece of software will run unchanged in 50 years. Anyone who says otherwise is selling something. What you *can* engineer is **portability**: no lock-in, graceful degradation, and seams you can swap.

That is what this page documents — the guarantees Reelwright actually makes, and what to do when a piece of the stack dies.

## The four seams

Everything here is a file on disk with a documented shape. Any one of them can be replaced without touching the other three.

| Seam | Contract | Replace it with |
|---|---|---|
| **`film.json`** | plain JSON: lines, beats, graphics, music cues, grade | anything that writes the same JSON |
| **`narration.wav` + `timings.json`** | 48 kHz audio, plus `{id: {start, dur}}` | any TTS — ElevenLabs, Azure, a human reading into a mic. `voice.py` is not privileged. |
| **`scene.js` + `renderFrame(i)`** | a web page exposing `window.renderFrame(i)` that returns a JPEG data URL | a WebGPU renderer, a Blender pipeline, a canvas 2D animator — anything that renders frame *i* deterministically |
| **frames + `mix.wav`** | numbered JPEGs and one audio track | ffmpeg is the encoder; `encode.py` is a thin wrapper |

If three.js disappears tomorrow, you rewrite `scene.js` and keep `voice.py`, `mix.py`, `qa.py`, `build.py` and every film's `film.json`. That is the point of the seams.

## Graphics backends

WebGL reaches the machine through ANGLE, and which backend ANGLE targets decides both speed and longevity. Reelwright tries these in order and keeps the first that works:

1. **hardware** — real GPU: Metal on macOS, D3D11 on Windows, GL/Vulkan on Linux.
2. **mesa** — `--use-angle=gl` → Mesa llvmpipe. On a CPU-only Linux box this is around 4× faster than SwiftShader, and it is not gated as unsafe upstream.
3. **swiftshader** — Chromium's bundled software rasteriser. It is behind `--enable-unsafe-swiftshader` and is deprecated upstream, so it is the last resort, not the default.

The winner is cached in `.cache/backend.json` so later runs skip the failing attempts. Pin one with `--backend=hardware|mesa|swiftshader`, or `--gpu 0` to forbid hardware.

This is the longevity design in miniature: **no single backend is load-bearing.** When SwiftShader is eventually removed, machines without a GPU fall through to Mesa; when Mesa's GL path changes, they fall through to whatever comes next — add it to `BACKENDS` in `kit/render.js` and the chain picks it up.

## Versioning

- `film.json` carries `"schema": 1`. When the format changes, `build.py` will refuse a newer schema rather than silently mis-render it, and a migration will ship alongside.
- Dependencies are pinned with `~=` in `requirements.txt` and by exact version in `package.json`. `.github/dependabot.yml` opens a PR when an update lands; CI checks syntax and that every `beats` entry still resolves.
- three.js is vendored in `kit/lib/` rather than fetched at render time, so a CDN change or a new major version cannot break a film that already exists. Upgrading is a deliberate act: drop in the new build, run `make test`.

## What is not guaranteed

- **Pixel-identical output across machines.** GPU vs CPU rasterisation differs slightly at edges. The film is the same film; the last bit of the last pixel is not.
- **Voice models staying downloadable.** Piper voices live on HuggingFace. `voices/` is gitignored; keep a copy if you care about a specific film's voice.
- **Platform safe areas.** The numbers in `docs/safe-areas.md` are a snapshot of TikTok, Reels and Shorts UI as measured in October 2026. Apps move their buttons. Re-check every few months.
- **Anything about the next 50 years.** See the first line.

## Checking a machine

```bash
python kit/doctor.py      # or: make doctor
```

Reports OS, architecture, runtimes, Chromium, GPU, Mesa, display, ffmpeg, Python packages, voice models and whether every film parses. Non-zero exit if something essential is missing, so it works in CI.
