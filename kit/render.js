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
  const launch = () => puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell',
    protocolTimeout: 900000,
    args: [
      '--no-sandbox',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
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
    await page.goto(`http://127.0.0.1:${PORT}/index.html { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.sceneReady === true', { timeout: 180000 });
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
