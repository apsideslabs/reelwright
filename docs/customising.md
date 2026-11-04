# Customising a film

## Start from the example

```bash
./new-film.sh my-film
```

This copies `films/kuch-bhi-kaise-bechein/` to `films/my-film/`, rewrites the slug, and clears the generated build. You now have a working film — change it one thing at a time.

## The script

If you started from `python kit/make.py`, the film is already wired. Otherwise copy `templates/film.json` + `templates/scene.js` into `films/my-film/`.

Edit `lines` in `film.json`. Keep ids stable if you want the staging to stay put; if you add lines, add matching `beats` entries. Then:

```bash
python kit/build.py --film films/my-film/film.json
```

Re-run this every time you touch the script. It re-times everything and prints the new total.

## The cast

The kit ships one rigged human (`kit/lib/assets/readyplayer.me.glb`). Characters are clones of it, differentiated by material colour, skin tone, scale and hair:

```js
const ravi = makeHuman({
  top: 0xece2cc,      // shirt colour (flat, texture dropped for a clean look)
  bottom: 0x36454e,   // trousers
  skin: 0xcaa07a,     // skin tint, multiplied over the base texture
  hide: [],           // mesh names to hide: Wolf3D_Headwear, Wolf3D_Beard, ...
  scale: 1.0
});
```

Bones are driven directly — no animation files needed:

```js
const POSE = {
  talk:    { RightArm: [0.16, 0, 0.30], RightForeArm: [0.45, 0, 0.30], Head: [0.04, 0, 0] },
  present: { LeftArm: [0.25, 0, -0.55], RightArm: [0.25, 0, 0.55] }
};
poseHuman(ravi, POSE.talk, 0.9);
```

Angles are radians applied *on top of* the rest pose, so small numbers are safe. `LeftArm`/`RightArm` rotate the shoulder, `ForeArm` the elbow, `Spine`/`Head` the torso and neck.

Lip-sync is automatic:

```js
speak(ravi, mouthAt(t));   // envelope generated from the narration
```

**Want a second, visually distinct character?** Put another GLB in `kit/lib/assets/`, load it alongside, and give it its own `makeHuman`. The bone names must be Mixamo-style (`Hips`, `Spine`, `LeftArm`, …) for the pose table to apply.

## Staging and camera

`cameraAt(t)` returns `{p, l, fov}` — position, look-at, field of view. Keys are plain objects; blend between them with `camLerp`. Add a shot by adding a key and a branch:

```js
const K = {
  wide:   camKey([0.75, 2.35, 7.6], [0.05, 2.15, -2.0], 38),
  medium: camKey([0.30, 2.10, 5.6], [-0.35, 1.95, -2.0], 36)
};
if (t < T.s3) return camLerp(K.wide, K.medium, easeInOut(seg(t, T.s2, T.s2 + 1.6)));
```

For 9:16, visible width is only 56% of visible height — a two-shot needs the camera much further back than instinct suggests. Rule of thumb: at field of view `f` and distance `d`, visible width ≈ `1.125 · d · tan(f/2)`.

## Graphics

All HUD text comes from `film.json → graphics`. To change layout, edit `drawHUD()` in the scene — it is plain Canvas 2D, positioned in pixels for a 1080×1920 frame.

To use a different script, drop a font in `kit/lib/fonts/`, load it near the top of the scene, and change the `font` strings:

```js
const deva = new FontFace('Deva', 'url(./fonts/YourFont.ttf)');
await deva.load(); document.fonts.add(deva);
```

## Look

- `updateMood(t)` — time-of-day grading (sky colour, key light intensity and warmth)
- `renderer.toneMappingExposure` — overall exposure
- The vignette is a Canvas 2D radial gradient in `renderFrame`, essentially free
- Contact shadows are flat gradient planes; real shadow maps cost ~35% of render time on CPU

## Speed

| knob | effect |
|---|---|
| `--query "w=720&h=1280"` | ~2× faster, then encode at that size (or upscale in ffmpeg) |
| `fps: 24` instead of 30 | 20% fewer frames |
| shadows off | ~35% faster, needs fake contact shadows |
| `antialias: false` | ~15% faster, slightly harder edges |

Render time on a 2-core box: **~2–4 s per 1080×1920 frame**. A 60 s film at 24 fps is 1440 frames — budget 60–90 minutes.
