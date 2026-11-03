# Third-party assets

Code in this repository is MIT (see LICENSE). The bundled binaries keep their own terms:

| File | Origin | Licence |
|---|---|---|
| `kit/lib/three.module.js`, `kit/lib/jsm/*` | [three.js](https://github.com/mrdoob/three.js) r169 | MIT |
| `kit/lib/assets/readyplayer.me.glb` | three.js examples (`examples/models/gltf/readyplayer.me.glb`) | Ready Player Me avatar — free for use, see their terms |
| `kit/lib/fonts/NotoSansDevanagari.ttf` | [google/fonts](https://github.com/google/fonts) | SIL Open Font Licence 1.1 |
| Piper voices | [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) | per-voice; most are CC-BY or public domain — **check the voice you use** |

Voices are *not* committed; they download into `voices/` on first run and are gitignored.

If you ship a film made with this kit, check the licence of the specific Piper voice you used and credit the avatar/font as their terms require.
