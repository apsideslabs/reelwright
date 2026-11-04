# Credits

## Techniques adopted from mromidev/claude-animated-shorts

[mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT) is a Claude skill for a different art style, 2D ink-outlined cartoon characters inside a painted 3D world, rendered with three.js inside Remotion. It solves a different problem well, and four of its ideas are better than what this kit had:

| Taken | Where it came from | What changed here |
|---|---|---|
| **Loudness-targeted mixing with voice-keyed ducking** | `templates/audio/mix.py`, ducks the score under speech, masters to an integrated LUFS target, emits stems and a report | Reimplemented in `kit/mix.py`: ducking envelope derived from the narration, ITU-R BS.1770 K-weighted integrated loudness in numpy, soft limiter at a true-peak ceiling, `mix-report.md` |
| **Frame-by-frame QA** | `templates/scripts/short_qa.py`, per-frame luma/saturation/motion, black-white-frozen-pop detection, contact sheets, loudness | Reimplemented in `kit/qa.py`, chunked to survive long films on a 2 GB box, with stills demoted from failure to warning |
| **The camera never stops** | `references/reports/motion.md`, measured that the reference camera moves in 65 % of frames and pushes in ~0.14 %/frame even when quiet | `scene.js` applies a constant push-in on top of every camera key |
| **Reactions land before the word** | `SKILL.md` pipeline, step 4, visual reactions land 0–3 frames before their word | Written into the craft rules in the README and followed in the worked film's timeline |

Their `references/` folder is private study material of a third-party channel; **nothing** from it, no frames, no style bible, no scripts, no character designs, is included here. Only the engineering ideas above, which are their own work and are credited as such.

If you are building the 2D-cartoon-in-3D look specifically, go and use their repo. It is good.

## Bundled assets

See [NOTICE.md](NOTICE.md) for the licence of each bundled file.
