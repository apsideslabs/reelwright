# Security

## Reporting

Please do not open a public issue for a security problem. Use GitHub's [private vulnerability reporting](https://github.com/apsideslabs/reelwright/security/advisories/new) or contact the maintainers through the organisation profile.

We aim to acknowledge within 72 hours.

## What is in scope

Reelwright runs three things that touch the outside world:

1. **`kit/render.js`** serves a directory over HTTP on `127.0.0.1` and drives headless Chromium. It binds to loopback only and refuses paths outside the served directory — but treat any film's `scene.js` as code you are running, because it is.
2. **`kit/voice.py`** downloads voice models from HuggingFace on first use. Only do this against `rhasspy/piper-voices`, or pre-download into `voices/` and run offline.
3. **`kit/encode.py`** shells out to ffmpeg with paths derived from your build directory.

## Out of scope

- Malicious `scene.js` files — a film's scene is arbitrary JavaScript executed in your browser context by design. Do not run films you did not write or review.
- Vulnerabilities in Chromium, three.js, ffmpeg or Piper itself — report those upstream.

## Supported versions

The `main` branch only. This is a small project; there are no backports.
