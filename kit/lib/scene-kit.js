/**
 * scene-kit.js — the reusable half of a Reelwright film.
 *
 * A film used to need a scene.js that re-invented the renderer, the lights, the
 * cast, the HUD and the camera path from scratch (templates/scene.js is 1,100
 * lines of exactly that, hard-wired to one shop set). This module is that work,
 * extracted and parameterised, so a new film only has to describe its sets:
 *
 *   import * as K from './scene-kit.js';
 *   const app = K.createApp({ w: 1080, h: 1920 });
 *   const rig = await K.loadRig('./assets/readyplayer.me.glb');
 *   const stages = K.createStages(app.scene, [ { key:'office', t0:0, t1:T.s3, build(g){ ... } } ]);
 *   const hud = K.makeHud({ film: FILM, lines: LINES, safe: K.SAFE });
 *
 * Everything here is deterministic: no Math.random, no Date, no per-run state.
 * Frame i must be a pure function of t = i / FPS.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

// ---------------------------------------------------------------- maths
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = t => { t = clamp(t, 0, 1); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const seg = (t, a, b) => clamp((t - a) / Math.max(1e-6, b - a), 0, 1);
export function rng(s) { let a = s; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// the union of TikTok + Reels + Shorts UI, on a 1080x1920 frame
export const SAFE = { x0: 120, x1: 880, y0: 290, y1: 1240 };

// ---------------------------------------------------------------- app
export function createApp(opts = {}) {
  const w = opts.w || 1080, h = opts.h || 1920;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = opts.tone ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.2;
  if (opts.shadows !== false) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (opts.background !== undefined) scene.background = new THREE.Color(opts.background);
  if (opts.fog) scene.fog = new THREE.Fog(opts.fog[0], opts.fog[1], opts.fog[2]);

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 38, w / h, 0.1, opts.far ?? 400);
  camera.position.set(0, 2, 8);

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');

  return { renderer, scene, camera, out, ctx, w, h };
}

// ---------------------------------------------------------------- lights
/**
 * A key / fill / rim rig. Every Reelwright film before this shipped with the
 * lights hard-coded to one room; this is the same rig, tunable.
 */
export function threePoint(scene, opts = {}) {
  const key = new THREE.DirectionalLight(opts.keyColor ?? 0xffd2a0, opts.keyIntensity ?? 3.0);
  key.position.set(...(opts.keyPos || [3.4, 4.2, 2.4]));
  if (opts.shadows !== false) {
    key.castShadow = true;
    key.shadow.mapSize.set(opts.shadowMap ?? 1024, opts.shadowMap ?? 1024);
    const s = opts.shadowSpan ?? 7;
    key.shadow.camera.left = -s; key.shadow.camera.right = s;
    key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = opts.shadowFar ?? 40;
    key.shadow.bias = -0.0015;
    key.shadow.normalBias = 0.02;
  }
  scene.add(key);

  const fill = new THREE.DirectionalLight(opts.fillColor ?? 0x7f9dc9, opts.fillIntensity ?? 1.1);
  fill.position.set(...(opts.fillPos || [-4, 2.4, 2.0]));
  scene.add(fill);

  const rim = new THREE.DirectionalLight(opts.rimColor ?? 0xa9c4ea, opts.rimIntensity ?? 1.4);
  rim.position.set(...(opts.rimPos || [-1.5, 3.0, -5]));
  scene.add(rim);

  const ambient = new THREE.AmbientLight(opts.ambientColor ?? 0x6b7d9e, opts.ambient ?? 1.5);
  scene.add(ambient);

  let practical = null;
  if (opts.practical) {
    practical = new THREE.PointLight(opts.practical.color ?? 0xffcf94, opts.practical.intensity ?? 14, opts.practical.distance ?? 12, 2);
    practical.position.set(...(opts.practical.pos || [0, 3, -2]));
    scene.add(practical);
  }
  return { key, fill, rim, ambient, practical };
}

// ---------------------------------------------------------------- geometry
export const mat = (color, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color }, o));
export const flat = (color, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color }, o));

