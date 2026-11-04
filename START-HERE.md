# Start here

You need: a computer, and words. No editing software, no accounts, no subscriptions.

## 1. Install (once, about two minutes)

```bash
git clone https://github.com/apsideslabs/reelwright
cd reelwright
./setup.sh
```

`setup.sh` installs the Python and Node packages and tells you if Chromium is missing.

## 2. Make a video

```bash
python kit/make.py "Your first sentence. Your second sentence. And the last one."
```

That's it. It writes a script file for you, picks a voice, adds captions, renders and encodes.

Your video appears as `your-first-sentence.mp4` — 1080×1920, ready for Reels, Shorts or TikTok.

## 3. Or write the script in a file

`myscript.txt`:

```
Everyone said the shop was finished.
Then one question changed everything.
What problem does it actually solve?
```

```bash
python kit/make.py myscript.txt --name my-story
```

One sentence per line is best: each line becomes one caption and one beat.

## 4. Options worth knowing

| flag | what it does |
|---|---|
| `--lang hi` | speak Hindi (also `es fr de it pt ru ar zh` and more) |
| `--style real` | lit look instead of flat cartoon |
| `--size 720x1280` | render smaller — about twice as fast, good for a first try |
| `--steps "Problem,Agitate,Solution,Proof,Offer,Close"` | adds a numbered checklist |
| `--no-captions` | burn no subtitles |
| `--title "My Film"` | title card text |
| `--dry-run` | write the script file, render nothing |

## 5. If something goes wrong

- **"Chromium missing"** — install it, or run `CHROME=/path/to/chromium python kit/make.py ...`
- **"No module named piper"** — `pip install -r requirements.txt`
- **It is slow** — expected on a laptop without a GPU: 2–4 seconds per frame at 1080p. Try `--size 720x1280` first.
- **Anything else** — `make test` runs the whole pipeline on a three-line film and tells you which stage is broken.

## Going further

The file `make.py` writes — `films/<name>/film.json` — is plain, readable JSON: lines, colours, music cues, captions, safe areas. Edit it and run:

```bash
python kit/build.py --film films/<name>/film.json
```

Everything is in [`docs/`](docs/): the film format, how to change the look, safe areas, and the measured craft targets.
