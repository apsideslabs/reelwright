# Changelog

All notable changes to Reelwright. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/).

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
