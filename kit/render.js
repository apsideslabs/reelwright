#!/usr/bin/env node
/**
 * render.js — headless frame renderer.
 *
 * Serves a scene directory over http, drives window.renderFrame(i) in a
 * headless Chromium, and writes numbered JPEGs. Resumable: existing frames are
 * skipped, so a killed render picks up where it stopped. Chunk it from the
 * shell with `timeout 280 node kit/render.js ...` and call it again.
 *
 *   node kit/render.js --site build/my-film/site --out build/my-film/frames \
 *                      --from 0 --to 2045 --resume --port 8500
 *
 * Options
 *   --site DIR     directory containing index.html (required)
 *   --out DIR      frame output directory (required)
 *   --from N       first frame (default 0)
 *   --to N         last frame (default: read from the page)
 *   --list a,b,c   render only these frames (for spot checks)
 *   --port N       http port (default 8500) — change it to run two in parallel
 *   --query STR    query string passed to the page, e.g. "w=540&h=960"
 *   --resume       skip frames already on disk
 *   --exec PATH    Chromium binary (default $CHROME or /usr/local/bin/chromium)
 */
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

// supports both `--flag value` and `--flag=value`
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq > -1) {
    args[a.slice(2, eq)] = a.slice(eq + 1);
  } else {
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { args[k] = next; i++; }
    else args[k] = true;
  }
}

if (!args.site || !args.out) {
  console.error('usage: node kit/render.js --site DIR --out DIR [--from N --to N --resume]');
  process.exit(2);
}

const SITE = path.resolve(args.site);
const OUT = path.resolve(args.out);
const PORT = parseInt(args.port ?? '8500', 10);
const QUERY = args.query ? String(args.query) : '';
const FROM = parseInt(args.from ?? '0', 10);
const CHROME = args.exec || process.env.CHROME || '/usr/local/bin/chromium';

fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream', '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(SITE, rel);
  if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));

  let browser;
  // ---- graphics backend chain ----
  // WebGL is translated by ANGLE, and which backend ANGLE targets decides both
  // speed and longevity. In order of preference:
  //
  //   hardware   real GPU (d3d11 on Windows, metal on macOS, gl/vulkan on Linux)
  //   mesa       --use-angle=gl -> Mesa llvmpipe. ~4x faster than SwiftShader on
  //              a CPU-only Linux box, and NOT flagged unsafe upstream.
  //   swiftshader the bundled software rasteriser. Chromium gates it behind
  //              --enable-unsafe-swiftshader; it is deprecated upstream, so it is
  //              the last resort, not the default.
  //
  // We try each in turn until the scene initialises, so a machine that loses one
  // backend keeps working on the next. --backend=<name> pins one.
  const os = require('os');
  const hasDri = require('fs').existsSync('/dev/dri');
  // libGL present? checked by path, not by shelling out
  const hasMesa = [
    '/usr/lib/x86_64-linux-gnu/libGL.so.1', '/usr/lib/libGL.so.1', '/usr/lib64/libGL.so.1',
    '/usr/lib/aarch64-linux-gnu/libGL.so.1', '/usr/lib/x86_64-linux-gnu/libGL.so',
    '/usr/local/lib/libGL.so.1'
  ].some(p => { try { return require('fs').existsSync(p); } catch (e) { return false; } });
  const plat = os.platform();
  const BACKENDS = {
    hardware: ['--use-gl=angle', '--use-angle=default', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
    mesa: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'],
    swiftshader: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  };
  let chain;
  if (args.backend && BACKENDS[args.backend]) chain = [args.backend];
  else if (args.gpu === '0') chain = ['mesa', 'swiftshader'];
  else if (hasDri || args.gpu === '1') chain = ['hardware', 'mesa', 'swiftshader'];
  else if (hasMesa) chain = ['mesa', 'swiftshader'];
  else chain = ['swiftshader'];
  // remember the backend that worked last time: trying a failing backend costs
  // ~20 s of launch, which is real money on a 60-frame render
  const fs = require('fs');
  const CACHE = require('path').join(__dirname, '..', '.cache', 'backend.json');
  try {
    const saved = JSON.parse(fs.readFileSync(CACHE, 'utf8')).backend;
    if (saved && BACKENDS[saved] && !args.backend && chain.includes(saved)) {
      chain = [saved, ...chain.filter(c => c !== saved)];
    }
  } catch (e) { /* no cache yet */ }

  let glFlags = BACKENDS[chain[0]];
  let backendName = chain[0];
  console.log(`  backend: ${backendName}  (${plat}${hasDri ? ', gpu present' : ', no gpu'}${hasMesa ? ', mesa present' : ''})`);

  const launch = () => puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell',
    protocolTimeout: 900000,
    args: [
      '--no-sandbox',
      ...glFlags,
      '--disable-dev-shm-usage', '--hide-scrollbars', '--disable-lcd-text',
      '--force-device-scale-factor=1'
    ]
  });
  browser = await launch();

  // A long render leaks memory in the page (three.js holds every texture and
  // geometry). Recycle the page every N frames instead of dying at frame 900.
  const RECYCLE = parseInt(args.recycle || '60', 10);
  let page = null, sinceRecycle = 0;

  async function freshPage() {
    if (page) { try { await page.close(); } catch (e) {} }
    page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    page.on('console', m => {
      const t = m.text();
      if (!t.includes('THREE.WebGLRenderer') && !t.includes('GL Driver Message')) console.log('[page]', t);
    });
    const size = (args.size || '1080x1920').split('x').map(Number);
    await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?${QUERY}`, { waitUntil: 'load', timeout: 120000 });
    // if this backend cannot give us a WebGL2 context, walk down the chain
    try {
      await page.waitForFunction('window.sceneReady === true', { timeout: 90000 });
    } catch (e) {
      const next = chain[chain.indexOf(backendName) + 1];
      if (!next) throw e;
      console.error(`  ! ${backendName} failed to initialise — falling back to ${next}`);
      backendName = next; glFlags = BACKENDS[next];
      try { await browser.close(); } catch (err) {}
      browser = await launch();
      return freshPage();
    }
    const gl = await page.evaluate(() => {
      try {
        const c = document.createElement('canvas');
        const g = c.getContext('webgl2') || c.getContext('webgl');
        if (!g) return 'none';
        const d = g.getExtension('WEBGL_debug_renderer_info');
        return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
      } catch (e) { return 'unknown'; }
    });
    console.log(`  gl: ${String(gl).slice(0, 72)}`);
    try {
      fs.mkdirSync(require('path').dirname(CACHE), { recursive: true });
      fs.writeFileSync(CACHE, JSON.stringify({ backend: backendName, gl: String(gl).slice(0, 120) }, null, 1));
    } catch (e) { /* cache is best-effort */ }
    sinceRecycle = 0;
  }
  await freshPage();
  const _unusedPage = null;
  const total = await page.evaluate(() => window.TOTAL || 0);
  const TO = args.to !== undefined ? parseInt(args.to, 10) : total - 1;
  const seq = args.list
    ? String(args.list).split(',').map(Number)
    : Array.from({ length: TO - FROM + 1 }, (_, k) => FROM + k);

  console.log(`  scene ready — ${total} frames, rendering ${seq.length}`);

  const t0 = Date.now();
  let done = 0;
  for (const i of seq) {
    const file = path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`);
    if (args.resume && fs.existsSync(file) && fs.statSync(file).size > 2000) continue;
    if (sinceRecycle >= RECYCLE) await freshPage();
    let dataUrl;
    try {
      dataUrl = await page.evaluate(n => window.renderFrame(n), i);
    } catch (err) {
      // The renderer process died (software WebGL runs out of memory on long
      // films). Restart the browser and retry this frame once; a crash should
      // cost one frame, not the whole render.
      console.error(`  ! frame ${i} crashed (${String(err.message).slice(0, 60)}) — restarting`);
      try { await browser.close(); } catch (e) {}
      browser = await launch();
      await freshPage();
      dataUrl = await page.evaluate(n => window.renderFrame(n), i);
    }
    sinceRecycle++;
    fs.writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    done++;
    if (done % 25 === 0) {
      const per = (Date.now() - t0) / 1000 / done;
      console.log(`  frame ${i}  ${per.toFixed(2)}s/f`);
    }
  }

  const have = fs.readdirSync(OUT).filter(f => f.endsWith('.jpg')).length;
  console.log(`  done ${done} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${have} on disk`);
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
