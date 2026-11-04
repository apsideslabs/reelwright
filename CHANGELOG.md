# Changelog

All notable changes to Reelwright. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/).

## [2.0.0] — 2026-11-04

First stable release. The film format is frozen at `schema: 1`; anything that changes it will ship with a migration.

### Fixed
- **`docs/film-format.md` was two versions stale.** It documented four fields out of twenty and would have misled anyone editing a film by hand. Rewritten as a complete reference: every field, its type, default and meaning, plus the graphics and `fx` tables.
- `docs/customising.md` documented a build command missing the `mix` step, and predated `make.py`.
- `.cache/` was not gitignored, so the renderer backend cache could be committed.
- `films/kuch-bhi-kaise-bechein/timings.json` was committed. It is a build artefact that goes stale the moment the script changes — the exact failure the stale-cache guard exists to prevent. Removed; the voice step regenerates it.

### Verified
- `python kit/doctor.py` → 11 ok, 2 expected warnings (no GPU, headless), 0 failures.
- `python kit/selftest.py` → 14/14 checks: voice, music, mix, site, render, encode, QA on a real three-line film.

## [1.7.0] — 2026-11-04

### Added
- **Graphics backend chain with automatic fallback**: hardware → Mesa llvmpipe (`--use-angle=gl`, ~4× faster than SwiftShader on CPU-only Linux) → SwiftShader. The scene initialises on the first backend that works; the winner is cached in `.cache/backend.json`. Pin with `--backend=`, forbid hardware with `--gpu 0`.
- **`kit/doctor.py` / `make doctor`** — OS, architecture, runtimes, Chromium, GPU, Mesa, display, ffmpeg, Python packages, voice models, and whether every film parses. Non-zero exit on failure.
- **`docs/portability.md`** — the four seams (film.json, narration+timings, scene.js, frames+mix), how to replace each, what is guaranteed and what is not.
- `"schema": 1` on `film.json`; `build.py` refuses a newer schema instead of mis-rendering it.
- `.github/dependabot.yml` — weekly dependency PRs, CI-checked.

### Changed
- `render.js` reports the backend and the actual GL renderer string on every run, so a silent software fallback is visible in the first two lines of the log.

## [1.6.0] — 2026-11-04

### Added
- **GPU rendering, detected automatically.** `render.js` switches to hardware GL when `/dev/dri` exists, and prints which renderer it chose. `--gpu 1` / `--gpu 0` to force. Software rendering is the reason a minute of video takes an hour; hardware is 20–50× faster.
- **`--draft`** in `make.py`: 540×960 at 20 fps, about 4× faster, for checking timing and wording.
- **`--workers N`** parallel rendering for machines with spare cores.
- **Render time estimate** printed before a build starts.
- `docs/speed.md` — measured numbers and the levers, best first.

### Changed
- README performance table now carries measured figures instead of estimates.

## [1.5.0] — 2026-11-04

### Added
- **`kit/make.py` — the one command.** `python kit/make.py "your words"` writes the film, picks a voice for the language, turns on captions and builds it. No JSON, no JavaScript.
- **`setup.sh`** — one-time install with a Chromium check.
- **`START-HERE.md`** — the beginner path, five sections.
- **Automatic captions** — every film gets the narration burned in, word-wrapped inside the safe area, with `"captions": false` to turn them off.
- **`templates/scene.js`** — a default scene, so a new film needs no scene code at all.

### Fixed
- The HUD did not scale: rendering at 720×1280 (the documented fast path) drew titles outside their panels. The whole overlay now draws through a transform from a fixed 1080×1920 space.
- Long titles overflow their card — text now auto-fits.
- A changed script left a stale voice cache, so beats pointed at lines that no longer existed. The cache is now invalidated when the line ids differ.
- Long renders died when the browser ran out of memory around frame 120–180. The page is now recycled every 60 frames, and a crash restarts the browser and retries the frame instead of failing the film.

## [1.4.0] — 2026-11-04

### Added
- **Platform safe areas.** `safeArea` in `film.json` (`all`, `tiktok`, `reels`, `shorts`, `none`) lays every graphic inside the box TikTok, Reels and Shorts leave clear — x 120–880, y 290–1240 on a 1080×1920 frame. `?safe=1` on the render URL draws the covered zones for checking. See `docs/safe-areas.md`.
- **`kit/selftest.py`** — builds a three-line film at low resolution through every stage and asserts the artefacts and the QA verdict. `make test`, ~2 minutes, 14 checks.
- `qa.py --ignore` and `build.py --qa-ignore` for checks that are legitimately acceptable on a given film.
- `make qa` and `make test` targets.

### Fixed
- The six-step checklist overflowed the platform UI on the bottom and right — the last two steps were hidden under TikTok's caption block. Proof and cost cards overflowed the bottom edge.
- The checklist no longer collides with the proof and cost cards; it steps aside for those beats.
- Toon mode was double-exposed (a compensation for the broken ramp that the RGBA fix made unnecessary).

## [1.3.0] — 2026-11-03

### Added
- **`style: "toon"`** — cel shading (`MeshToonMaterial` with a four-step ramp) plus an inverted-hull ink outline via three.js `OutlineEffect`. One flag switches the whole scene from lit to cartoon.
- **`fx` cues** — screen-space cartoon effects (`impact`, `sparkle`) anchored to a line or beat.
- `docs/styles.md` — how toon mode works, how to tune it, and why Lottie/Rive/GSAP are deliberately not used.

### Changed
- `kit/lib/jsm/effects/OutlineEffect.js` vendored (three.js r169, MIT).

## [1.2.0] — 2026-11-03

### Added
- **Grade pass.** `grade` block in `film.json` (`exposure`, `lift`, `vignette`) applied in the capture step: warm black floor via a one-line `lighten` composite, exposure, and a measured vignette. Defaults land the black point on (35,19,20) instead of crushed blue-black.
- **Four-frame blink** (half, shut, shut, half) replacing a symmetric V.
- `docs/craft.md` — measured targets for picture, timing, motion and structure, with the numbers to check a frame against.

### Changed
- Vignette strength is now configurable and defaults lighter (0.42 alpha at the corners, ~0.86 corner/centre).

## [1.1.0] — 2026-11-03

### Added
- `kit/mix.py` — loudness-targeted mastering: voice-keyed ducking, ITU-R BS.1770 integrated loudness, true-peak ceiling, stems and a readable `mix-report.md`. Music is now a separate stem instead of being pre-mixed.
- `kit/qa.py` — per-frame QA (black, blown, still, pop) plus EBU R128 loudness, silences and a contact sheet. Exits non-zero on failure for CI.
- Constant camera push-in, so no shot is ever dead still.
- `assets/logo.svg`, `assets/banner.svg`, README badges and stills.
- `CREDITS.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CITATION.cff`, issue and PR templates, CI workflow.

### Changed
- Renamed from `vertical-explainer-kit` to **Reelwright**.
- `build.py` gains `mix` and `qa` steps; the default chain is now voice → music → mix → site → render → encode → qa.
- Soft limiter now unity-gain below the ceiling (it was adding ~2.6 dB).

### Fixed
- `render.js` accepted only `--flag=value`; it now accepts `--flag value` too.

## [1.0.0] — 2026-11-03

### Added
- Initial pipeline: `voice.py`, `music.py`, `render.js`, `encode.py`, `build.py`.
- Data-driven timeline generated from measured narration.
- Canvas 2D motion-graphics layer.
- Worked example: an 85-second Hindi explainer, `films/kuch-bhi-kaise-bechein/`.
