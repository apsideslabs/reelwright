# Changelog

Notable changes, newest first. Versioning is SemVer; the film format is frozen at `schema: 1`.

## 2.1.0 (2026-11-04)

- **Word-level timings.** `voice.py` writes `words.json`: every word with its line, start and end. Derived from the audio, so it works for any Piper language rather than depending on a model's alignment pass.
- **Karaoke captions.** The word being spoken is highlighted in an accent colour. Configurable with `captionAccent`.
- **`PROVENANCE.md`.** A full ledger: what is ours, what came from where, what changed, and what was deliberately not taken (the reference frames, which are a third party's work and marked private study by their own repository).
- Fixed: word-by-word caption drawing inherited `textAlign: center`, so words were centred on their own x and collided. Left-aligned during the word pass.

## 2.0.1 (2026-11-04)

Documentation pass. No behaviour changes.

- Rewrote `README.md`, `START-HERE.md` and this file in plainer language, and removed a roadmap section that listed things not yet built.
- `docs/film-format.md` now documents every field in `film.json`. It previously covered four of twenty, which would have misled anyone editing a film by hand.
- `docs/customising.md` gave a build command missing the `mix` step, and predated `kit/make.py`.
- `.cache/` is gitignored, so the renderer backend cache cannot be committed.
- Removed the committed `films/kuch-bhi-kaise-bechein/timings.json`. It is a build artefact that goes stale as soon as the script changes, which is the exact failure the stale-cache guard exists to catch.

## 2.0.0 (2026-11-04)

First stable release.

- Graphics backend chain: hardware, then Mesa llvmpipe, then SwiftShader, with automatic fallback on failure and the working backend cached in `.cache/`.
- `kit/doctor.py` and `make doctor`: OS, architecture, runtimes, Chromium, GPU, Mesa, display, ffmpeg, Python packages, voice models, and whether every film parses.
- `film.json` carries `schema`; `build.py` refuses a newer schema instead of mis-rendering it.
- Dependabot for pip, npm and GitHub Actions.

## 1.6.0 (2026-11-04)

Speed work.

- Hardware GPU detected automatically, and the chosen renderer printed at the start of every render.
- `--draft` renders 540x960 at 20 fps, about four times faster.
- `--workers N` renders slices in parallel. Measured slower on a two-core box, so it is off by default.
- Render time estimate printed before a build starts.

## 1.5.0 (2026-11-04)

Made it usable by people who do not write code.

- `kit/make.py`: text in, video out.
- `setup.sh` and `START-HERE.md`.
- Automatic captions, wrapped inside the safe area.
- `templates/scene.js`, so a new film needs no scene code.
- Fixed: the HUD did not scale, so rendering at 720x1280 drew titles outside their panels. The overlay now draws through a transform from a fixed 1080x1920 space.
- Fixed: long titles overflowed their card; text now auto-fits.
- Fixed: a changed script left a stale voice cache, so beats pointed at lines that no longer existed.
- Fixed: long renders died when the browser ran out of memory around frame 120 to 180. The page is recycled every 60 frames, and a crash restarts the browser and retries the frame.

## 1.4.0 (2026-11-04)

- Platform safe areas: every graphic is laid inside the box TikTok, Reels and Shorts leave clear. `?safe=1` draws the covered zones.
- `kit/selftest.py`: a three-line film through every stage, fourteen assertions, about two minutes.
- `qa.py --ignore` for checks that are acceptable on a given film.
- Fixed: the six-step checklist overflowed the platform UI on the bottom and right; the proof and cost cards overflowed the bottom edge.
- Fixed: the checklist collided with the proof card, and toon mode was double-exposed.

## 1.3.0 (2026-11-03)

- `style: "toon"`: cel shading with a four-step ramp plus ink outlines via three.js `OutlineEffect`.
- `fx` cues for screen-space impact rings and sparkles.
- Fixed: the gradient map needs `RGBAFormat`. `RGBFormat` was removed from three and silently rendered the scene near-black.

## 1.2.0 (2026-11-03)

- Grade pass: warm black floor, exposure and vignette, configurable per film. The default lands the black point on (35, 19, 20) rather than crushed blue-black.
- Four-frame blink, replacing a symmetric V.
- `docs/craft.md`: measured targets for picture, timing, motion and structure.

## 1.1.0 (2026-11-03)

- `kit/mix.py`: voice-keyed ducking, ITU-R BS.1770 loudness target, true-peak ceiling, stems and a mix report.
- `kit/qa.py`: black, blown, still and pop detection, EBU R128 loudness, contact sheet, CI exit codes.
- Constant camera push, so no shot is dead still.
- Renamed from `vertical-explainer-kit` to Reelwright.
- Fixed: the soft limiter was adding about 2.6 dB below the ceiling.
- Fixed: `render.js` accepted only `--flag=value`.

## 1.0.0 (2026-11-03)

- First pipeline: `voice.py`, `music.py`, `render.js`, `encode.py`, `build.py`.
- Timeline generated from measured narration.
- Canvas 2D motion-graphics layer.
- Worked example: an 85-second Hindi explainer.
