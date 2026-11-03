# Contributing to Reelwright

Thanks for looking. This is a small, opinionated pipeline — the fastest way to help is to use it on a real film and tell us where it hurt.

## The three things that actually help

1. **A new worked film.** A `films/<slug>/` with a `film.json` and a `scene.js` that renders is worth more than any amount of documentation. Different language, different story shape, different pacing — all valuable.
2. **A second rigged avatar** in `kit/lib/assets/`. Right now every cast member shares one face; that is the kit's biggest visual limitation.
3. **Speed.** Anything that makes the CPU render path meaningfully faster without wrecking the look. Include before/after numbers from `node kit/render.js` on the same frame range.

## Before you open a PR

```bash
python -m py_compile kit/*.py            # python syntax
node --check kit/render.js               # js syntax
make preview FILM=films/kuch-bhi-kaise-bechein/film.json   # renders 3 stills
python kit/qa.py --video <your>.mp4 --out /tmp/qa          # must pass
```

Attach one frame from your film to the PR. A picture settles most review questions.

## Ground rules

- **No timestamp may be hard-coded in a scene.** If it is not derived from `T` (which comes from measured audio), it does not merge.
- **The HUD stays in Canvas 2D.** It is a deliberate choice — 3D text gets clipped by 9:16 framing and shears under perspective.
- **Anything costing more than ~10 % of frame time needs a justification** in `docs/architecture.md`, with the measurement.
- **Credit borrowed techniques.** If you take an idea from another project, add it to `CREDITS.md` with a link. We would rather over-credit than quietly lift.

## Commit messages

`area: what changed and why` — e.g. `mix: derive the ducking envelope from narration RMS`. The "why" matters more than the "what"; the diff already shows the what.

## Reporting a bug

Use the issue template. The single most useful thing you can include is the **first 40 lines of the render log** plus the output of `python kit/qa.py`.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
