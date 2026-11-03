# Troubleshooting

**Blank or black frames.**
Check `[pageerror]` in the render log. The usual causes: a 404 on an asset (paths are relative to the *site* directory, so `./assets/x.glb` not `./x.glb`), or a JS exception during scene setup. `window.sceneReady` never flips if setup throws.

**`waitForFunction failed: frame got detached`**
The page crashed — nearly always a failed import or a missing asset. Run the scene with `node kit/render.js --list=0` and read the `[pageerror]` line.

**Font renders as boxes.**
The Devanagari font must be loaded before any canvas text is drawn. The scene does `await fontFace.load()` at module top level for exactly this reason. If you swap fonts, keep the await.

**Everything renders but the film is out of sync.**
You edited `lines` and did not rebuild the timeline. Run `--steps voice,music,site` again — `timeline.js` is generated, never hand-edited.

**Render is crawling.**
Expected on CPU: 2–4 s per 1080×1920 frame. Halve it with `--query "w=720&h=1280"`, or drop `fps` to 24. Turning off shadows and MSAA buys another ~45%.

**`Cannot allocate memory` from ffmpeg.**
x264 at 1080p is memory-hungry. `encode.py` already forces `threads=1`; if it still fails, lower `--crf` quality isn't the issue — reduce `rc-lookahead` in `encode.py`, or encode in two halves and concatenate.

**Piper: voice not found.**
Voices download to `voices/` on first use (~63 MB each). Behind a proxy, pre-download with `python kit/voice.py --download hi_IN-pratham-medium` and make sure `voices/` is reachable from where you run the build.

**Two renders at once.**
They fight for the same two cores and end up slower than running one. If you must, give each its own `--port`.

**Frames look soft.**
You rendered at a reduced `--query` size. Render at the delivery size for the final pass — the kit does not upscale for you.
