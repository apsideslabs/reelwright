# Changelog

All notable changes to Reelwright. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/).

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
