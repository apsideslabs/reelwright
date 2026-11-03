import json, subprocess, numpy as np, wave, imageio_ffmpeg
ff = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000; GAP = 0.35; TAIL = 0.60
d = json.load(open("voice/words.json"))

def decode(path):
    p = subprocess.run([ff, "-v", "quiet", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                       capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.float32)

tracks, out_lines, abs_marks, cursor = [], [], [], 0.0
per_line = {}
for m in d["marks"]:
    per_line.setdefault(m.get("line"), []).append(m)

# regroup marks by line using stored order: marks are in line order
marks = d["marks"]; idx = 0
for l in d["lines"]:
    a = decode(f"voice/{l['name']}.mp3")
    # this line's marks are the next N words of its text
    n_words = len(l["text"].split())
    line_marks = marks[idx:idx+n_words]; idx += n_words
    last_rel = max(m["t"] - l["start"] for m in line_marks) + 0.18
    cut = min(len(a), int(last_rel*SR))
    a = a[:cut]
    dur = len(a)/SR
    tracks.append(a)
    tracks.append(np.zeros(int(GAP*SR), dtype=np.float32))
    for m in line_marks:
        abs_marks.append({"t": round(cursor + (m["t"] - l["start"]), 3), "d": m["d"], "w": m["w"]})
    out_lines.append({"name": l["name"], "text": l["text"], "start": round(cursor,3), "end": round(cursor+dur,3)})
    cursor += dur + GAP

tracks.append(np.zeros(int(TAIL*SR), dtype=np.float32))
voice = np.concatenate(tracks)
total = len(voice)/SR
peak = np.max(np.abs(voice)) or 1.0
voice = voice/peak*0.92
with wave.open("voice/voice.wav","wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((voice*32767).astype(np.int16).tobytes())
json.dump({"marks": abs_marks, "lines": out_lines, "total": round(total,3)},
          open("voice/words.json","w"), indent=1)
print("video %.2f s | lines:" % total)
for l in out_lines: print("  %-7s %6.2f -> %6.2f  %s" % (l["name"], l["start"], l["end"], l["text"][:44]))