export function plane(w, h, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z); parent.add(m); return m;
}
export function box(w, h, d, material, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow;
  parent.add(m); return m;
}
export function cyl(r1, r2, h, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 12), typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function gradientTex(stops, h = 640) {
  return canvasTex(64, h, g => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    for (const [p, col] of stops) gr.addColorStop(p, col);
    g.fillStyle = gr; g.fillRect(0, 0, 64, h);
  });
}
export function softDot(colour, opacity) {
  return canvasTex(128, 128, g => {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, colour);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = opacity; g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}

/** A height profile over x, triangulated as a strip. Monotonic x required. */
export function strip(pts, color, bottom = -40, material) {
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    pos.push(x0, y0, 0, x1, y1, 0, x1, bottom, 0);
    pos.push(x0, y0, 0, x1, bottom, 0, x0, bottom, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(geo, material || new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  return m;
}
export function ridgePts(seed, x0, x1, baseY, amp, n) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (i / n);
    const edge = Math.sin((i / n) * Math.PI);
    const y = baseY + amp * Math.pow(edge, 0.8) * (0.22 + 0.78 * Math.pow(r(), 1.4)) * (i % 2 ? 1 : 0.55);
    pts.push([x, y]);
  }
  return pts;
}
/** Everything of a profile above `snowY`, clipped where it crosses. */
export function snowLine(pts, snowY) {
  const o = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if ((y0 - snowY) * (y1 - snowY) < 0) o.push([x0 + (x1 - x0) * (snowY - y0) / (y1 - y0), snowY]);
    if (y1 > snowY) o.push([x1, y1]);
  }
  return o;
}
/** A snow-capped massif from a hand-authored profile: shadow face, lit face, snow. */
export function peakGroup(profile, { scale = 1, z = -20, lit = 0xd2dbe7, shadow = 0x8ea3bd, snow = 0xfbfcff, snowY = 8.4 } = {}) {
  const g = new THREE.Group();
  const s = strip(profile.map(([x, y]) => [x - 1.15, y - 0.55]), shadow);
  s.position.z = -0.2; g.add(s);
  g.add(strip(profile, lit));
  const cap = strip(snowLine(profile, snowY), snow, snowY);
  cap.position.z = 0.3; g.add(cap);
  g.scale.setScalar(scale);
  g.position.z = z;
  return g;
}

/** A soft ellipse on the floor, so a character does not look pasted on. */
export function contactShadow(parent, y = 0.01, s = 1.1) {
  const tex = softDot('rgba(0,0,0,0.55)', 1);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(s, s * 0.5),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------- the cast
export const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm',
  'RightShoulder', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'];

export async function loadRig(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}

/**
 * Clone the rig into a person you can pose and recolour.
 * PBR materials are converted to Lambert: cheaper on a software rasteriser and
 * a better match for the flat, poster-like grade the kit aims at.
 */
export function makeHuman(rig, opts = {}) {
  const root = skClone(rig);
  const convert = (m) => {
    const n = new THREE.MeshLambertMaterial({
      map: m.map || null,
      color: m.color ? m.color.clone() : new THREE.Color(0xffffff)
    });
    if (m.transparent) { n.transparent = true; n.opacity = m.opacity; }
    return n;
  };
  root.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = opts.shadows !== false;
    o.receiveShadow = opts.shadows !== false;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (opts.hide && opts.hide.includes(o.name)) o.visible = false;
    mats.forEach(m => {
      if (o.name === 'Wolf3D_Outfit_Top' && opts.top !== undefined) { m.map = null; m.color.set(opts.top); }
      if (o.name === 'Wolf3D_Outfit_Bottom' && opts.bottom !== undefined) { m.map = null; m.color.set(opts.bottom); }
      if (o.name === 'Wolf3D_Outfit_Footwear' && opts.shoes !== undefined) { m.map = null; m.color.set(opts.shoes); }
      if ((o.name === 'Wolf3D_Skin' || o.name === 'Wolf3D_Body') && opts.skin !== undefined) m.color.set(opts.skin);
      if (o.name === 'Wolf3D_Hair' && opts.hair !== undefined) { m.map = null; m.color.set(opts.hair); }
    });
  });

  const bones = {};
  root.traverse(o => { if (o.isBone && BONES.includes(o.name)) bones[o.name] = o; });
  const rest = {};
  Object.entries(bones).forEach(([n, b]) => rest[n] = b.quaternion.clone());

  const morphs = [];
  root.traverse(o => { if (o.isMesh && o.morphTargetDictionary && 'mouthOpen' in o.morphTargetDictionary) morphs.push(o); });

  const wrapper = new THREE.Group();
  wrapper.add(root);
  const scale = opts.height ? 1 : (opts.scale ?? 1);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  if (opts.height) {
    const b = new THREE.Box3().setFromObject(root);
    const h = b.max.y - b.min.y;
    root.scale.setScalar(opts.height / h);
    root.updateMatrixWorld(true);
  }
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y = -b2.min.y;

  const human = { root: wrapper, inner: root, bones, rest, morphs, opts };
  if (opts.shadow !== false) contactShadow(wrapper, 0.012, opts.shadowSize ?? 0.9);
  return human;
}

