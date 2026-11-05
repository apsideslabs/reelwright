# scene-kit — stages, cast, lights, HUD

`kit/lib/scene-kit.js` is the reusable half of a film. Before 2.1 every film
re-invented the renderer, the lights, the cast, the camera path and the HUD
inside its own `scene.js`; `templates/scene.js` was 1,100 lines of exactly that,
wired to one shop set. This module is that work, extracted and parameterised.

A film's `scene.js` becomes a description of its sets instead of an engine.

```js
import * as K from './scene-kit.js';

const app = K.createApp({ w: 1080, h: 1920, exposure: 1.22, shadows: true });
const rig = await K.loadRig('./assets/readyplayer.me.glb');
const envelope = await fetch('./envelope.json').then(r => r.json());

const stages = K.createStages(app.scene, [
  { key: 'office', t0: -1, t1: T.s3, build: office },
  { key: 'plain',  t0: T.s3, t1: T.s7, build: plain }
]);

const hud = K.makeHud({ film: FILM, lines: LINES, safe: K.SAFE });
K.run(app, { fps: FPS, dur: DUR, hud, update: t => stages.update(t) });
```

## Stages

`createStages(scene, defs)` takes a list of `{ key, t0, t1, build }`. `build(group)`
adds meshes to that stage's group and returns `{ camera(u), update(t, u) }`.

- Only one stage is visible at a time, so a film can cut between locations.
- `t0`/`t1` are seconds, normally beat times from `timeline.js` (`T.s3`), so the
  cut follows the measured speech instead of a hand-typed number.
- `camera(u)` gets the stage's local progress 0..1, eased; `update(t, u)` gets
  absolute time.
- Cuts are hard. There is no built-in cross-fade; a fade belongs in the HUD.
- Lights inside a stage's group are only active while that stage is visible.

## Cast

```js
const rig = await K.loadRig('./assets/readyplayer.me.glb');   // 67 bones, RPM sample
const clerk = K.makeHuman(rig, {
  height: 1.70, top: 0x35507a, bottom: 0x1e2434, skin: 0x9a7150,
  hide: ['Wolf3D_Headwear', 'Wolf3D_Beard']
});
clerk.root.position.set(0.75, 0, -3.9);
group.add(clerk.root);

K.poseHuman(clerk, K.POSE.write);          // bone quaternions, blended from rest
K.speak(clerk, K.mouthAt(envelope, t));    // mouth from the narration envelope
```

- `makeHuman` clones the rig, converts PBR materials to Lambert, recolours
  outfit/skin/hair, scales to a height in metres, drops the feet to y=0 and adds
  a contact shadow.
- `POSE` ships `idle, talk, present, pointUp, listen, write, sad, happy`. They are
  static blends from the rest pose — no walk cycle, no IK.
- `mouthAt(envelope, t)` reads the RMS envelope `voice.py` already writes, so lip
  movement matches the narration with no extra pass.
- `speaking(lines, id, t)` says whether a line is being spoken, which is how a
  stage decides who moves their mouth.

## Lights

`K.threePoint(group, opts)` builds key/fill/rim plus ambient and an optional
practical point light. Only the key casts shadows.

```js
K.threePoint(group, {
  keyColor: 0xffc98a, keyIntensity: 3.4, keyPos: [3.6, 3.6, 2.2], shadowMap: 512,
  fillColor: 0x7d9ac6, fillIntensity: 2.1,
  ambientColor: 0x8fa2bd, ambient: 2.3,
  practical: { color: 0xffcf94, intensity: 16, distance: 10, pos: [0.6, 2.9, -2.2] }
});
```

Shadow maps are the expensive part on a CPU rasteriser: 512 is enough at 720p, and
`shadows: false` plus the contact shadow is the cheap option that still reads.

## Geometry helpers

`mat`, `flat`, `plane`, `box`, `cyl`, `canvasTex`, `gradientTex`, `softDot`,
`strip` (a height profile over x, triangulated by hand because `ShapeGeometry`
drops vertices on these profiles), `ridgePts`, `snowLine`, `peakGroup`,
`contactShadow`.

## HUD

`makeHud({ film, lines, safe })` draws the title card, steps panel, proof card,
end card, burned-in captions and the vignette inside the platform safe area.
Timing comes from `times: { stepsIn, stepsOut, stepBeats, proofIn, proofOut }`.
Cards sit in the left column (`column: {x, w}`) so they do not cover the subject.

## What this does not do

- No walk cycles, no IK, no facial animation beyond `mouthOpen`/`mouthSmile`.
- One rig, recoloured per character. Distinct faces need distinct GLBs.
- Hard cuts only; no transitions, wipes or dissolves.
- No automatic framing: you place the camera and the props yourself, per stage.

That is the honest boundary. A walking crowd is not something this kit will give
you.

## Motion, shots and life

A locked-off camera on a still set reads as a slideshow. Three additions fix that.

**Shots.** `K.shotPicker([{ t0, t1, cam(u, t) }])` returns `pick(t)`: it selects the
active camera setup and runs its move. A stage can cut several times — wide to
close-up — without becoming a new stage.

```js
const pick = K.shotPicker([
  { t0: -1,     t1: T.s2, cam(u, t) { /* wide, walking in */ } },
  { t0: T.s2,   t1: 999,  cam(u, t) { /* close-up */ } }
]);
return { camera(u, t) { pick(t); }, update(t) { /* ... */ } };
```

**A moving cast.** The rig has no animation clips, so `K.walkCycle(h, t, opts)`
drives the legs and arms procedurally, and `K.headLook(h, yaw, pitch)` turns the
head. Keep character position a pure function of `t`
(`root.position.x = K.lerp(a, b, K.smooth(K.seg(t, t0, t1)))`) so a resumed render
matches an uninterrupted one.

**Life in the frame.** `K.motes()` for dust or far clouds, `K.snowfall()` for snow,
`K.handheld(t, amp)` for a few tenths of a degree of camera drift, and
`K.windowOpening()` to cut a real hole in a wall so the same mountain can be seen
outside every interior — which is what makes five locations feel like one world.

All of it is deterministic: no `Math.random`, no `Date`, no state carried between
frames.
