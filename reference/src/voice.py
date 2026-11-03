import asyncio, os, json, edge_tts, imageio_ffmpeg, subprocess, wave

PROXY = os.environ.get("HTTPS_PROXY"); VOICE = "en-US-GuyNeural"
GAP = 0.38          # silence between narration lines
TAIL = 0.55         # silence after the last line

SCRIPT = [
 ("hook",  "On January 15th, 1919, Boston was hit by a wave of molasses. It moved at 35 miles an hour."),
 ("set",   "The tank held 2.3 million gallons. Enough to fill three and a half swimming pools."),
 ("leak",  "It leaked from day one. So the company painted it brown, to hide the stains."),
 ("snap",  "Then, just after lunch, the steel tore. Twelve thousand tonnes of syrup became a wall eight metres high."),
 ("dead",  "Luckily, molasses is slow. Unluckily, this one wasn't."),
 ("why",   "It is one and a half times denser than water, so gravity alone gives it speed, like a mudslide. For thirty seconds it was a tsunami. Then it cooled, thickened, and stopped being a wave."),
 ("conseq","Twenty one people died. Boston's reply was a rule: engineers must sign and seal their plans."),
 ("twist", "The tank had been painted brown so nobody would notice it was already failing."),
]

async def main():
    lines, all_marks = [], []
    t0 = 0.0
    for name, text in SCRIPT:
        com = edge_tts.Communicate(text, VOICE, proxy=PROXY, boundary="WordBoundary", rate="+8%")
        buf, last = bytearray(), 0.0
        marks = []
        async for ch in com.stream():
            if ch["type"] == "audio":
                buf += ch["data"]
            elif ch["type"] == "WordBoundary":
                off = ch["offset"]/1e7; dur = ch["duration"]/1e7
                marks.append({"t": round(t0+off,3), "d": round(dur,3), "w": ch["text"]})
                last = max(last, off+dur)
        open(f"voice/{name}.mp3","wb").write(buf)
        lines.append({"name": name, "text": text, "start": round(t0,3),
                      "end": round(t0+last,3), "next": round(t0+last+GAP,3)})
        all_marks += marks
        t0 += last + GAP
    total = t0 - GAP + TAIL
    json.dump({"marks": all_marks, "lines": lines, "total": round(total,3)},
              open("voice/words.json","w"), indent=1)
    print("speech total %.2f s, video %.2f s, %d words" % (t0-GAP, total, len(all_marks)))

asyncio.run(main())
