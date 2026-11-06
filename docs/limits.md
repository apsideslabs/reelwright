# Scope and limits

Read this before opening an issue. It is what the tool does, what you have to
write yourself, and where the quality stops.

## What you get from a script, with no code

`python kit/make.py script.txt` gives you a real film: one set (the worked shop
scene in `templates/scene.js`), a Piper voice, a synthesised score, burned-in
captions, the cards driven by `film.json`, one camera move, and an MP4.

It is one look, one location, one character. That is the whole no-code path.

## What needs you to write code

- **A location that is not the shop.** You write a `scene.js`. The Everest film is
  about 500 lines for five locations.
- **More than one camera angle in a location.** `shotPicker` inside a stage.
- **A character that moves.** `walkCycle` and `headLook`, called per frame.
- **Graphics the `graphics` block does not cover.** You draw them in the HUD.

So "a text file becomes a video" is true for one look. A film that looks like the
Everest one is a scene file, not a JSON file. Both are in the repo; the difference
is a few hundred lines.

## The quality ceiling

- **Stylised, not photoreal.** Lambert materials, no textures, no HDRI, no global
  illumination. Deliberate: it renders on a CPU.
- **One rigged avatar**, recoloured per character. Four people in a film share a
  face and a build.
- **No walk-cycle clips.** The legs and arms are driven by a sine wave. It reads as
  walking at phone size; it does not survive a full-body close-up.
- **No facial animation** except `mouthOpen` and `mouthSmile`.
- **Hard cuts only.** No transitions, wipes or dissolves.
- **Text lives in Canvas 2D**, not in the 3D world. No perspective text, no text
  that occludes geometry.
- **No motion blur, depth of field or bloom.**

## Performance, measured

On a 2-core, 2 GB box with no GPU (SwiftShader):

| Output | s/frame | 60 s film |
|---|---|---|
| 1080×1920 | 2.51 | ~60 min |
| 720×1280 | 1.17 | ~28 min |
| 540×960 | 0.79 | ~19 min |

With a GPU it is minutes, not tens of minutes; `render.js` detects one and says
which path it took in the first line of the log. Full breakdown in
[speed](speed.md).

## What it is not

- **Not an AI video generator.** No diffusion, no model inventing imagery.
  Every pixel is geometry and code you can read.
- **Not a video editor.** No timeline UI. You edit `film.json` and `scene.js`.
- **Not a lip-sync model.** The mouth follows the narration's RMS envelope, not
  phonemes, so it is approximate by design.
- **Not multilingual beyond Piper's voices**, and captions use one bundled font.

## Things that will bite you

Learned by shipping the two films in this repo, not by reading about it.

- `ShapeGeometry`/earcut drops vertices on hand-built height profiles. The kit
  triangulates strips itself in `strip()` for this reason.
- The browser leaks memory over a long render. `render.js` recycles the page every
  60 frames and retries a single frame after a crash.
- Rename line ids by hand and the beats point at nothing. `build.py` refuses to
  build, which is the intended behaviour.
- The first frame after a browser launch can carry a stale texture upload; see the
  note in [`reference/README.md`](../reference/README.md).
- A locked-off camera reads as a still image. That is why `handheld()` exists.

## When something else is the right tool

- Photoreal people: Blender, Unreal, or a diffusion pipeline.
- Live action: not this.
- A one-off chart explainer: matplotlib plus ffmpeg is less work.
- Many films from one template with your own brand assets: this is the sweet spot.
