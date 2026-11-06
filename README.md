<div align="center">

<img src="assets/banner.svg" alt="Reelwright" width="100%">

<br>

A tool for making vertical explainer videos from a text file. It generates the narration, the music, the character animation, the on-screen graphics and the frames, then encodes an MP4.

[![License: MIT](https://img.shields.io/badge/license-MIT-e8b64c.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-3776ab.svg)](https://www.python.org/)
[![Node 18+](https://img.shields.io/badge/node-18%2B-339933.svg)](https://nodejs.org/)

</div>

I built this because making a 60-second explainer normally means an editor, a voice artist and a stock subscription. Here it's a JSON file and a render. The 85-second Hindi film in [`films/kuch-bhi-kaise-bechein`](films/kuch-bhi-kaise-bechein) was made with it on a two-core machine with no GPU.

<div align="center">
<img src="docs/stills/frame-title.jpg" width="24%" alt="title card">
<img src="docs/stills/frame-steps.jpg" width="24%" alt="six-step checklist">
<img src="docs/stills/frame-sale.jpg" width="24%" alt="the sale">
</div>

## Getting started

```bash
git clone https://github.com/apsideslabs/reelwright && cd reelwright
./setup.sh

python kit/make.py "Everyone said the shop was finished. Then one question changed everything."
```

The video lands in the repo root as `everyone-said-the-shop-was-finished.mp4`. Captions and voice are on by default; `--lang hi` switches language, `--draft` renders a fast low-resolution preview.

[START-HERE.md](START-HERE.md) is the same thing with more detail. If you want control over the script, `make.py` writes a plain `film.json` you can edit and rebuild:

```bash
python kit/make.py myscript.txt --steps "Problem,Solution,Proof"
$EDITOR films/my-story/film.json
python kit/build.py --film films/my-story/film.json
```

## How it works

```
film.json ──► voice.py ──► narration.wav + timings.json + envelope.json
          └─► music.py ──► music.wav (score stem) + cues.json
                                    │
                             mix.py ──► mix.wav (ducked, -14 LUFS, stems, report)
                                    │
build.py ──► build/<slug>/site/     │
              timeline.js  ◄────────┘   every cut derived from measured speech
              film.js
              scene.js
                │
render.js ──► frames/f00000.jpg …     (resumable, chunkable)
                │
encode.py ──► <slug>.mp4 ──► qa.py ──► qa/qa-report.md + contact sheet
```

The design decision worth knowing: no scene contains a hard-coded timestamp. It references `T.s4`, and `T` is generated from the audio. Change a word and the whole film re-times itself.

```js
// films/*/scene.js
if (t < T.s3) return camLerp(K.wide, K.medium, easeInOut(seg(t, T.s2, T.s2 + 1.6)));
```

## The film file

One JSON file describes a film: the lines, which lines are scene beats, on-screen graphics, the score, the grade and the look. Every field with its type and default is in [`docs/film-format.md`](docs/film-format.md). The format is frozen at `schema: 1`.

## Look

```jsonc
{ "style": "toon" }   // cel shading, four-step ramp, ink outlines
{ "style": "real" }   // lit surfaces, soft shading (default)
```

Toon mode swaps every material for `MeshToonMaterial` and renders through three.js's `OutlineEffect`. Screen-space `fx` cues (impact rings, sparkles) can be attached to any line. Tuning is in [`docs/styles.md`](docs/styles.md).

## Safe areas

TikTok, Reels and Shorts all draw captions and buttons over a vertical video. Every graphic is laid inside the area they all leave clear: x 120–880, y 290–1240 on a 1080×1920 frame. Before this existed, the last two rows of a six-step checklist sat under TikTok's caption block.

```jsonc
{ "safeArea": "all" }   // all | tiktok | reels | shorts | none
```

Add `?safe=1` to a render URL to draw the covered zones. Numbers and sources are in [`docs/safe-areas.md`](docs/safe-areas.md).

## Render speed

Measured on a two-core, 2 GB machine with no GPU:

| Resolution | Per frame | 60 s film at 24 fps |
|---|---|---|
| 1080×1920 | 2.5 s | about 60 min |
| 720×1280 | 1.2 s | about 28 min |
| 540×960 (`--draft`) | 0.8 s | about 19 min |

A GPU is far faster and is detected automatically; the first line of the render log says which backend you got. Without one, `--draft` is the sensible way to check timing and wording before committing to a full render. Full breakdown in [`docs/speed.md`](docs/speed.md).

## Portability

The film is plain JSON. The voice is a wav plus a timings file. The scene is a web page exposing `renderFrame(i)`. The encoder is ffmpeg. Any one of those can be replaced without touching the others, which is what stops a single library from being a point of failure.

Graphics backends are tried in order and fall back automatically: hardware, then Mesa llvmpipe, then SwiftShader, with the winner cached. SwiftShader is deprecated upstream, so it is the last resort rather than the only option.

```bash
make doctor     # OS, GPU, backends, ffmpeg, voices, films
```

[`docs/portability.md`](docs/portability.md) lists what is guaranteed and what isn't.

## Captions

Captions are on by default and follow the voice word by word: the word being spoken is highlighted in an accent colour, so a muted viewer still reads along. Word timings are derived from the narration audio rather than from a model's alignment pass, which is why they work for every language Piper supports.

```jsonc
{ "captions": true, "captionAccent": "#ffd45e" }
```

## Scenes, cast and lights

A film can cut between locations. `kit/lib/scene-kit.js` provides the pieces a
`scene.js` used to re-invent: a stage manager, a poseable cast, a lighting rig,
set geometry helpers and the HUD.

```js
import * as K from './scene-kit.js';

const app = K.createApp({ w: 1080, h: 1920, shadows: true });
const rig = await K.loadRig('./assets/readyplayer.me.glb');

const stages = K.createStages(app.scene, [
  { key: 'office', t0: -1,   t1: T.s3, build: office },   // cut on a measured beat
  { key: 'plain',  t0: T.s3, t1: T.s7, build: plain }
]);

const clerk = K.makeHuman(rig, { height: 1.70, top: 0x35507a, skin: 0x9a7150 });
K.poseHuman(clerk, K.POSE.write);
K.speak(clerk, K.mouthAt(envelope, t));   // mouth follows the narration envelope
```

Each stage owns a group, a camera path and optionally its own lights, so five
locations in one film is a list of five entries rather than five engines. Inside a
stage, `shotPicker` cuts between camera setups (wide, close-up, low angle), and
`walkCycle`, `headLook`, `motes`, `snowfall` and `handheld` keep the frame moving. Full
reference in [`docs/scene-kit.md`](docs/scene-kit.md).

What it deliberately does not do: no walk cycles, no IK, no facial animation
beyond the mouth, hard cuts only (no dissolves), and one rig recoloured per
character.

## Quality checks

`qa.py` decodes the finished MP4 at low resolution and reports black frames, blown frames, still runs, hard pops and loudness. It exits non-zero on failure, so CI can gate on it.

```
PASS  0 problem(s), 2 warning(s)
integrated loudness -14.2 LUFS · true peak -1.6 dBTP
```

`make test` builds a three-line film end to end in about two minutes and asserts fourteen things about the result. See [`docs/qa.md`](docs/qa.md).

## Two worked examples

| Folder | Engine | Timing source | Film |
|---|---|---|---|
| `films/everest` | three.js | Piper line alignments | The Mountain Nobody Saw, 36.6 s |
| `films/kuch-bhi-kaise-bechein` | three.js | Piper line alignments | the Hindi shop explainer, 85 s |
| `reference/` | Babylon.js | edge-tts word boundaries | Slow as Molasses, 56.6 s |

`reference/` sits outside `kit/` on purpose. It is the same script-to-frames contract
with a second renderer and a second timing source — word-level rather than line-level —
and it has its own build steps in [`reference/README.md`](reference/README.md).

## Layout

```
kit/            voice, music, mix, render, encode, qa, doctor, build, make
kit/lib/        three.js, loaders, scene-kit, OutlineEffect, Devanagari font, rigged avatar
films/          one directory per film: film.json and scene.js (built on scene-kit)
reference/      a second worked example: Babylon.js, word-level timing
templates/      starter film.json, scene.js and index.html
docs/           format reference, scene-kit, styles, safe areas, speed, portability, qa
assets/         logo and banner
```

## Credits

Built by [@apsideslabs](https://github.com/apsideslabs). Some techniques were adopted from [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT). [`PROVENANCE.md`](PROVENANCE.md) lists exactly what came from where, what we changed, and what we deliberately did not take.

Bundled assets: [three.js](https://threejs.org) (MIT), a Ready Player Me sample avatar, [Noto Sans Devanagari](https://fonts.google.com/noto) (OFL), [Piper](https://github.com/rhasspy/piper) voices. Licences in [`NOTICE.md`](NOTICE.md).

## Licence

MIT. Check the licence of the Piper voice you ship.
