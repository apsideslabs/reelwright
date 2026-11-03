"""Turn the narration's word timings into the film's edit decision list.

Reads  voice/words.json   (written by build_voice.py)
Writes timeline.js        (shot boundaries + story-beat frames, in frames)

The scene never contains a timestamp: it reads TIMELINE and asks which line a frame
belongs to. Change a word in voice.py, re-run the chain, and the whole film re-times.
"""
import json, pathlib

FPS = 24
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

words = json.loads((ROOT / "voice" / "words.json").read_text())
marks = words["marks"]


def find(word, after=0.0):
    """First spoken time (s) at or after `after` whose word contains `word`."""
    needle = word.lower().strip(",.!?")
    for m in marks:
        if m["t"] >= after and needle in m["w"].lower().strip(",.!?"):
            return m["t"]
    return None


# the beats the picture has to land on — each one is a word in the script
events = {
    "burst":   find("tore"),        # "the steel tore"
    "wall":    find("eight"),       # "a wall eight metres high"
    "luckily": find("Luckily"),
    "denser":  find("denser"),
    "tsunami": find("tsunami"),     # "For thirty seconds it was a tsunami"
    "cooled":  find("cooled"),      # "Then it cooled, thickened"
    "died":    find("Twenty"),      # "Twenty one people died"
    "rule":    find("engineers"),
}

missing = [k for k, v in events.items() if v is None]
if missing:
    raise SystemExit(f"these beats were not found in the narration: {missing}")

timeline = {
    "FPS": FPS,
    "TOTAL": round(words["total"] * FPS),
    "events": {k: round(v * FPS) for k, v in events.items()},
    "lines": [
        {"name": l["name"], "a": round(l["start"] * FPS), "b": round(l["end"] * FPS)}
        for l in words["lines"]
    ],
}

(ROOT / "timeline.js").write_text("const TIMELINE = " + json.dumps(timeline, indent=1) + ";\n")
print("timeline.js: %d frames, %.1f s" % (timeline["TOTAL"], timeline["TOTAL"] / FPS))
for l in timeline["lines"]:
    print("  %-8s %5d → %5d" % (l["name"], l["a"], l["b"]))