// pose presets, radians, relative to the rig's rest pose
export const POSE = {
  idle: { LeftArm: [0, 0, -0.20], RightArm: [0, 0, 0.20], LeftForeArm: [0, 0, -0.12], RightForeArm: [0, 0, 0.12], Spine: [0.02, 0, 0] },
  talk: { LeftArm: [0.10, 0, -0.24], RightArm: [0.16, 0, 0.30], LeftForeArm: [0.35, 0, -0.25], RightForeArm: [0.45, 0, 0.30], Spine: [0.02, 0, 0], Head: [0.04, 0, 0] },
  present: { LeftArm: [0.25, 0, -0.55], RightArm: [0.25, 0, 0.55], LeftForeArm: [0.55, 0, -0.45], RightForeArm: [0.55, 0, 0.45], Spine: [-0.03, 0, 0] },
  pointUp: { LeftArm: [0, 0, -0.2], RightArm: [-1.25, 0, 0.35], RightForeArm: [-0.35, 0, 0.1], Spine: [0.03, 0, 0], Head: [-0.06, 0, 0] },
  listen: { LeftArm: [0.05, 0, -0.18], RightArm: [0.05, 0, 0.18], LeftForeArm: [0.25, 0, -0.2], RightForeArm: [0.25, 0, 0.2], Spine: [0.05, 0, 0], Head: [0.10, 0.12, 0.04] },
  write: { LeftArm: [0.42, 0, -0.30], RightArm: [0.52, 0, 0.34], LeftForeArm: [0.70, 0, -0.28], RightForeArm: [0.78, 0, 0.30], Spine: [0.10, 0, 0], Head: [0.16, 0, 0] },
  sad: { LeftArm: [0.02, 0, -0.10], RightArm: [0.02, 0, 0.10], LeftForeArm: [0.05, 0, -0.05], RightForeArm: [0.05, 0, 0.05], Spine: [0.12, 0, 0], Spine1: [0.10, 0, 0], Head: [0.22, 0, 0] },
  happy: { LeftArm: [0.15, 0, -0.35], RightArm: [0.15, 0, 0.35], LeftForeArm: [0.4, 0, -0.3], RightForeArm: [0.4, 0, 0.3], Spine: [-0.04, 0, 0], Head: [-0.05, 0, 0] }
};

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function poseHuman(h, pose, blend = 1) {
  for (const [name, e] of Object.entries(pose)) {
    const b = h.bones[name]; if (!b) continue;
    _e.set(e[0], e[1], e[2]);
    _q.setFromEuler(_e);
    const target = h.rest[name].clone().multiply(_q);
    b.quaternion.copy(h.rest[name]).slerp(target, blend);
  }
}
export function speak(h, amount) {
  if (!h) return;
  h.morphs.forEach(m => {
    const d = m.morphTargetDictionary;
    if ('mouthOpen' in d) m.morphTargetInfluences[d.mouthOpen] = amount;
    if ('mouthSmile' in d) m.morphTargetInfluences[d.mouthSmile] = 0.12;
  });
}
/** Narration amplitude at time t, from the envelope the voice step measured. */
export function mouthAt(envelope, t) {
  if (!envelope || !envelope.data || !envelope.data.length) return 0;
  const f = Math.floor(t * (envelope.fps || 30));
  const v = envelope.data[Math.max(0, Math.min(envelope.data.length - 1, f))] || 0;
  return Math.pow(clamp(v * 1.6, 0, 1), 0.8) * 0.55;
}
/** Is line `id` being spoken at t? */
export function speaking(lines, id, t, pad = 0.1) {
  const tm = lines && lines[id];
  if (!tm) return 0;
  return t >= tm.start - pad && t <= tm.start + tm.dur + pad ? 1 : 0;
}

