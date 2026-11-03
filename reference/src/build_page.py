import base64, json, html, pathlib

# in this repo the page loads the mp4 next to it instead of embedding 10 MB of base64
b64 = None
tl = json.load(open("timeline.json"))
words = json.load(open("voice/words.json"))

CHAPTERS = [
  ("0:00", 0.0,  "The absurd fact", "Boston was hit by a wave of molasses that moved at 35 mph."),
  ("0:08", 8.49, "The tank", "2.3 million US gallons — about 3.5 Olympic swimming pools — 50 ft tall, 90 ft across, built in 1915."),
  ("0:14", 14.88,"The leaks", "It leaked from day one. The company painted it brown to hide the stains."),
  ("0:20", 20.90,"The tear", "15 January 1919, just after lunch. The steel tore; ~12,000 tonnes of syrup became a wall ~8 m high."),
  ("0:28", 28.06,"The physics", "Molasses is 1.5x denser than water, so gravity alone drives a fast gravity current — then cooling thickens it."),
  ("0:45", 45.20,"The cost", "21 people died, about 150 were injured. Boston's reply: engineers must sign and seal their plans."),
  ("0:52", 52.18,"The twist", "The paint was the tell. The tank had been failing in public for four years."),
]

FACTS = [
  ("2.3 million", "US gallons of molasses in the tank (≈ 8,700 m³)"),
  ("35 mph", "estimated speed of the initial wave (≈ 56 km/h)"),
  ("~8 m", "peak height of the wave; it ran about two blocks"),
  ("1.5×", "density of molasses compared with water"),
  ("21", "people killed; about 150 injured"),
  ("1925", "the year a court auditor ruled the owners negligent"),
]

SOURCES = [
  ("City of Boston", "100 years ago today: Molasses crashes through Boston's North End", "https://www.boston.gov/news/100-years-ago-today-molasses-crashes-through-bostons-north-end"),
  ("Wikipedia", "Great Molasses Flood", "https://en.wikipedia.org/wiki/Great_Molasses_Flood"),
  ("Boston.com / Nicole Sharp", "5 questions about Boston's deadly Great Molasses Flood", "https://www.boston.com/news/history/2019/01/14/great-molasses-flood-questions/"),
  ("Scientific American", "The Science of the Great Molasses Flood", "https://www.scientificamerican.com/article/molasses-flood-physics-science/"),
  ("HISTORY", "Why the Great Molasses Flood Was So Deadly", "https://www.history.com/articles/great-molasses-flood-science"),
  ("New Scientist", "Incredible physics behind the deadly 1919 Boston Molasses Flood", "https://www.newscientist.com/article/2114116-incredible-physics-behind-the-deadly-1919-boston-molasses-flood/"),
  ("The Guardian", "Study reveals why so many met a sticky end", "https://www.theguardian.com/science/2017/feb/25/study-reveals-why-so-many-met-a-sticky-end-in-bostons-great-molasses-flood"),
]

chap_html = "\n".join(
  f'<button class="chap" data-t="{t}"><span class="ct">{ts}</span><span class="cn">{html.escape(n)}</span><span class="cd">{html.escape(d)}</span></button>'
  for ts, t, n, d in CHAPTERS)
fact_html = "\n".join(f'<div class="fact"><b>{html.escape(v)}</b><span>{html.escape(k)}</span></div>' for v, k in FACTS)
src_html = "\n".join(f'<li><a href="{u}" target="_blank" rel="noopener">{html.escape(a)} — {html.escape(t)}</a></li>' for a, t, u in SOURCES)

