# film.json reference

One file describes a film. Everything the build needs comes from here.

```jsonc
{
  "slug": "my-film",              // used for the build directory and the mp4 name
  "title": "My Film",             // human label, printed by the build
  "fps": 24,                      // 24 for a filmic feel, 30 for social-native
  "size": [1080, 1920],           // 9:16. 720x1280 also works and renders ~2x faster

  "voice": {
    "model": "hi_IN-pratham-medium",  // any Piper voice id; downloaded automatically
    "length_scale": 1.09,             // >1 = slower delivery
    "pitch": 0.955,                   // <1 = deeper (and slightly slower still)
    "noise_scale": 0.6,               // lower = flatter, more even read
    "noise_w": 0.72,                  // lower = less expressive timing
    "gain": 0.85
  },
  "lead": 1.3,   // silence before the first line, seconds
  "gap": 0.52,   // silence between lines
  "tail": 1.2,   // silence after the last line

  "lines": [
    { "id": "l1", "text": "First line of narration." },
    { "id": "l2", "text": "Second line." }
  ],

  // map scene keys to line ids — the scene timeline is built from these
  "beats": {
    "s2": "l2",
    "s3": "l3"
  },

  "graphics": { /* see below */ },
  "music":    { /* see below */ }
}
```

## `lines`

`id` is any string; the scene refers to beats by line id. `text` is spoken verbatim. Write for the ear: short sentences, full stops where you want a pause. The Hindi example runs ~8 s for a 20-word line, so budget **roughly 2.5 words per second**.

## `beats`

Maps the scene's named moments (`s2`…`s14` by convention, `s1` is always 0) to the line that starts them. `build.py` writes these into `timeline.js` as `T.s2`, `T.s3`, … using the *measured* start time of that line. Your scene code then writes `T.s4` instead of a magic number.

## `graphics`

Every on-screen word. All fields are optional — omit a block and that graphic simply never appears.

```jsonc
"graphics": {
  "title":    { "heading": "...", "sub": "...", "accent": "#e8b64c", "size": 72 },
  "question": { "label": "सवाल", "lines": ["line one", "line two"], "accent": "#e8b64c" },
  "steps":    [ { "n": "1", "label": "Problem", "color": "#e0574a" } ],
  "proof":    { "stars": "★★★★★", "lines": ["quote"], "foot": "1,240 customers", "accent": "#5ab86a" },
  "cost":     { "line1": "2 hours × 365", "line2": "= 730 hours", "foot": "cost of waiting", "accent": "#e0574a" },
  "sold":     { "label": "SOLD" },
  "end":      { "line1": "Sell the outcome", "line2": "not the product", "foot": "problem · … · close" }
}
```

The HUD draws any script the browser font can render — Devanagari, Latin, Tamil. See `docs/customising.md` for swapping the font.

## `music`

A list of cues. Each cue is placed at a line id (plus optional `offset`) and either fires once or repeats.

```jsonc
"music": {
  "bed_gain": 0.42,          // overall music level under the voice
  "cues": [
    { "at": "l1",  "inst": "pad",   "note": "C3", "dur": 9, "gain": 1.0 },
    { "at": "l1",  "inst": "pluck", "offset": 0.3, "every": 1.15, "count": 6,
                   "notes": ["C4","E4","G4","C5","G4","E4"] },
    { "at": "l5",  "inst": "pop",   "every": 0.68, "count": 6 },
    { "at": "l13", "inst": "coin",  "offset": 2.5 }
  ]
}
```

| field | meaning |
|---|---|
| `at` | line id (or `s2`-style beat key) to anchor the cue |
| `offset` | seconds after that anchor |
| `inst` | `pad`, `pluck`, `bell`, `pop`, `whoosh`, `coin` |
| `note` / `notes` | scientific pitch (`C4`, `F#3`); `notes` cycles per repetition |
| `every` / `count` | repeat interval and how many times |
| `dur`, `gain`, `amp`, `pan` | length, level, accent, stereo position (-1…1) |

Note names use A4 = 440 Hz. If a cue points at an unknown key the build warns and skips it rather than failing.
