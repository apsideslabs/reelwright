"""Score + SFX under the narration: rumble, burst, splash, footsteps, a low string bed."""
import numpy as np, wave, json, imageio_ffmpeg, subprocess

SR = 48000
d = json.load(open("voice/words.json")); TOTAL = d["total"]; EV = {}
marks = d["marks"]
def find(w, after=0.0):
    for m in marks:
        if m["t"] >= after and w.lower() in m["w"].lower().strip(",.!?"): return m["t"]
    return None
EV = {"burst": find("tore"), "tsunami": find("tsunami"), "cooled": find("cooled"), "died": find("Twenty")}

def rd(path):
    p = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v","quiet","-i",path,"-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.float32)

voice = rd("voice/voice.wav")
N = len(voice); t = np.arange(N)/SR
rng = np.random.default_rng(11)

def env(n, a, d_, s, r):
    e = np.ones(n); ai, di, ri = int(a*SR), int(d_*SR), int(r*SR)
    ai = max(1,min(ai,n)); di = max(1,min(di,n)); ri = max(1,min(ri,n))
    e[:ai] = np.linspace(0,1,ai)
    e[ai:ai+di] = np.linspace(1,s,min(di,n-ai))
    if ai+di < n: e[ai+di:] = s
    e[-ri:] *= np.linspace(1,0,ri)
    return e

def add(buf, sig, at, gain=1.0):
    i = int(at*SR); j = min(len(buf), i+len(sig))
    if i < len(buf) and j > i: buf[i:j] += gain*sig[:j-i]

def tone(f, dur, kind="string", amp=0.2):
    n = int(dur*SR); x = np.arange(n)/SR
    if kind == "string":
        y = (np.sin(2*np.pi*f*x) + 0.45*np.sin(4*np.pi*f*x+0.3) + 0.22*np.sin(6*np.pi*f*x+0.7)
             + 0.10*np.sin(2*np.pi*f*1.004*x))
        e = env(n, dur*0.35, dur*0.2, 0.65, dur*0.45)
    elif kind == "low":
        y = np.sin(2*np.pi*f*x) + 0.3*np.sin(4*np.pi*f*x)
        e = env(n, 0.05, dur*0.6, 0.25, dur*0.35)
    else:
        y = np.sin(2*np.pi*f*x); e = env(n, 0.002, dur*0.9, 0.0, dur*0.1)
    return amp*y*e

def noise(dur, amp, lp=0.06, shape=1.0):
    n = int(dur*SR)
    x = rng.normal(0,1,n)
    y = np.zeros_like(x); acc = 0.0
    for i in range(n):
        acc += lp*(x[i]-acc); y[i] = acc
    e = np.exp(-np.arange(n)/SR*shape)
    return amp*y*e

music = np.zeros(N); sfx = np.zeros(N)

# --- bed: low strings, D minor, one chord per story beat
beats = [(0.0, [73.42, 110.00, 146.83]), (14.5, [69.30, 103.83, 138.59]),
         (20.9, [65.41, 98.00, 130.81]), (33.4, [58.27, 87.31, 116.54]),
         (45.2, [65.41, 98.00, 130.81]), (52.2, [55.00, 82.41, 110.00])]
for i,(at,freqs) in enumerate(beats):
    end = beats[i+1][0] if i+1 < len(beats) else TOTAL
    dur = min(end-at+0.6, TOTAL-at)
    for f in freqs: add(music, tone(f, dur, "string", 0.05), at)
    add(music, tone(freqs[0]/2, dur, "low", 0.10), at)

# --- pulse under the escalation
for at in np.arange(14.5, 33.0, 0.62):
    add(music, tone(73.42, 0.4, "low", 0.09), at)

# --- SFX: the tank groans, the town murmurs
for at in np.arange(2.0, 20.0, 3.1):
    n = int(0.9*SR); x = np.arange(n)/SR
    groan = 0.10*np.sin(2*np.pi*46*x*np.exp(-x*0.6)) * np.exp(-x*3.2)
    add(sfx, groan, at)
add(sfx, noise(6.0, 0.05, 0.02, 0.4), 1.0)     # distant crowd/harbour
add(sfx, noise(6.0, 0.04, 0.02, 0.4), 45.0)

# --- the burst
b = EV["burst"]
n = int(3.0*SR); x = np.arange(n)/SR
boom = (0.55*np.sin(2*np.pi*38*x*np.exp(-x*0.9)) + 0.25*np.sin(2*np.pi*61*x)) * np.exp(-x*1.6)
crack = noise(0.5, 0.5, 0.35, 12.0)
add(sfx, boom, b, 1.0); add(sfx, crack, b, 0.9)
add(sfx, noise(2.2, 0.30, 0.10, 1.1), b+0.05)     # molasses roar

# --- running feet
for at in np.arange(EV["burst"]+1.0, EV["died"], 0.34):
    n = int(0.10*SR); x = np.arange(n)/SR
    add(sfx, 0.10*np.sin(2*np.pi*84*x)*np.exp(-x*30) + 0.02*rng.normal(0,1,n)*np.exp(-x*55), at)

# --- it cools: a thin, cold ring
c = EV["cooled"]
add(sfx, tone(1174.66, 2.2, "bell", 0.05), c)
add(sfx, tone(880.00, 2.6, "bell", 0.035), c+0.4)

# --- mix: music +3 dB, SFX -6 dB, voice unchanged (repo convention)
def db(x): return 10 ** (x/20)
mix = voice*1.0 + music*db(3) + sfx*db(-6)
peak = np.max(np.abs(mix)) or 1.0
mix = mix/peak*0.90
with wave.open("audio/mix.wav","wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix*32767).astype(np.int16).tobytes())
# stems
for name, sig in (("music", music), ("sfx", sfx)):
    s2 = sig/(np.max(np.abs(sig)) or 1)*0.7
    with wave.open(f"audio/{name}.wav","wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((s2*32767).astype(np.int16).tobytes())
print("mix %.2f s | burst %.2f | tsunami %.2f | cooled %.2f" % (N/SR, b, EV["tsunami"], c))
