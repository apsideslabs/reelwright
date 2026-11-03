# Quality control

`kit/qa.py` is the last step of the build and the first place to look when something feels wrong.

```bash
python kit/qa.py --video build/my-film/my-film.mp4 --out build/my-film/qa --frames build/my-film/qa
```

It writes `qa/qa-report.md` and, with Pillow installed, `qa/contact-sheet.jpg` — 20 frames across the film with frame numbers burned in.

## What it checks

| Check | Threshold | Meaning |
|---|---|---|
| **black** | mean luma < 0.035 | a dead scene, a broken camera, or a fade longer than `--allow-black` |
| **blown** | mean luma > 0.95 | an exposure mistake |
| **still runs** | ≥ 12 frames with motion < 0.015 | a held camera — *warning*, not failure |
| **pops** | frame difference > 3× local median + 1 | an unplanned flash or a cut in the wrong place |
| **true peak** | > −1 dBFS | the mix will clip on loud playback |
| **loudness** | reported (EBU R128) | aim for −14 LUFS for social, −16 for podcast, −23 for broadcast |

Stills are a warning rather than a failure on purpose: a genuinely held shot can be the right choice. But a shot where *nothing at all* moves for half a second reads as a stall, so it is worth knowing about every time.

Fades at the head and tail are excluded from the still check, and near-black frames are excluded too — a fade from black is not a frozen frame.

## Exit codes

`0` pass, `1` fail. That is deliberate: it drops straight into CI.

```yaml
- run: python kit/qa.py --video out/film.mp4 --out out/qa
```

## Reading a failure

- **Black frames in the middle** — a scene threw during setup and rendered an empty frame. Look for `[pageerror]` in the render log.
- **Pops at a cut** — two shots with very different brightness. Either cross-fade, or move the cut to a moment where the eye is already moving.
- **Still runs** — add the constant push-in (it is already in the worked example's `scene.js`) or shorten the hold.
- **True peak too hot** — raise `--ceiling` in `mix.py`, or lower the loudness target. Do not just turn the whole mix down; the point of the target is consistency between films.

## Manual review still matters

QA catches mechanical failures, not bad storytelling. Watch the film once at full size with sound before you ship it. The contact sheet is for spotting a broken shot across 85 seconds in five seconds — not a substitute for watching.
