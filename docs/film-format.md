# film.json reference

One file describes a film. Everything the build needs comes from here, narration, timing, on-screen graphics, the score, the grade and the look.

`kit/make.py` writes one for you; this page is what to edit afterwards, and what every field means.

```jsonc
{
  "schema": 1,
  "slug": "my-film",
  "title": "My Film",
  "fps": 24,
  "size": [1080, 1920],
  "style": "toon",
  "safeArea": "all",
  "captions": true,
  "grade": { "exposure": 1.28, "lift": [35, 19, 20], "vignette": 0.42 },
  "voice": { "model": "en_US-lessac-medium", "length_scale": 1.06, "pitch": 0.97 },
  "lead": 1.2, "gap": 0.42, "tail": 1.0,
  "lines": [ { "id": "l1", "text": "Say this first." } ],
  "beats": { "s2": "l2", "s3": "l3" },
  "graphics": { "title": { "heading": "MY FILM" } },
  "fx": [ { "at": "l2", "kind": "sparkle", "count": 12 } ],
  "music": { "bed_gain": 0.4, "cues": [] },
  "audio": { "target_lufs": -14, "ceiling_dbtp": -1.5, "duck_db": -3.5 }
}
```

Every field except `lines` has a default. Unknown fields are ignored, so a newer film still builds on an older kit, until the `schema` says otherwise.

## Top level

| Field | Type | Default | Meaning |
|---|---|---|---|
| `schema` | int | `1` | Format version. `build.py` refuses a film **newer** than it understands rather than mis-rendering it. |
| `slug` | string | filename | Build directory and output filename. |
| `title` | string | `slug` | Human label, printed by the build. Not drawn on screen. |
| `fps` | int | `24` | 24 for a filmic feel, 30 for social-native. |
| `size` | `[w, h]` | `[1080, 1920]` | 9:16. 720×1280 renders ~2× faster; see [speed](speed.md). |

## Look

| Field | Type | Default | Meaning |
|---|---|---|---|
| `style` | `"toon"` \| `"real"` | `"real"` | `toon` = cel shading + ink outlines. See [styles](styles.md). |
| `safeArea` | `"all"` \| `"tiktok"` \| `"reels"` \| `"shorts"` \| `"none"` | `"all"` | Keeps graphics out of the platform UI. See [safe areas](safe-areas.md). |
| `captions` | bool | `true` | Burn the narration in as subtitles, word-wrapped inside the safe area. |
| `captionSize` | number | `44` | Caption size in 1080×1920 units. |
| `grade.exposure` | number | `1.28` | Renderer exposure. Raise until a mid-shot's luma sits near 0.5. |
| `grade.lift` | `[r,g,b]` | `[35, 19, 20]` | Black point. Never `[0,0,0]`, crushed black reads as a dead pixel. |
| `grade.vignette` | number | `0.42` | Corner darkening alpha. ~0.86 corner÷centre is the measured target. |

## Voice and pacing

| Field | Type | Default | Meaning |
|---|---|---|---|
| `voice.model` | string | language default | Any Piper voice id, e.g. `hi_IN-pratham-medium`. |
| `voice.length_scale` | number | `1.06` | >1 is slower. 1.0 is the model's natural pace. |
| `voice.pitch` | number | `0.97` | Resample factor: <1 is deeper and slightly slower. |
| `voice.gain` | number | `0.85` | Pre-mix level. Loudness is normalised later, so this only matters relative to music. |
| `lead` | seconds | `1.2` | Silence before the first line. |
| `gap` | seconds | `0.42` | Silence between lines. |
| `tail` | seconds | `1.0` | Silence after the last line. |

**Nothing downstream contains a timestamp.** Every cut, card and camera move is derived from the measured speech, so changing `length_scale` re-times the whole film.

## `lines`

The script. Each entry becomes one spoken clip, one caption and one beat.

```jsonc
"lines": [
  { "id": "l1", "text": "Everyone said the shop was finished." },
  { "id": "l2", "text": "Then one question changed everything." }
]
```

Keep ids stable: `beats` reference them. If you add a line, add matching beats.

## `beats`

Maps scene keys to lines. The scene reads `T.s2` … `T.s14`, a beat is simply *the moment this line starts*, so a film with three lines can map several beats to the same line.

```jsonc
"beats": { "s2": "l2", "s3": "l3", "s4": "l3" }
```

`T.s1` is always 0. The build refuses a beat pointing at a line id that does not exist.

## `graphics`

Every on-screen panel. Each block is optional, omit it and that panel simply never draws.

| Key | Fields | When it shows |
|---|---|---|
| `title` | `heading`, `sub`, `accent`, `size`, `subSize` | 0.6 s in, for ~4 s |
| `steps` | array of `{n, label, color}` | from `T.s4`, one lit per beat |
| `question` | `label`, `lines[]`, `accent`, `size` | around `T.s3` |
| `proof` | `stars`, `lines[]`, `foot`, `accent` | around `T.s7` |
| `cost` | `line1`, `line2`, `foot`, `accent` | around `T.s12` |
| `sold` | `label` | around `T.s13` |
| `end` | `line1`, `line2`, `foot`, `accent` | final beat |

Text auto-fits its panel. All of it is drawn in Canvas 2D at 1080×1920 and scaled to the output size, so it stays sharp at any resolution.

## `fx`

Screen-space cartoon effects, anchored to a line id or beat key.

```jsonc
"fx": [
  { "at": "l3",  "offset": 2.2, "kind": "impact",  "x": 0.5, "y": 0.40, "dur": 0.55 },
  { "at": "l13", "offset": 2.6, "kind": "sparkle", "count": 14, "dur": 0.9, "color": "#ffe08a" }
]
```

| Field | Default | Meaning |
|---|---|---|
| `at` |, | line id or beat key |
| `offset` | `0` | seconds after that anchor |
| `kind` |, | `impact` (ring + ticks) or `sparkle` (radiating stars) |
| `x`, `y` | `0.5`, `0.45` | position as a fraction of the frame |
| `dur` | `0.6` | seconds |
| `count`, `scale`, `seed`, `color` |, | appearance |

## `music`

A score described as cues, synthesised from sine waves, no samples, no licensing.

```jsonc
"music": {
  "bed_gain": 0.42,
  "cues": [
    { "at": "l1", "inst": "pad",   "note": "C3", "dur": 9 },
    { "at": "l1", "inst": "pluck", "every": 1.15, "count": 6 },
    { "at": "l13", "inst": "coin", "offset": 2.5 }
  ]
}
```

Instruments: `pad`, `pluck`, `bell`, `pop`, `whoosh`, `coin`. A cue fires at its anchor plus `offset`; with `every` and `count` it repeats, and `notes[]` cycles a phrase.

## `audio`

| Field | Default | Meaning |
|---|---|---|
| `target_lufs` | `-14` | Integrated loudness. −14 suits Reels/Shorts, −16 podcast, −23 broadcast. |
| `ceiling_dbtp` | `-1.5` | True-peak ceiling. |
| `duck_db` | `-3.5` | How far the score dips under speech. |

The ducking envelope is measured from the narration itself, so it re-times when the script changes.

## Validating

```bash
python kit/doctor.py                       # every film parses
python kit/build.py --film films/x/film.json --steps site   # catches bad beats
```

CI runs the same checks on every push.
