# Vertical Explainer Kit

Make a narrated, vertical (9:16) 3D explainer video from a JSON script — no editor, no stock footage, no licences to clear. Everything is generated: the voice, the music, the sound effects, the characters, the motion graphics and the frames.

Built for and battle-tested on a 2-core / 2 GB CPU-only box, where it produced an 85-second 1080×1920 Hindi explainer in about 90 minutes of rendering.

```
film.json  ──►  voice ──► timings ──► scene timeline ──► frames ──► mp4
                  │                        ▲
                  └──► music ──► mix.wav ──┘
```

## What's in the box

| Piece | What it does |
|---|---|
| `kit/voice.py` | Speaks your script with [Piper](https://github.com/rhasspy/piper) TTS, measures every line, emits `timings.json` and a lip-sync envelope |
| `kit/music.py` | Synthesises a score and SFX from sine waves — no samples, described declaratively in `film.json` |
| `kit/render.js` | Drives the scene in headless Chromium and writes JPEG frames; resumable and chunkable |
| `kit/encode.py` | Frames + audio → H.264 MP4, tuned for low-RAM machines |
| `kit/build.py` | Runs the whole chain, generates `timeline.js` from the measured audio |
| `kit/lib/` | three.js, GLTFLoader, SkeletonUtils, a Devanagari font, a rigged human avatar |
| `films/kuch-bhi-kaise-bechein/` | A complete worked example — 85 s Hindi explainer on selling |

## Quickstart

```bash
pip install piper-tts numpy imageio-ffmpeg
# Chromium must be on PATH (or pass --exec /path/to/chromium to kit/render.js)

# 1. copy the example film as your starting point
./new-film.sh my-film

# 2. edit films/my-film/film.json — your script, your graphics, your music

# 3. build it
python kit/build.py --film films/my-film/film.json
#    -> build/my-film/my-film.mp4
```

That's the whole loop. The first run downloads a ~63 MB voice model into `voices/`.

Quick look before committing to a full render (renders at quarter size, seconds per frame):

```bash
python kit/build.py --film films/my-film/film.json --steps site \
  && node kit/render.js --site build/my-film/site --out build/my-film/preview \
     --list=80,470,700 --query="w=540&h=960"
```

## Why it's built this way

**Timing comes from the audio, never from your guesses.** `voice.py` measures each line and writes `timings.json`. `build.py` turns that into `timeline.js`, which the scene imports. Every cut, card and camera move is positioned against real speech. Change one word in the script and the whole film re-times itself.

**The scene is code, the content is data.** Camera moves and acting live in `scene.js` where they belong; every word on screen, the six steps, the colours and the music cues live in `film.json`.

**Graphics are drawn in screen space.** 3D text gets clipped by tight vertical framing and blurs under perspective. The HUD layer draws to a 2D canvas after the 3D render, so type stays crisp and correctly framed at any camera angle — and it costs nothing to render.

**Rendering is resumable.** Software WebGL is slow, so `render.js` skips frames already on disk. Kill it, re-run it, it continues. Chunk it with `timeout` and loop.

## Requirements

- Node 18+ with `puppeteer-core` (`npm i puppeteer-core`), Chromium
- Python 3.10+ with `piper-tts`, `numpy`, `imageio-ffmpeg`
- No GPU needed — software WebGL (SwiftShader) is fine, just slow

## Docs

- [`docs/film-format.md`](docs/film-format.md) — every field in `film.json`
- [`docs/customising.md`](docs/customising.md) — changing cast, staging, camera, graphics
- [`docs/architecture.md`](docs/architecture.md) — how the pieces fit, and why
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — blank frames, slow renders, font and CORS issues

## Licence and credits

Code MIT. Bundled assets keep their own licences — see [`NOTICE.md`](NOTICE.md). The avatar is a Ready Player Me sample model shipped with three.js examples; the font is Noto Sans Devanagari (OFL).
