# Contributing

Useful contributions, in rough order of value:

1. **Another worked film.** A `films/<slug>/` with a `film.json` and a `scene.js` that renders is the best documentation there is.
2. **A second rigged avatar** in `kit/lib/assets/` so casts stop sharing a face.
3. **Speed.** Any change that makes the CPU render path meaningfully faster without wrecking the look.
4. **Voices.** Verified Piper voice ids for languages not yet covered, added to `docs/film-format.md`.

## Ground rules

- No timestamp may be hard-coded in a scene. If it is not derived from `T`, it does not merge.
- Keep the HUD in Canvas 2D. It is a deliberate choice, not an accident.
- Anything that costs more than ~10% of frame time needs a note in `docs/architecture.md` explaining why it earns it.
- Run `make preview` before opening a PR; attach one frame.