// ---------------------------------------------------------------- stages
/**
 * A film is a list of stages. Each stage owns a group, a camera path and an
 * optional per-frame update; the manager shows one at a time and cuts on the
 * beat boundaries you give it.
 */
export function createStages(scene, defs) {
  const stages = defs.map(d => {
    const group = new THREE.Group();
    group.name = d.key;
    group.visible = false;
    scene.add(group);
    const api = d.build(group) || {};
    return Object.assign({}, d, { group, api });
  });

  function at(t) {
    for (const s of stages) if (t >= s.t0 && t < s.t1) return s;
    return stages[stages.length - 1];
  }

  return {
    stages,
    at,
    update(t) {
      const s = at(t);
      for (const x of stages) x.group.visible = (x === s);
      const u = easeInOut(seg(t, s.t0, s.t1));
      if (s.api.camera) s.api.camera(u, t);
      if (s.api.update) s.api.update(t, u);
      return s;
    }
  };
}

// ---------------------------------------------------------------- HUD
/**
 * Cards, big numbers and burned-in captions, all inside the platform safe area.
 */
export function makeHud(opts) {
  const film = opts.film || {};
  const lines = opts.lines || {};
  const safe = opts.safe || SAFE;
  const accent = opts.accent || (film.graphics && film.graphics.title && film.graphics.title.accent) || '#e8b64c';
  const col = opts.column || { x: safe.x0, w: 520 };
  const fontOf = (size, weight) => `${weight || 700} ${size}px ${opts.font || '"DejaVu Sans", Arial, sans-serif'}`;

  function wrap(g, str, maxW, size, weight) {
    g.font = fontOf(size, weight);
    const words = String(str).split(/\s+/);
    const out = [];
    let cur = '';
    for (const w of words) {
      const tryLine = cur ? cur + ' ' + w : w;
      if (g.measureText(tryLine).width > maxW && cur) { out.push(cur); cur = w; }
      else cur = tryLine;
    }
    if (cur) out.push(cur);
    return out;
  }
  function text(g, s, x, y, size, weight, color, align = 'center', maxW = 0) {
    g.font = fontOf(size, weight);
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    if (maxW) {
      const rows = wrap(g, s, maxW, size, weight);
      rows.forEach((ln, i) => g.fillText(ln, x, y + i * size * 1.16));
      return rows.length * size * 1.16;
    }
    g.fillText(s, x, y);
    return size;
  }
  function card(g, x, y, w, h, alpha, bar) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = 'rgba(8,13,21,0.84)';
    const r = 26;
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 2; g.stroke();
    if (bar) { g.fillStyle = bar; g.fillRect(x, y + 26, 6, h - 52); }
    g.restore();
  }
  function alphaIn(t, a, b, fade = 0.4) {
    if (t < a - fade || t > b + fade) return 0;
    return Math.min(seg(t, a - fade, a), 1 - seg(t, b, b + fade));
  }

  const G = film.graphics || {};
  const times = opts.times || {};

  function drawTitle(g, t) {
    if (!G.title) return;
    const a = alphaIn(t, opts.titleIn ?? 0.5, opts.titleOut ?? 4.7);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    card(g, col.x, 330, col.w, 300, 0.9, accent);
    const used = text(g, G.title.heading || film.title || '', col.x + col.w / 2, 425, 44, 700, '#ffffff', 'center', 430);
    if (G.title.sub) text(g, G.title.sub, col.x + col.w / 2, 425 + used + 26, 28, 400, 'rgba(255,255,255,0.62)');
    g.restore();
  }
  function drawSteps(g, t) {
    if (!G.steps || !G.steps.length) return;
    const a = alphaIn(t, times.stepsIn ?? 0, times.stepsOut ?? 0, 0.3);
    if (a <= 0) return;
    const rowH = 72, top = 320;
    g.save(); g.globalAlpha = a;
    card(g, col.x, top, col.w, rowH * G.steps.length + 62, 0.88, null);
    text(g, opts.stepsLabel || 'METHOD', col.x + 40, top + 42, 22, 700, 'rgba(255,255,255,0.5)', 'left');
    const lit = times.stepBeats || [];
    G.steps.forEach((row, i) => {
      const group = Math.min(Math.max(0, lit.length - 1), Math.floor((i / G.steps.length) * lit.length));
      const on = t >= (lit[group] ?? 0) - 0.15;
      const y = top + 56 + i * rowH;
      g.globalAlpha = a * (on ? 1 : 0.32);
      g.font = fontOf(20, 700);
      g.fillStyle = on ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.28)';
      g.textAlign = 'left';
      g.fillText(String(row.n), col.x + 40, y + 26);
      g.font = fontOf(26, on ? 700 : 400);
      g.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.55)';
      g.fillText(String(row.label), col.x + 76, y + 26);
      if (on) { g.fillStyle = row.color || accent; g.fillRect(col.x + col.w - 44, y + 8, 8, 8); }
    });
    g.restore();
  }
  function drawProof(g, t) {
    if (!G.proof) return;
    const a = alphaIn(t, times.proofIn ?? 0, times.proofOut ?? 0, 0.45);
    if (a <= 0) return;
    const rows = G.proof.lines || [];
    g.save(); g.globalAlpha = a;
    card(g, col.x, 340, col.w, 300, 0.9, G.proof.accent || accent);
    text(g, rows[0] || '', col.x + col.w / 2, 470, 74, 700, '#ffffff');
    if (rows[1]) text(g, rows[1], col.x + col.w / 2, 522, 26, 400, 'rgba(255,255,255,0.64)');
    if (G.proof.foot) text(g, G.proof.foot, col.x + col.w / 2, 586, 22, 400, G.proof.accent || accent);
    g.restore();
  }
  function drawEnd(g, t, dur) {
    if (!G.end) return;
    const a = alphaIn(t, Math.max(0, dur - 5.2), dur + 1, 0.55);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    card(g, col.x, 340, col.w, 300, 0.9, G.end.accent || accent);
    text(g, G.end.line1 || '', col.x + col.w / 2, 452, 44, 700, '#ffffff');
    if (G.end.line2) text(g, G.end.line2, col.x + col.w / 2, 508, 44, 700, '#ffffff');
    if (G.end.foot) text(g, G.end.foot, col.x + col.w / 2, 588, 22, 400, G.end.accent || accent);
    g.restore();
  }
  function drawCaptions(g, t) {
    if (film.captions === false) return;
    const size = film.captionSize || 38;
    (film.lines || []).forEach((ln, i) => {
      const tm = lines[ln.id];
      if (!tm) return;
      const a = Math.min(seg(t, tm.start - 0.05, tm.start + 0.12), 1 - seg(t, tm.start + tm.dur, tm.start + tm.dur + 0.16));
      if (a <= 0) return;
      g.save(); g.globalAlpha = a;
      const rows = wrap(g, ln.text, 760, size, 700);
      const lh = size * 1.18;
      const y0 = 1168 - (rows.length - 1) * lh;
      g.font = fontOf(size, 700);
      g.textAlign = 'center';
      g.lineWidth = 8; g.strokeStyle = 'rgba(4,8,14,0.94)'; g.lineJoin = 'round';
      rows.forEach((ln2, k) => g.strokeText(ln2, 500, y0 + k * lh));
      g.fillStyle = '#ffffff';
      rows.forEach((ln2, k) => g.fillText(ln2, 500, y0 + k * lh));
      g.restore();
    });
  }

  return {
    card, text, wrap, alphaIn, accent,
    draw(g, t, dur) {
      drawSteps(g, t);
      drawProof(g, t);
      drawEnd(g, t, dur);
      drawTitle(g, t);
      drawCaptions(g, t);
      if (opts.vignette !== false) {
        const v = film.grade && film.grade.vignette !== undefined ? film.grade.vignette : 0.34;
        const vg = g.createRadialGradient(540, 860, 420, 540, 860, 1220);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(0,0,0,${v.toFixed(3)})`);
        g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
      }
      if (opts.debugSafe) {
        g.strokeStyle = 'rgba(255,60,60,0.9)'; g.lineWidth = 3;
        g.strokeRect(safe.x0, safe.y0, safe.x1 - safe.x0, safe.y1 - safe.y0);
      }
    }
  };
}

// ---------------------------------------------------------------- run
/** Wire a frame function to the renderer, the HUD and the page contract. */
export function run(app, { fps, dur, update, hud }) {
  const { renderer, scene, camera, ctx, out, w, h } = app;
  const sx = w / 1080, sy = h / 1920;
  window.renderFrame = function (i) {
    const t = clamp(i / fps, 0, dur);
    update(t);
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, 0, 0);
    if (hud) {
      ctx.save();
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
      ctx.textBaseline = 'alphabetic';
      hud.draw(ctx, t, dur);
      ctx.restore();
    }
    return out.toDataURL('image/jpeg', 0.92);
  };
  window.FPS = fps;
  window.TOTAL = Math.round(fps * dur);
  window.sceneReady = true;
}

// ---------------------------------------------------------------- motion
/** One bone's local rotation on top of its rest pose. */
export function boneRot(h, name, x = 0, y = 0, z = 0) {
  const b = h.bones[name]; if (!b) return;
  _e.set(x, y, z);
  _q.setFromEuler(_e);
  b.quaternion.copy(h.rest[name]).multiply(_q);
}

/** Procedural walk: legs swing, arms counter-swing, body bobs. */
export function walkCycle(h, t, { speed = 1, amp = 0.55, bob = 0.028 } = {}) {
  const p = t * 5.2 * speed;
  const s = Math.sin(p);
  boneRot(h, 'LeftUpLeg', s * amp);
  boneRot(h, 'RightUpLeg', -s * amp);
  boneRot(h, 'LeftLeg', Math.max(0, -s) * amp * 1.1);
  boneRot(h, 'RightLeg', Math.max(0, s) * amp * 1.1);
  boneRot(h, 'LeftArm', -s * amp * 0.75, 0, -0.18);
  boneRot(h, 'RightArm', s * amp * 0.75, 0, 0.18);
  boneRot(h, 'LeftForeArm', Math.max(0, s) * 0.3, 0, -0.1);
  boneRot(h, 'RightForeArm', Math.max(0, -s) * 0.3, 0, 0.1);
  boneRot(h, 'Spine1', 0.02, s * 0.04, 0);
  h.inner.position.y = Math.abs(Math.sin(p)) * bob;
}

/** Head look, yaw/pitch in radians. */
export function headLook(h, yaw = 0, pitch = 0) {
  boneRot(h, 'Neck', pitch * 0.4, yaw * 0.4, 0);
  boneRot(h, 'Head', pitch * 0.6, yaw * 0.6, 0);
}

/** Deterministic camera micro-motion, so a frame never reads as a still. */
export function handheld(t, amp = 0.006) {
  return {
    x: Math.sin(t * 1.7) * amp + Math.sin(t * 0.63 + 1.1) * amp * 0.6,
    y: Math.sin(t * 1.31 + 0.7) * amp * 0.8 + Math.sin(t * 0.41) * amp * 0.5,
    roll: Math.sin(t * 0.87 + 2.1) * amp * 0.45
  };
}

/** A shot list for one stage: hard cuts between camera setups. */
export function shotPicker(shots) {
  return function pick(t) {
    let s = shots[shots.length - 1];
    for (const x of shots) { if (t >= x.t0 && t < x.t1) { s = x; break; } }
    const u = clamp((t - s.t0) / Math.max(1e-6, s.t1 - s.t0), 0, 1);
    s.cam(easeInOut(u), t);
    return s;
  };
}

/** Drifting dust motes, deterministic from t. */
export function motes(parent, opts = {}) {
  const count = opts.count ?? 90;
  const spread = opts.spread || [8, 5, 6];
  const centre = opts.centre || [0, 2, -3];
  const r = rng(opts.seed ?? 3);
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = centre[0] + (r() - 0.5) * spread[0];
    pos[i * 3 + 1] = centre[1] + (r() - 0.5) * spread[1];
    pos[i * 3 + 2] = centre[2] + (r() - 0.5) * spread[2];
    phase[i] = r() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
  const m = new THREE.PointsMaterial({
    size: opts.size ?? 0.022,
    map: softDot('#ffffff', 1),
    color: opts.colour ?? 0xffd9a0,
    transparent: true,
    opacity: opts.opacity ?? 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  parent.add(pts);
  const base = pos.slice();
  return {
    mesh: pts,
    update(t) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        a[i * 3] = base[i * 3] + Math.sin(t * 0.7 + phase[i]) * 0.16;
        a[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.45 + phase[i] * 1.7) * 0.2;
        a[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.6 + phase[i]) * 0.12;
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

/** Falling snow, wrapping around. */
export function snowfall(parent, opts = {}) {
  const count = opts.count ?? 240;
  const area = opts.area || [26, 16, 14];
  const centre = opts.centre || [0, 6, -6];
  const speed = opts.speed ?? 0.9;
  const r = rng(opts.seed ?? 9);
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = centre[0] + (r() - 0.5) * area[0];
    pos[i * 3 + 1] = centre[1] + (r() - 0.5) * area[1];
    pos[i * 3 + 2] = centre[2] + (r() - 0.5) * area[2];
    phase[i] = r() * 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
  const m = new THREE.PointsMaterial({
    size: opts.size ?? 0.05,
    map: softDot('#ffffff', 1),
    color: opts.colour ?? 0xffffff,
    transparent: true,
    opacity: opts.opacity ?? 0.75,
    depthWrite: false
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  parent.add(pts);
  const base = pos.slice();
  const top = centre[1] + area[1] / 2;
  return {
    mesh: pts,
    update(t) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const fall = (t * speed + phase[i]) % area[1];
        a[i * 3] = base[i * 3] + Math.sin(t * 0.5 + phase[i]) * 0.35;
        a[i * 3 + 1] = top - fall;
        a[i * 3 + 2] = base[i * 3 + 2];
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

/** A wall with a real opening, so the mountain can be seen from indoors. */
export function windowOpening(parent, opts = {}) {
  const { w = 1.9, h = 2.5, x = 0, y = 3, z = -7.4, wallW = 30, wallH = 16, wallY = 4, wallMat } = opts;
  const M = wallMat || mat(0x23304a);
  const x0 = -wallW / 2, x1 = wallW / 2, y0 = wallY - wallH / 2, y1 = wallY + wallH / 2;
  const panel = (pw, ph, px, py) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), M);
    m.position.set(px, py, z);
    m.receiveShadow = true;
    parent.add(m);
  };
  panel((x - w / 2) - x0, wallH, (x0 + (x - w / 2)) / 2, wallY);
  panel(x1 - (x + w / 2), wallH, ((x + w / 2) + x1) / 2, wallY);
  panel(w, y1 - (y + h / 2), x, ((y + h / 2) + y1) / 2);
  panel(w, (y - h / 2) - y0, x, (y0 + (y - h / 2)) / 2);
  const frameMat = mat(0x2a1f16);
  box(0.05, h, 0.06, frameMat, x, y, z + 0.03, parent);
  box(w, 0.05, 0.06, frameMat, x, y, z + 0.03, parent);
  box(w + 0.12, 0.08, 0.1, frameMat, x, y + h / 2, z + 0.03, parent);
  box(w + 0.12, 0.08, 0.1, frameMat, x, y - h / 2, z + 0.03, parent);
  box(0.08, h, 0.1, frameMat, x - w / 2, y, z + 0.03, parent);
  box(0.08, h, 0.1, frameMat, x + w / 2, y, z + 0.03, parent);
}
