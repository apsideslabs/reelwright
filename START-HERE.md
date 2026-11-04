# Start here

You need a computer and a script. No editing software, no accounts, no subscriptions.

## Install

Once, from a terminal:

```bash
git clone https://github.com/apsideslabs/reelwright
cd reelwright
./setup.sh
```

`setup.sh` installs the Python and Node packages and tells you if Chromium is missing. If it is, install it from your package manager or chromium.org and run the script again.

## Make a video

```bash
python kit/make.py "Your first sentence. Your second sentence. And the last one."
```

That writes a script file, picks a voice, adds captions, renders and encodes. The result is `your-first-sentence.mp4`, 1080x1920, ready for Reels, Shorts or TikTok.

It prints an estimate before it starts. On a laptop with no graphics card, expect roughly a minute of rendering per second of video at full size.

## Or write the script in a file

Make `myscript.txt`:

```
Everyone said the shop was finished.
Then one question changed everything.
What problem does it actually solve?
```

```bash
python kit/make.py myscript.txt --name my-story
```

One sentence per line works best: each line becomes one spoken clip, one caption and one beat.

## Options

| Flag | What it does |
|---|---|
| `--lang hi` | speak Hindi (also es, fr, de, it, pt, ru, ar, zh and others) |
| `--draft` | 540x960 at 20 fps, about four times faster, for checking wording |
| `--style real` | lit look instead of flat cartoon |
| `--steps "Problem,Agitate,Solution,Proof,Offer,Close"` | adds a numbered checklist |
| `--no-captions` | burn no subtitles |
| `--title "My Film"` | title card text |
| `--dry-run` | write the script file, render nothing |

## When something goes wrong

- **Chromium missing.** Install it, or run `CHROME=/path/to/chromium python kit/make.py ...`
- **No module named piper.** Run `pip install -r requirements.txt`.
- **Slow.** Expected without a GPU. Try `--draft` first.
- **Anything else.** Run `make doctor` for an environment report, or `make test` to check the pipeline on a three-line film. Both print what is broken.

## Going further

The file `make.py` writes is ordinary JSON: lines, colours, music cues, captions, safe areas. Edit it and rebuild:

```bash
python kit/build.py --film films/my-story/film.json
```

Everything else is in [`docs/`](docs/): the film format, how to change the look, safe areas, render speed.
