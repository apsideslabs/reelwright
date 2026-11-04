# Safe areas

Every vertical platform paints its own interface over your video. If your words land under it, they are invisible, and no amount of good animation fixes that.

The numbers below are for a **1080×1920** frame, taken from each platform's published ad guidance and community measurement (checked October 2026). Ad guidance is stricter than organic posts, so designing to it is safe for both.

| Platform | Top | Bottom | Left | Right |
|---|---|---|---|---|
| TikTok | 240 | 660 | 120 | 120 |
| Instagram / Facebook Reels | 269 | 672 | 65 | 65 |
| YouTube Shorts | 288 | 672 | 48 | 192 |
| **All three at once** | **290** | **680** | **120** | **200** |

The union, the strictest margin on each edge, leaves a working box of **x 120–880, y 290–1240**: about 760×950 px, or roughly a quarter of the frame.

That is the box Reelwright lays every graphic into.

```jsonc
{ "safeArea": "all" }   // default: TikTok + Reels + Shorts
```

Other values: `"tiktok"`, `"reels"`, `"shorts"`, `"none"`. The scene scales them to any output height, so a 720×1280 render keeps the same proportions.

## What goes inside, and what may run to the edge

Inside the box: anything that carries meaning on its own, titles, steps, prices, quotes, the end card, a face when the face is the point.

To the edge: background, colour, texture, decoration. Shrinking the *picture* to fit the safe area makes a video look small and boxed in. The safe area is a rule for words, not for the frame.

## Checking a frame

```
node kit/render.js --site build/my-film/site --out /tmp/chk --list=700 --query="safe=1"
```

`?safe=1` paints the covered regions red and outlines the usable box in green, with the pixel bounds printed in the corner. Use it whenever you add a graphic.

## What this fixed

Before 1.4 the six-step checklist ran to y 1338 and x 960 on a 1080×1920 frame. On TikTok the bottom rows sat under the caption block and the right edge under the button column, the last two steps of a six-step explainer were simply not visible. The proof and cost cards overflowed the bottom by 70 and 20 px respectively.

Everything now derives from `SAFE`, so the layout re-flows if you change platform or output size.
