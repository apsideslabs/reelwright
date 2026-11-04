# Contributing

This is a small pipeline. The most useful thing you can do is use it on a real film and report where it hurt.

## What helps most

1. **A new worked film.** A `films/<slug>/` with a `film.json` and a `scene.js` that renders is worth more than any amount of documentation. A different language, story shape or pace is all useful.
2. **A second rigged avatar.** Every cast member currently shares one face, which is the biggest visual limitation here.
3. **Speed.** Anything that makes the CPU render path faster without hurting the look. Include before and after numbers from `node kit/render.js` on the same frame range.

## Before opening a pull request

```bash
python -m py_compile kit/*.py
node --check kit/render.js
make doctor                                  # environment report
make test                                    # three-line film, end to end, 14 checks
python kit/qa.py --video <your>.mp4 --out /tmp/qa
```

Attach one frame from a film the change affects. It settles most review questions.

## Rules

- No timestamp may be hard-coded in a scene. If it does not come from `T`, which comes from the measured audio, it does not merge.
- The HUD stays in Canvas 2D. 3D text gets clipped by vertical framing and shears under perspective.
- Anything that costs more than about 10 percent of frame time needs a measurement in the pull request.
- If you take an idea from another project, add it to `CREDITS.md` with a link.

## Commit messages

`area: what changed and why`, for example `mix: derive the ducking envelope from narration RMS`. The why matters more than the what.

## Reporting a bug

Use the issue template. The most useful things to include are the first forty lines of the render log and the output of `python kit/qa.py`.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
