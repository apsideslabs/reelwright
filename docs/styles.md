# Styles

`film.json` → `"style"` picks how the 3D scene is shaded.

| value | look | cost |
|---|---|---|
| `"real"` (default) | lit surfaces, soft shading, photographic-ish | baseline |
| `"toon"` | cel shading with a four-step ramp, plus an inverted-hull ink outline | ~1.0× (see below) |

## Toon

Set `"style": "toon"` and every material is swapped for `MeshToonMaterial` with a stepped gradient map, then the scene is drawn through three.js's `OutlineEffect`, the same inverted-hull outline pass used in anime-style character shading. Flat colours, hard light/shadow bands, thin dark edges.

```jsonc
{
  "style": "toon",
  "grade": { "exposure": 1.28, "lift": [35, 19, 20], "vignette": 0.42 }
}
```

Tuning lives in `makeToon()` in the scene:

```js
const steps = new Uint8Array([70,70,70, 150,150,150, 214,214,214, 255,255,255]);  // 4 bands
// more bands = softer falloff; fewer = harder, more graphic
n.userData.outlineParameters = { thickness: 0.0036, color: [0.05, 0.04, 0.05] };
```

- **Thickness** is in world units per outline pass, around `0.003`–`0.006` reads as ink at 1080p. Thicker looks like a comic, thinner disappears at phone size.
- **Bands**: three or four is the sweet spot. Two looks like a stencil; eight might as well be smooth shading.
- **Outline colour** should be a near-black rather than pure black, for the same reason as the grade's warm black point.

Cost: the outline pass draws the scene a second time, but with a cheap material, so on a CPU renderer the total moved less than expected, roughly 1.0–1.15× a normal frame in testing. Measure on your own scene with `time node kit/render.js`.

## Why not Lottie / Rive / GSAP

These are the usual suggestions, and why they are not used here:

- **Lottie / dotLottie / Rive** are formats for *designed* animation files exported from a motion tool. This pipeline generates every frame from code at a fixed time index, so a state-machine player adds a dependency without adding a capability. If you have a `.riv` or Lottie asset you want in a film, render it in its own pass and composite. It does not belong inside the deterministic frame function.
- **GSAP / Anime.js / Motion** are DOM/SVG timeline engines. The scene already evaluates poses as pure functions of `t`, which is what makes the render resumable and deterministic. A timeline library would fight that, not help it.
- **Remotion** solves the same problem (React components → video) with a licence that is not free above three employees. This kit stays on plain three.js + ffmpeg for that reason.

The only library this needed was three.js's own `OutlineEffect`, already vendored in `kit/lib/jsm/effects/`.

## Effects layer

Cartoon shorts punch beats with sprite effects. `film.json` → `fx` places them in screen space:

```jsonc
"fx": [
  { "at": "l3",  "offset": 2.2, "kind": "impact",  "x": 0.5, "y": 0.40, "dur": 0.55 },
  { "at": "l13", "offset": 2.6, "kind": "sparkle", "x": 0.5, "y": 0.42, "dur": 0.9, "count": 14 }
]
```

`at` is a line id or beat key, `x`/`y` are fractions of the frame, `kind` is `impact` (expanding ring plus radial ticks) or `sparkle` (radiating four-point stars). Both fade out over `dur` and cost nothing, they are Canvas 2D paths drawn after the 3D pass.
