# Provenance

What in this repository is ours, what came from somewhere else, what we changed, and what we deliberately left alone.

If you are auditing the licence or the originality of any part of it, this page is the answer. `grep -rn "mromidev" .` lists every reference in the tree.

## Ours

Everything that makes this a working tool:

| Part | What it does |
|---|---|
| `kit/build.py` | the pipeline: stages, caching, parallel render, schema check |
| `kit/make.py` | text in, video out |
| `kit/voice.py` | Piper narration, measured timings, lip-sync envelope, word timings |
| `kit/music.py` | procedural score from sine waves and noise |
| `kit/mix.py` | ducking, loudness target, stems, mix report |
| `kit/render.js` | headless frame renderer: backend chain, page recycling, crash recovery, resume |
| `kit/encode.py`, `kit/qa.py`, `kit/doctor.py`, `kit/selftest.py` | encode, frame and loudness checks, environment report, end-to-end test |
| `films/*/scene.js` and `templates/scene.js` | the scene engine: character rig and posing, camera system, Canvas 2D graphics, safe areas, karaoke captions |
| `film.json` | the format, its schema and defaults |
| `docs/` | every page except the measured numbers credited below |

## Taken from elsewhere, and what changed

The source is [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts), MIT licensed. Nothing below is copied code: each is an idea reimplemented for a different renderer, or a measured number used as a target.

| Taken | Licence | What we took | What we changed |
|---|---|---|---|
| Frame-level QA | MIT (their `short_qa.py`) | the checks (black, blown, still, pop), the contact sheet, the report shape | Rewritten in numpy. Chunked so a long film does not exhaust a 2 GB box. Stills demoted from failure to warning. Added `--ignore` and CI exit codes. |
| Loudness-targeted mixing with voice-keyed ducking | MIT (their `mix.py`) | the approach: duck under speech, master to an integrated target, emit stems | Reimplemented in numpy with ITU-R BS.1770 K-weighting. Music is a separate stem rather than pre-mixed. Fixed a limiter that added ~2.6 dB below the ceiling. |
| The camera never stops | MIT (their motion report) | the rule and the ~0.14 %/frame figure | Implemented as a constant push on top of every camera key in `scene.js`. |
| Reactions land 0 to 3 frames before the word | MIT (their `SKILL.md`) | the timing rule | Written into `docs/craft.md`, and it is why word-level timings now exist. |
| Four-frame blink: half, shut, shut, half | MIT (their characters report) | the shape | Implemented in `blinkAt()`. Replaced our symmetric V, which read as a flinch. |
| Grade targets: warm black point (35, 19, 20), corner/centre 0.86, p99 near 1.0 | MIT (their grade report) | the numbers | Implemented as the `grade` block. Applied last in the capture pass so the vignette cannot re-crush the corners. |

## Not taken, on purpose

**The 38 reference frames and 20 contact sheets.** These are screenshots of a third party's YouTube channel. The repository's own style bible opens with "private study only, never upload, publish or send them", and an MIT licence on the repository cannot grant rights the repository's author never held. We read them to extract measurements; no frame, crop or sheet is copied into this repository, and none should be. The same applies to the videos themselves.

**Their TypeScript and Remotion scene code.** A different renderer and a different art direction (flat 2D characters inside a painted 3D world). None of it would run here without a Remotion project, and it would not fit this scene's realistic avatar.

**The style bible's text.** Summarised as principles in `docs/craft.md`, not reproduced.

## Third-party assets bundled

| File | Origin | Licence |
|---|---|---|
| `kit/lib/three.module.js` | three.js r169 | MIT |
| `kit/lib/jsm/loaders/GLTFLoader.js`, `jsm/utils/*` | three.js examples | MIT |
| `kit/lib/jsm/effects/OutlineEffect.js` | three.js examples | MIT |
| `kit/lib/assets/readyplayer.me.glb` | three.js examples, Ready Player Me sample avatar | free for use, see Ready Player Me terms |
| `kit/lib/fonts/NotoSansDevanagari.ttf` | google/fonts | SIL Open Font Licence 1.1 |

Piper voices are **not** bundled. They download into `voices/` on first use and are gitignored. Each voice carries its own licence; most are CC-BY or public domain, so check the one you ship.

## Platform safe areas

The margins in `docs/safe-areas.md` come from Meta's Reels ad guidance, TikTok's in-feed safe-zone file and Google's vertical-video ad guidance, plus community measurement where a platform publishes no figure. They are not from the animated-shorts repository. Numbers and dates are in that document.

## If you take from here

Same deal in reverse: this repository is MIT, so take what you like, but credit it and keep the same freedom for whoever comes next. If you borrow an idea that is itself credited above, credit the original too.