PAGE = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Slow as molasses — the 1919 Boston molasses flood</title>
<style>
  :root {{ --bg:#14100d; --card:#1f1813; --ink:#f4ece2; --dim:#b6a795; --acc:#c9752f; --acc2:#e0a45f; }}
  * {{ box-sizing:border-box }}
  body {{ margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }}
  .wrap {{ max-width:1180px; margin:0 auto; padding:28px 20px 80px; }}
  header {{ display:flex; gap:24px; align-items:flex-start; flex-wrap:wrap; margin-bottom:22px }}
  h1 {{ font-size:clamp(26px,4vw,40px); line-height:1.1; margin:0 0 10px; letter-spacing:-.02em }}
  h1 em {{ color:var(--acc2); font-style:normal }}
  .kicker {{ text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:var(--acc); margin:0 0 10px }}
  .lede {{ color:var(--dim); max-width:52ch; margin:0 }}
  .stage {{ display:grid; grid-template-columns:minmax(0,420px) minmax(0,1fr); gap:26px; align-items:start }}
  @media (max-width:880px) {{ .stage {{ grid-template-columns:1fr }} }}
  .phone {{ position:sticky; top:20px; border-radius:22px; overflow:hidden; background:#000; box-shadow:0 24px 60px rgba(0,0,0,.55); border:1px solid #2c231b }}
  video {{ display:block; width:100%; aspect-ratio:9/16; background:#000 }}
  .chapters {{ display:flex; flex-direction:column; gap:8px }}
  .chap {{ display:grid; grid-template-columns:56px 1fr; gap:2px 12px; text-align:left; background:var(--card);
           border:1px solid #2e241b; color:inherit; border-radius:12px; padding:11px 14px; cursor:pointer; font:inherit; transition:.15s }}
  .chap:hover {{ border-color:var(--acc); transform:translateX(2px) }}
  .chap.on {{ border-color:var(--acc); background:#291f16 }}
  .ct {{ grid-row:span 2; color:var(--acc2); font-variant-numeric:tabular-nums; font-size:13px; padding-top:3px }}
  .cn {{ font-weight:600 }}
  .cd {{ color:var(--dim); font-size:14px }}
  .facts {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:34px 0 10px }}
  .fact {{ background:var(--card); border:1px solid #2e241b; border-radius:12px; padding:14px }}
  .fact b {{ display:block; font-size:24px; color:var(--acc2); letter-spacing:-.01em }}
  .fact span {{ color:var(--dim); font-size:13px }}
  section h2 {{ font-size:20px; margin:38px 0 12px; letter-spacing:-.01em }}
  .panel {{ background:var(--card); border:1px solid #2e241b; border-radius:14px; padding:18px }}
  .slider {{ display:flex; align-items:center; gap:14px; margin:14px 0 6px; flex-wrap:wrap }}
  input[type=range] {{ flex:1; min-width:200px; accent-color:var(--acc) }}
  canvas {{ width:100%; height:auto; border-radius:10px; background:#120e0b; display:block }}
  .read {{ display:flex; gap:18px; flex-wrap:wrap; margin-top:12px; color:var(--dim); font-size:14px }}
  .read b {{ color:var(--ink) }}
  ol.sources {{ padding-left:20px; color:var(--dim); font-size:14px }}
  ol.sources a {{ color:var(--acc2); text-decoration:none; border-bottom:1px dotted #6b4b2a }}
  .note {{ color:var(--dim); font-size:13px; margin-top:8px }}
  footer {{ margin-top:46px; color:#7d7167; font-size:13px; border-top:1px solid #2a221b; padding-top:16px }}
</style></head>
<body><div class="wrap">
<header>
  <div>
    <p class="kicker">A 56-second cartoon explainer</p>
    <h1>Slow as <em>molasses</em> — until it isn't</h1>
    <p class="lede">On 15 January 1919 a storage tank in Boston's North End let go and 2.3 million gallons of
    molasses came out at an estimated 35 mph. The interesting part is why a famously slow fluid behaved like a
    tsunami — and then why it turned back into tar.</p>
  </div>
</header>

<div class="stage">
  <div class="phone">
    <video id="v" controls playsinline preload="metadata"
      src="molasses_short.mp4"></video>
  </div>
  <div>
    <div class="chapters" id="chapters">
{chap_html}
    </div>
    <div class="facts">
{fact_html}
    </div>
  </div>
</div>

<section>
  <h2>The physics, in one slider</h2>
  <div class="panel">
    <p style="margin:0 0 6px">Molasses is a shear-thinning fluid whose viscosity changes enormously with
    temperature — researchers measured roughly a hundredfold change across the range relevant to that January.
    Drag the temperature and watch two drops race down the same slope.</p>
    <div class="slider">
      <label for="temp">Temperature</label>
      <input id="temp" type="range" min="-10" max="25" value="4" step="1">
      <output id="tout" style="color:var(--acc2); font-variant-numeric:tabular-nums; min-width:64px">4 °C</output>
    </div>
    <canvas id="cv" width="900" height="360"></canvas>
    <div class="read">
      <span>Relative viscosity: <b id="vis">—</b></span>
      <span>Time to slide 3 m: <b id="secs">—</b></span>
      <span>Water for comparison: <b>1×</b></span>
    </div>
    <p class="note">Illustrative model: viscosity ∝ e^(−0.19·T), normalised to 1 at 20 °C, and travel time
    ∝ viscosity. It shows the shape of the effect, not a lab measurement.</p>
  </div>
</section>

<section>
  <h2>Sources</h2>
  <div class="panel">
    <ol class="sources">
{src_html}
    </ol>
    <p class="note">Figures cross-checked across these; the wave-speed estimate (35 mph) is the widely reported
    figure and matches the gravity-current model published by Nicole Sharp and colleagues in 2016.</p>
  </div>
</section>

<footer>Built with Babylon.js in headless Chrome (software WebGL), narration from an edge-TTS neural voice,
sound synthesised in numpy, cut to the word timings. Every frame is posed from the script's own timeline.</footer>
</div>

<script>
const v = document.getElementById('v');
const chaps = [...document.querySelectorAll('.chap')];
chaps.forEach(b => b.addEventListener('click', () => {{
  v.currentTime = parseFloat(b.dataset.t); v.play();
  document.querySelector('.phone').scrollIntoView({{behavior:'smooth', block:'center'}});
}}));
v.addEventListener('timeupdate', () => {{
  const t = v.currentTime; let on = 0;
  chaps.forEach((b,i) => {{ if (t >= parseFloat(b.dataset.t)) on = i; }});
  chaps.forEach((b,i) => b.classList.toggle('on', i === on));
}});

// viscosity demo
const cv = document.getElementById('cv'), g = cv.getContext('2d');
const temp = document.getElementById('temp'), tout = document.getElementById('tout');
const visEl = document.getElementById('vis'), secEl = document.getElementById('secs');
let prog = [0, 0], last = 0;
function viscosity(T) {{ return Math.exp(-0.19 * (T - 20)); }}
function frame(ts) {{
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  const T = parseFloat(temp.value);
  const v1 = viscosity(T), v2 = viscosity(20);
  prog[0] = Math.min(1, prog[0] + dt / (0.35 * v1));
  prog[1] = Math.min(1, prog[1] + dt / (0.35 * v2));
  draw(prog, v1);
  requestAnimationFrame(frame);
}}
function draw(p, v1) {{
  const W = cv.width, H = cv.height;
  g.clearRect(0,0,W,H);
  g.fillStyle = '#191310'; g.fillRect(0,0,W,H);
  // slope
  g.strokeStyle = '#33271e'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(60, 60); g.lineTo(W-60, H-60); g.stroke();
  const lanes = [{{y:70, c:'#c9752f', p:p[0]}}, {{y:190, c:'#6d6259', p:p[1]}}];
  lanes.forEach((l, i) => {{
    const x = 60 + l.p * (W-160);
    const y = l.y + l.p * (H-160);
    g.fillStyle = l.c;
    g.beginPath(); g.ellipse(x, y, 26, 34, 0.5, 0, 7); g.fill();
    g.fillStyle = '#0f0b09'; g.font = '600 15px ui-sans-serif'; 
    g.fillText(i === 0 ? 'molasses at ' + temp.value + ' °C' : 'molasses at 20 °C', 66, l.y - 22);
  }});
}}
function update() {{
  const T = parseFloat(temp.value), v1 = viscosity(T);
  tout.textContent = T + ' °C';
  visEl.textContent = (v1).toFixed(2) + '× the 20 °C value';
  secEl.textContent = (0.35 * v1).toFixed(1) + ' s';
  prog = [0, 0];
}}
temp.addEventListener('input', update); update();
requestAnimationFrame(frame);
</script>
</body></html>"""
pathlib.Path("../explainer.html").write_text(PAGE, encoding="utf-8")
print("page %.2f MB" % (len(PAGE)/1e6))
