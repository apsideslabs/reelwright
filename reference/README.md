# Reference — *Slow as molasses* (Babylon.js, word-level timing)

A finished 56.6-second vertical explainer, kept here as a **second worked example**: same philosophy as
`films/kuch-bhi-kaise-bechein` — no timestamps in the scene, every cut derived from measured speech — but a
different engine and a different timing source.

- **Engine:** Babylon.js 8.33.3 (Apache-2.0) instead of three.js.
- **Timing:** word-level, from edge-tts `WordBoundary` events, instead of Piper line-level alignments.
- **Subject:** the Great Molasses Flood, Boston, 15 January 1919 — 2.3 million US gallons released at an
  estimated 35 mph, 21 dead, and a physics lesson about gravity currents and viscosity.

It exists because it does two things on the roadmap without touching `kit/`: it demonstrates **word-level
timing**, and it demonstrates a **second renderer** behind the same script-to-frames contract.

## Watch it

| File | What |
|---|---|
| `molasses_short.mp4` | 720×1280, 24 fps, 56.6 s, H.264 + AAC, 7.8 MB |
| `explainer.html` | Self-contained interactive page: chapter cards that seek, key numbers, a viscosity slider |
| `molasses_script_sources.md` | Narration line by line, every fact with its source, build notes |

Open `explainer.html` next to `molasses_short.mp4` (same folder) and it plays in place.

## Why Babylon.js here

Both engines render the same way under SwiftShader, so the choice is about ergonomics:

- One UMD file, no bundler, no module graph — it loads from `file://` in headless Chromium, which is exactly
  what the capture harness needs.
- `mesh.renderOutline` is a first-class ink pass. The house style wants a near-black line on every solid;
  in three.js that is an `EdgesGeometry` pass you write and maintain.
- Manual stepping is trivial: `engine` + `scene.render()` and never a render loop, so frame *n* is a pure
  function of *n*.

What it costs: Babylon's bundle is bigger than a tree-shaken three.js build, and the API surface is wider
than this film needs. For a 56-second short, neither mattered.

## Layout

```
reference/
├── molasses_short.mp4          the finished film
├── explainer.html              interactive page (loads the mp4 next to it)
├── molasses_script_sources.md  script, facts, sources, build notes
└── src/
    ├── voice.py                narration via edge-tts + word timings -> voice/words.json
    ├── build_voice.py          trims each line, concatenates with gaps, rewrites absolute word times
    ├── timeline.py             word marks -> the edit decision list
    ├── timeline.js             GENERATED: shot boundaries and event frames, in frames at 24 fps
    ├── scene.html              the page the renderer drives
    ├── scene.js                the whole film: world, cast, camera, per-shot posing
    ├── capture.py              headless Chromium -> PNG per frame (software WebGL2)
    ├── mix.py                  score + SFX synthesised in numpy, mixed under the voice
    └── build_page.py           emits explainer.html from the same timeline
```

## Rebuild it

```bash
pip install playwright edge-tts imageio-ffmpeg numpy
# Chromium on PATH, or CHROME=/path/to/chromium

cd reference
python src/voice.py                 # narration mp3s + word marks -> voice/
python src/build_voice.py           # voice/voice.wav + absolute timings -> voice/words.json
python src/timeline.py              # word marks -> timeline.js (the edit decision list)
python src/capture.py 0 114         # frames -> frames/f0000.png …
python src/mix.py                   # audio/mix.wav
ffmpeg -framerate 24 -i frames/f%04d.png -i audio/mix.wav \
       -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest molasses_short.mp4
```

`timeline.js` is checked in even though `timeline.py` generates it, because it is the film's edit decision
list and belongs in a diff. `voice/` is not checked in — `voice.py` and `build_voice.py` recreate it, and
without network access you can still render the film from the checked-in timeline.

## How the timing works

`voice.py` asks edge-tts for `WordBoundary` events, so every word arrives with an offset in seconds. Words
are grouped into the eight narration lines, each line is trimmed to its last word plus a hair of room, and the
lines are concatenated with 0.35 s gaps — which turns relative word times into absolute ones.

The scene then contains no seconds at all. It asks for a frame number, finds the line that frame belongs to,
and poses the shot from that line's progress. Story beats that must land on a word read from the same table:

```js
const b = EV.burst;                  // the frame the word "tore" is spoken
if (f < b) { /* tank intact */ } else { /* steel flies, wave erupts, shake decays */ }
```

## Measured

| | |
|---|---|
| Frames | 1,359 at 720×1280 / 24 fps |
| Per frame | 1.6–2.0 s (software WebGL2, 2 vCPU) |
| Total render | ~40 min across 9 resumable chunks |
| QA | no black frames, no blown frames, no frozen span > 5 frames, luma 62–245 |
| Audio | mono 48 kHz, score +3 dB, SFX −6 dB under an unchanged voice |

The one QA finding worth recording: the first captured frame after each browser launch can carry a stale
texture upload, and the first frames of a shot can stall while a smoothstep ease has zero slope. Both are
fixed in `capture.py` (one throwaway render before the loop) and in `scene.js` (ease-out on shot entry).

## Licence

Code MIT, matching this repository. **Babylon.js is Apache-2.0** — the scene loads 8.33.3 from jsDelivr, or
vendor `babylon.js` into `src/assets/` if you want an offline build; keep the Apache-2.0 notice if you vendor
it. Narration voice is a synthetic edge-TTS voice; check its terms before shipping a film made with it.
Story, characters and script are original to this repository.
