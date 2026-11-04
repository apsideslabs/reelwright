import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { FPS, DUR, T, LINES } from './timeline.js';
import { FILM } from './film.js';

// =====================================================================
//  "कुछ भी कैसे बेचें" — vertical Hindi explainer, 1080x1920, 24fps
// =====================================================================
const Q = new URLSearchParams(location.search);
const CW = parseInt(Q.get('w') || '1080', 10);
const CH = parseInt(Q.get('h') || '1920', 10);

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = t => { t = clamp(t, 0, 1); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);
const mix3 = (a, b, t) => new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
function rng(s) { let a = s; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------- renderer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(CW, CH);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10161f);
scene.fog = new THREE.Fog(0x10161f, 22, 60);

// ---------------- fonts ----------------
const deva = new FontFace('Deva', 'url(./fonts/NotoSansDevanagari.ttf)');
await deva.load().catch(e => console.log('font fail', e));
document.fonts.add(deva);

// ---------------- helpers ----------------
function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
// Style. 'real' keeps the lit PBR/Lambert look; 'toon' swaps every material for
// cel shading with a stepped ramp and renders through an inverted-hull outline
// pass — the flat-colour-plus-ink look most animated shorts are built from.
const STYLE = FILM.style || 'real';

// Safe area. TikTok, Reels and Shorts all paint captions, usernames and a button
// column over a vertical video. The strictest union on a 1080x1920 frame is
// 290 px top, 680 px bottom, 120 px left, 200 px right — so anything that must be
// READ has to live inside x 120-880, y 290-1240. Backgrounds may run to the edge;
// words may not.
const SAFE_PRESETS = {
  all:      { top: 290, bottom: 680, left: 120, right: 200 },
  shorts:   { top: 288, bottom: 672, left: 60, right: 192 },
  reels:    { top: 269, bottom: 672, left: 65, right: 65 },
  tiktok:   { top: 240, bottom: 660, left: 120, right: 120 },
  none:     { top: 0, bottom: 0, left: 0, right: 0 }
};
const SAFE_NAME = FILM.safeArea || 'all';
const _sp = SAFE_PRESETS[SAFE_NAME] || SAFE_PRESETS.all;
const K = CH / 1920;                       // scale factor for other output heights
// Safe area is authored in native 1080x1920 units; drawHUD sets a transform so
// every HUD number below is resolution-independent.
const SAFE = {
  x0: _sp.left, x1: 1080 - _sp.right,
  y0: _sp.top, y1: 1920 - _sp.bottom
};
SAFE.w = SAFE.x1 - SAFE.x0;
SAFE.h = SAFE.y1 - SAFE.y0;
const DEBUG_SAFE = Q.get('safe') === '1';

// Grade. Defaults are measured targets: a warm lifted black point instead of
// crushed blue-black, mid-tones around 0.5 luma, and a corner vignette of ~0.86.
const GRADE = Object.assign({ exposure: 1.28, lift: [35, 19, 20], vignette: 0.42 }, FILM.grade || {});

const M = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
const basic = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
const hexCss = n => '#' + n.toString(16).padStart(6, '0');

// ---------------- toon setup ----------------
let outline = null;
function makeToon() {
  // four-step ramp: shadow, low mid, high mid, light
  // RGBA, four bands. (RGBFormat was removed from three; using it silently
  // breaks the gradient map and the whole scene renders near-black.)
  const bands = [138, 196, 232, 255];
  const steps = new Uint8Array(bands.flatMap(v => [v, v, v, 255]));
  const ramp = new THREE.DataTexture(steps, 4, 1, THREE.RGBAFormat);
  ramp.needsUpdate = true;
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;

  const conv = m => {
    const n = new THREE.MeshToonMaterial({
      color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
      map: m.map || null,
      gradientMap: ramp,
      transparent: !!m.transparent,
      opacity: m.opacity !== undefined ? m.opacity : 1
    });
    if (m.emissive) n.emissive = m.emissive.clone();
    n.userData.outlineParameters = { thickness: 0.0036, color: [0.05, 0.04, 0.05], alpha: 1 };
    return n;
  };
  scene.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const arr = Array.isArray(o.material) ? o.material : [o.material];
    const next = arr.map(m => (m.isMeshBasicMaterial ? m : conv(m)));
    o.material = Array.isArray(o.material) ? next : next[0];
  });
  outline = new OutlineEffect(renderer, {
    defaultThickness: 0.0036,
    defaultColor: [0.06, 0.05, 0.06],
    defaultAlpha: 1,
    defaultKeepAlive: true
  });
}

// ---------------- lights ----------------
const hemi = new THREE.HemisphereLight(0xd8e8ff, 0x5a4632, 1.15);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe3bc, 2.6);
key.position.set(4.5, 8, 7);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -8; key.shadow.camera.right = 8;
key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
key.shadow.camera.near = 1; key.shadow.camera.far = 26;
key.shadow.bias = -0.0012; key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0x86b4ff, 1.35);
rim.position.set(-5, 4, -6);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffd9b0, 0.55);
fill.position.set(-3, 3, 8);
scene.add(fill);
const shopLight = new THREE.PointLight(0xffd2a0, 34, 14, 2);
shopLight.position.set(0, 3.2, -1.2);
scene.add(shopLight);

// =====================================================================
//  SET — the shop and the street behind it
// =====================================================================
const SET = new THREE.Group(); scene.add(SET);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M(0x6b5a4a));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; SET.add(floor);

// shop shell
const wallMat = M(0x2f4a4e);
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 5.2), wallMat);
backWall.position.set(0, 2.6, -3.3); backWall.receiveShadow = true; SET.add(backWall);
const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 4.4), M(0x263c40));
sideL.position.set(-3.6, 2.6, -1.4); SET.add(sideL);
const sideR = sideL.clone(); sideR.position.x = 3.6; SET.add(sideR);

// shelves with product
const srng = rng(31);
for (let s = 0; s < 3; s++) {
  const sh = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.07, 0.5), M(0x8a6a46));
  sh.position.set(0, 1.55 + s * 0.62, -3.05); SET.add(sh);
  for (let i = 0; i < 13; i++) {
    const hgt = 0.24 + srng() * 0.14;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, hgt, 0.22),
      M(new THREE.Color().setHSL(0.06 + srng() * 0.10, 0.62, 0.52 + srng() * 0.16).getHex()));
    b.position.set(-2.9 + i * 0.48, 1.59 + s * 0.62 + hgt / 2, -3.05);
    SET.add(b);
  }
}

// counter
const counter = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.80, 0.95), M(0x9a7047));
counter.position.set(0, 0.40, -1.05); counter.castShadow = true; counter.receiveShadow = true; SET.add(counter);
const cTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.09, 1.2), M(0xc49a68));
cTop.position.set(0, 0.84, -1.05); SET.add(cTop);
const band = new THREE.Mesh(new THREE.BoxGeometry(6.22, 0.12, 0.02), M(0xd8a33a));
band.position.set(0, 0.52, -0.57); SET.add(band);

// signboard
const signTex = tex(1024, 200, (g, w, h) => {
  g.fillStyle = '#123f3a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e8b64c'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
  g.fillStyle = '#f6e6c2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 92px Deva, serif';
  g.fillText('शर्मा अगरबत्ती', w / 2, h / 2 + 2);
});
const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.76), new THREE.MeshBasicMaterial({ map: signTex }));
sign.position.set(0, 4.20, -3.25); SET.add(sign);

// awning
const awning = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.11, 1.15), M(0xc94f3d));
awning.position.set(0, 3.62, -2.45); awning.rotation.x = -0.14; SET.add(awning);

// laptop on the counter
const lapTex = tex(512, 340, (g, w, h) => {
  g.fillStyle = '#0c1a26'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7fe3c4'; g.font = '700 30px Deva, serif'; g.textAlign = 'center';
  g.fillText('बिक्री', w / 2, 44);
  for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(${158 + i * 12},62%,55%)`; g.fillRect(56 + i * 80, h - 60 - (30 + i * 34), 48, 30 + i * 34); }
  g.strokeStyle = '#2f6f8a'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, h - 60); g.lineTo(w - 40, h - 60); g.stroke();
});
const laptop = new THREE.Group();
const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 0.58), M(0x22262e)); laptop.add(lapBase);
const lapLid = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.56, 0.04), M(0x22262e));
lapLid.position.set(0, 0.28, -0.28); lapLid.rotation.x = -0.2; laptop.add(lapLid);
const lapScr = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.48), new THREE.MeshBasicMaterial({ map: lapTex }));
lapScr.position.set(0, 0.28, -0.255); lapScr.rotation.x = -0.2; laptop.add(lapScr);
laptop.position.set(-1.9, 0.88, -0.95); laptop.rotation.y = 0.28; SET.add(laptop);

// product boxes + price board
const boxTex = tex(220, 320, (g, w, h) => {
  g.fillStyle = '#f4eee2'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c94f3d'; g.fillRect(0, 0, w, 78);
  g.fillStyle = '#fff6e0'; g.font = '700 38px Deva, serif'; g.textAlign = 'center'; g.fillText('अगरबत्ती', w / 2, 54);
  g.strokeStyle = '#c9a227'; g.lineWidth = 5;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(60 + i * 50, 150); g.lineTo(60 + i * 50, 290); g.stroke(); }
});
const boxMat = [M(0xe8e2d2), M(0xe8e2d2), M(0xe8e2d2), M(0xe8e2d2), new THREE.MeshLambertMaterial({ map: boxTex }), M(0xe8e2d2)];
for (let i = 0; i < 4; i++) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.16), boxMat);
  b.position.set(1.85 + i * 0.2, 1.13 + (i > 2 ? 0.5 : 0), -0.9); b.rotation.y = -0.3 + i * 0.06;
  b.castShadow = true; SET.add(b);
}
const priceTex = tex(256, 150, (g, w, h) => {
  g.fillStyle = '#f8ecd2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b3402f'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#b3402f'; g.font = '700 62px Deva, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('₹60', w / 2, h / 2 + 4);
});
const priceBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: priceTex }));
priceBoard.position.set(0.9, 1.08, -0.62); priceBoard.rotation.x = -0.15; SET.add(priceBoard);

// street behind the shop: houses and a neighbouring shop
const streetSeed = rng(707);
const palette = [0x6d5f52, 0x5c6b78, 0x7a6156, 0x53695c, 0x6f6656];
function facadeTex(base, rows, cols, seed) {
  return tex(192, 384, (g, w, h) => {
    g.fillStyle = hexCss(base); g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(0,0,0,0.30)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const r = rng(seed), mw = w / cols, mh = h / rows;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const x = j * mw + mw * 0.24, y = i * mh + mh * 0.2, ww = mw * 0.52, wh = mh * 0.48;
      g.fillStyle = r() < 0.4 ? 'rgba(255,214,150,0.9)' : 'rgba(24,32,44,0.85)';
      g.fillRect(x, y, ww, wh);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5; g.strokeRect(x, y, ww, wh);
    }
  });
}
function building(x, y, z, w, h, d, base, rows, cols, seed) {
  const side = M(new THREE.Color(base).multiplyScalar(0.75).getHex());
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, new THREE.MeshLambertMaterial({ map: facadeTex(base, rows, cols, seed) }), side]);
  m.position.set(x, y + h / 2, z);
  SET.add(m); return m;
}
for (let i = 0; i < 5; i++) {
  const hh = 7 + streetSeed() * 6;
  building(-13 + i * 6.4, 0, -11 - streetSeed() * 2, 5.6, hh, 5, palette[i % palette.length], Math.round(hh / 2), 3, 60 + i);
}
// neighbouring shop sign + awning
const nbTex = tex(512, 150, (g, w, h) => {
  g.fillStyle = '#123f5a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffe6a8'; g.font = '700 74px Deva, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('किराना', w / 2, h / 2 + 2);
});
const nbSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.76), new THREE.MeshBasicMaterial({ map: nbTex }));
nbSign.position.set(-4.6, 2.9, -3.2); nbSign.rotation.y = 0.4; SET.add(nbSign);
const nbAwn = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.2), M(0x2f7f8f));
nbAwn.position.set(-4.6, 2.4, -2.4); nbAwn.rotation.x = -0.18; nbAwn.rotation.y = 0.3; SET.add(nbAwn);

// =====================================================================
//  CHARACTERS — real human mesh, posed by bones, lip-synced
// =====================================================================
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('./assets/readyplayer.me.glb');
const envelope = await fetch('./envelope.json').then(r => r.json()).catch(() => ({ fps: 30, data: [] }));

const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm',
  'RightShoulder', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'];

function makeHuman(opts) {
  const root = skClone(gltf.scene);
  root.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = true;
    const conv = m => {
      const n = new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color ? m.color.clone() : new THREE.Color(0xffffff) });
      if (m.emissive) n.emissive = m.emissive.clone();
      if (m.transparent) { n.transparent = true; n.opacity = m.opacity; }
      return n;
    };
    o.material = Array.isArray(o.material) ? o.material.map(m => conv(m)) : conv(o.material);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (opts.hide && opts.hide.includes(o.name)) o.visible = false;
    mats.forEach(m => {
      m.envMapIntensity = 0.5;
      if (o.name === 'Wolf3D_Outfit_Top') { m.map = null; m.color.set(opts.top); m.roughness = 0.85; }
      if (o.name === 'Wolf3D_Outfit_Bottom') { m.map = null; m.color.set(opts.bottom); m.roughness = 0.9; }
      if (o.name === 'Wolf3D_Outfit_Footwear') { m.map = null; m.color.set(0x2b2118); }
      if (o.name === 'Wolf3D_Skin' || o.name === 'Wolf3D_Body') m.color.set(opts.skin);
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
  root.scale.setScalar(opts.scale ?? 1);
  const box = new THREE.Box3().setFromObject(root);
  root.position.y = -box.min.y;
  return { root: wrapper, inner: root, bones, rest, morphs, opts };
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function poseHuman(h, pose, blend = 1) {
  for (const [name, e] of Object.entries(pose)) {
    const b = h.bones[name]; if (!b) continue;
    _e.set(e[0], e[1], e[2]);
    _q.setFromEuler(_e);
    const target = h.rest[name].clone().multiply(_q);
    b.quaternion.copy(h.rest[name]).slerp(target, blend);
  }
}
function speak(h, amount) {
  h.morphs.forEach(m => {
    const d = m.morphTargetDictionary;
    if ('mouthOpen' in d) m.morphTargetInfluences[d.mouthOpen] = amount;
    if ('mouthSmile' in d) m.morphTargetInfluences[d.mouthSmile] = 0.12;
  });
}
function mouthAt(t) {
  const f = Math.floor(t * envelope.fps);
  const v = envelope.data[Math.max(0, Math.min(envelope.data.length - 1, f))] || 0;
  return Math.pow(clamp(v * 1.6, 0, 1), 0.8) * 0.55;
}

// poses (radians) — arms rest a little closer to the body than the A-pose
const POSE = {
  idle: { LeftArm: [0, 0, -0.20], RightArm: [0, 0, 0.20], LeftForeArm: [0, 0, -0.12], RightForeArm: [0, 0, 0.12], Spine: [0.02, 0, 0] },
  talk: { LeftArm: [0.10, 0, -0.24], RightArm: [0.16, 0, 0.30], LeftForeArm: [0.35, 0, -0.25], RightForeArm: [0.45, 0, 0.30], Spine: [0.02, 0, 0], Head: [0.04, 0, 0] },
  present: { LeftArm: [0.25, 0, -0.55], RightArm: [0.25, 0, 0.55], LeftForeArm: [0.55, 0, -0.45], RightForeArm: [0.55, 0, 0.45], Spine: [-0.03, 0, 0] },
  pointUp: { LeftArm: [0, 0, -0.2], RightArm: [-1.25, 0, 0.35], RightForeArm: [-0.35, 0, 0.1], Spine: [0.03, 0, 0], Head: [-0.06, 0, 0] },
  listen: { LeftArm: [0.05, 0, -0.18], RightArm: [0.05, 0, 0.18], LeftForeArm: [0.25, 0, -0.2], RightForeArm: [0.25, 0, 0.2], Spine: [0.05, 0, 0], Head: [0.10, 0.12, 0.04] },
  sad: { LeftArm: [0.02, 0, -0.10], RightArm: [0.02, 0, 0.10], LeftForeArm: [0.05, 0, -0.05], RightForeArm: [0.05, 0, 0.05], Spine: [0.12, 0, 0], Spine1: [0.10, 0, 0], Head: [0.22, 0, 0] },
  happy: { LeftArm: [0.15, 0, -0.35], RightArm: [0.15, 0, 0.35], LeftForeArm: [0.4, 0, -0.3], RightForeArm: [0.4, 0, 0.3], Spine: [-0.04, 0, 0], Head: [-0.05, 0, 0] }
};

const ravi = makeHuman({ top: 0xece2cc, bottom: 0x36454e, skin: 0xcaa07a, hide: [], scale: 1.0 });
ravi.root.position.set(-1.05, 0.30, -2.35);
scene.add(ravi.root);

const cust = makeHuman({ top: 0x8a4f8f, bottom: 0x2f3f57, skin: 0xd0a884, hide: ['Wolf3D_Headwear', 'Wolf3D_Beard'], scale: 0.94 });
cust.root.position.set(0.90, 0.0, -0.35);
scene.add(cust.root);
cust.root.visible = false;

// hair for the customer, parented to the head bone
{
  const headBone = cust.bones.Head;
  const hairMat = M(0x201812);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.126, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  cap.position.set(0, 0.105, -0.038);
  cap.scale.set(1.02, 1.06, 1.12);
  headBone.add(cap);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), hairMat);
  back.position.set(0, 0.055, -0.080);
  back.scale.set(1.15, 1.35, 1.0);
  headBone.add(back);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), hairMat);
  bun.position.set(0, 0.030, -0.140);
  headBone.add(bun);
}



// contact shadows
const shadowTex = tex(128, 128, (g, w, h) => {
  const rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  rg.addColorStop(0, 'rgba(0,0,0,0.42)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, w, h);
});
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
function contactShadow(parent, y, s) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.5), shadowMat);
  m.rotation.x = -Math.PI / 2; m.position.y = y;
  parent.add(m); return m;
}
contactShadow(ravi.root, 0.02, 1.3);
contactShadow(cust.root, 0.02, 1.25);

// =====================================================================
//  GRAPHICS
// =====================================================================
function hText(text, size, color, weight = 700) {
  return `700 ${size}px Deva, serif`;
}
const G = {};

// title card
G.title = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), new THREE.MeshBasicMaterial({
  map: tex(900, 310, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(10,16,26,0.94)'; roundRect(g, 4, 4, w - 8, h - 8, 26); g.fill();
    g.fillStyle = '#e8b64c'; g.fillRect(38, 34, 7, h - 68);
    g.fillStyle = '#f6e6c2'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = '700 68px Deva, serif';
    g.fillText('कुछ भी कैसे बेचें', 70, 104);
    g.font = '400 36px Deva, serif'; g.fillStyle = '#9fb6c4';
    g.fillText('छह कदम, जो हर बार काम करते हैं', 70, 188);
  }), transparent: true, depthWrite: false
}));
G.title.visible = false; scene.add(G.title);

// six steps
const STEPS = [
  { n: '1', t: 'समस्या', c: '#e0574a' },
  { n: '2', t: 'तीव्रता', c: '#e08a3c' },
  { n: '3', t: 'समाधान', c: '#e0c23c' },
  { n: '4', t: 'सबूत', c: '#5ab86a' },
  { n: '5', t: 'ऑफ़र', c: '#4a9be0' },
  { n: '6', t: 'क्लोज़', c: '#9a6ae0' }
];
G.steps = STEPS.map(s => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.56), new THREE.MeshBasicMaterial({
    map: tex(640, 144, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(12,18,28,0.92)'; roundRect(g, 4, 4, w - 8, h - 8, 26); g.fill();
      g.strokeStyle = s.c; g.lineWidth = 5; roundRect(g, 4, 4, w - 8, h - 8, 26); g.stroke();
      g.fillStyle = s.c; g.beginPath(); g.arc(62, h / 2, 34, 0, 7); g.fill();
      g.fillStyle = '#0c121c'; g.font = '700 40px Deva, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s.n, 62, h / 2 + 2);
      g.fillStyle = '#f6e6c2'; g.font = '700 50px Deva, serif'; g.textAlign = 'left';
      g.fillText(s.t, 116, h / 2 + 2);
    }), transparent: true, depthWrite: false
  }));
  m.visible = false; scene.add(m); return m;
});

// question card
G.question = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.95), new THREE.MeshBasicMaterial({
  map: tex(800, 260, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(12,20,30,0.94)'; roundRect(g, 6, 6, w - 12, h - 12, 30); g.fill();
    g.strokeStyle = '#e8b64c'; g.lineWidth = 5; roundRect(g, 6, 6, w - 12, h - 12, 30); g.stroke();
    g.fillStyle = '#e8b64c'; g.font = '400 34px Deva, serif'; g.textAlign = 'center';
    g.fillText('सवाल', w / 2, 72);
    g.fillStyle = '#f6e6c2'; g.font = '700 50px Deva, serif';
    g.fillText('ये प्रोडक्ट कौन सी', w / 2, 138);
    g.fillText('समस्या हल करता है?', w / 2, 200);
  }), transparent: true, depthWrite: false
}));
G.question.visible = false; scene.add(G.question);

// proof card
G.proof = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.35), new THREE.MeshBasicMaterial({
  map: tex(760, 350, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(14,26,20,0.95)'; roundRect(g, 6, 6, w - 12, h - 12, 28); g.fill();
    g.strokeStyle = '#5ab86a'; g.lineWidth = 5; roundRect(g, 6, 6, w - 12, h - 12, 28); g.stroke();
    g.fillStyle = '#8ef0a8'; g.font = '700 40px Deva, serif'; g.textAlign = 'center';
    g.fillText('★★★★★', w / 2, 66);
    g.fillStyle = '#f6e6c2'; g.font = '400 34px Deva, serif';
    g.fillText('“पहली रात छह घंटे', w / 2, 140);
    g.fillText('नींद आई।”', w / 2, 186);
    g.fillStyle = '#9fd8b0'; g.font = '400 28px Deva, serif';
    g.fillText('1,240 ग्राहक', w / 2, 268);
  }), transparent: true, depthWrite: false
}));
G.proof.visible = false; scene.add(G.proof);

// cost card
G.cost = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.2), new THREE.MeshBasicMaterial({
  map: tex(780, 320, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(34,14,18,0.95)'; roundRect(g, 6, 6, w - 12, h - 12, 26); g.fill();
    g.strokeStyle = '#e0574a'; g.lineWidth = 5; roundRect(g, 6, 6, w - 12, h - 12, 26); g.stroke();
    g.fillStyle = '#ffd9c9'; g.font = '700 44px Deva, serif'; g.textAlign = 'center';
    g.fillText('रोज़ 2 घंटे × 365 रातें', w / 2, 100);
    g.fillStyle = '#e0574a'; g.font = '700 54px Deva, serif';
    g.fillText('= 730 घंटे', w / 2, 190);
    g.fillStyle = '#f0b8a8'; g.font = '400 30px Deva, serif';
    g.fillText('इंतज़ार की कीमत', w / 2, 252);
  }), transparent: true, depthWrite: false
}));
G.cost.visible = false; scene.add(G.cost);

// SOLD stamp
G.sold = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.98), new THREE.MeshBasicMaterial({
  map: tex(560, 230, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#4ad07a'; g.lineWidth = 12; roundRect(g, 18, 18, w - 36, h - 36, 22); g.stroke();
    g.fillStyle = '#4ad07a'; g.font = '700 96px Deva, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('बिक गया', w / 2, h / 2 + 4);
  }), transparent: true, depthWrite: false
}));
G.sold.visible = false; scene.add(G.sold);

// end card
G.end = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.5), new THREE.MeshBasicMaterial({
  map: tex(900, 400, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(8,12,20,0.92)'; roundRect(g, 8, 8, w - 16, h - 16, 30); g.fill();
    g.strokeStyle = '#e8b64c'; g.lineWidth = 5; roundRect(g, 8, 8, w - 16, h - 16, 30); g.stroke();
    g.textAlign = 'center';
    g.fillStyle = '#f6e6c2'; g.font = '700 62px Deva, serif';
    g.fillText('नतीजा बेचिए', w / 2, 130);
    g.fillStyle = '#e8b64c'; g.font = '700 62px Deva, serif';
    g.fillText('प्रोडक्ट नहीं', w / 2, 205);
    g.fillStyle = '#9fb6c4'; g.font = '400 32px Deva, serif';
    g.fillText('समस्या · तीव्रता · समाधान · सबूत · ऑफ़र · क्लोज़', w / 2, 300);
  }), transparent: true, depthWrite: false
}));
G.end.visible = false; scene.add(G.end);

// two packs
const packA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.18), boxMat);
const packB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.24), boxMat);
packA.visible = packB.visible = false;
scene.add(packA, packB);

// progress bar (screen-space overlay)
const overlayScene = new THREE.Scene();
const overlayCam = new THREE.OrthographicCamera(-CW / 2, CW / 2, CH / 2, -CH / 2, -100, 100);
const vignette = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({
  map: tex(512, 900, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.62);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }), transparent: true, depthTest: false, depthWrite: false
}));
vignette.position.z = 2; overlayScene.add(vignette);
const fade = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
fade.position.z = 3; overlayScene.add(fade);


// =====================================================================
//  2D HUD — motion graphics drawn in screen space
// =====================================================================
function hudRR(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function panel(g, x, y, w, h, accent, fill = 'rgba(10,16,26,0.93)') {
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 34; g.shadowOffsetY = 10;
  g.fillStyle = fill; hudRR(g, x, y, w, h, 26); g.fill();
  g.restore();
  g.strokeStyle = accent; g.lineWidth = 4; hudRR(g, x, y, w, h, 26); g.stroke();
}
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const sg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

const HUD_STEPS = [
  { n: '1', t: 'समस्या', c: '#e0574a' }, { n: '2', t: 'तीव्रता', c: '#e08a3c' },
  { n: '3', t: 'समाधान', c: '#e0c23c' }, { n: '4', t: 'सबूत', c: '#5ab86a' },
  { n: '5', t: 'ऑफ़र', c: '#4a9be0' }, { n: '6', t: 'क्लोज़', c: '#9a6ae0' }
];

// shrink text until it fits — a title the user typed should never overflow
function fitFont(g, text, maxW, baseSize, weight = 700, family = 'Deva, serif') {
  let size = baseSize;
  for (let i = 0; i < 40; i++) {
    g.font = `${weight} ${size}px ${family}`;
    if (g.measureText(text).width <= maxW || size <= 18) break;
    size -= Math.max(1, Math.round(size * 0.06));
  }
  return size;
}

function drawHUD(t, g) {
  const W = 1080, H = 1920;
  g.save();
  g.setTransform(CW / 1080, 0, 0, CH / 1920, 0, 0);
  const G = FILM.graphics || {};
  g.textBaseline = 'middle';

  // ---- title ----
  const ti = G.title;
  if (ti) {
    const a = sg(t, 0.7, 1.5), out = sg(t, 3.9, 4.7);
    if (a > 0 && out < 1) {
      g.save(); g.globalAlpha = ease(a) * (1 - ease(out));
      const y = SAFE.y0 + SAFE.h * 0.18 - (1 - ease(a)) * 40;
      panel(g, SAFE.x0, y, SAFE.w, 280, ti.accent || '#e8b64c');
      g.fillStyle = ti.accent || '#e8b64c'; g.fillRect(SAFE.x0 + 26, y + 40, 7, 200);
      g.textAlign = 'left';
      g.fillStyle = '#f6e6c2';
      fitFont(g, ti.heading, SAFE.w - 120, (ti.size || 72));
      g.fillText(ti.heading, SAFE.x0 + 62, y + 108);
      if (ti.sub) {
        g.fillStyle = '#9fb6c4';
        fitFont(g, ti.sub, SAFE.w - 120, (ti.subSize || 38), 400);
        g.fillText(ti.sub, SAFE.x0 + 62, y + 190);
      }
      g.restore();
    }
  }

  // ---- question ----
  const q = G.question;
  if (q) {
    const a = sg(t, T.s3 + 1.0, T.s3 + 1.7), out = sg(t, T.s4, T.s4 + 0.7);
    if (a > 0 && out < 1) {
      g.save(); g.globalAlpha = ease(a) * (1 - ease(out));
      const y = SAFE.y0 + SAFE.h * 0.28 + (1 - ease(a)) * 30;
      panel(g, SAFE.x0, y, SAFE.w, 250, q.accent || '#e8b64c');
      g.textAlign = 'center';
      if (q.label) {
        g.fillStyle = q.accent || '#e8b64c'; g.font = '400 34px Deva, serif';
        g.fillText(q.label, W / 2, y + 52);
      }
      g.fillStyle = '#f6e6c2'; g.font = `700 ${q.size || 54}px Deva, serif`;
      (q.lines || []).forEach((ln, i) => g.fillText(ln, W / 2, y + 128 + i * 68));
      g.restore();
    }
  }

  // ---- steps ----
  (G.steps || []).forEach((step, i) => {
    const a = sg(t, T.s4 + i * 0.14, T.s4 + i * 0.14 + 0.5);
    // step aside for the proof and cost cards, which own the frame in their beats
    const aside = Math.max(
      sg(t, T.s7 - 0.2, T.s7 + 0.4) * (1 - sg(t, T.s8 + 0.1, T.s8 + 0.7)),
      sg(t, T.s12 - 0.2, T.s12 + 0.4) * (1 - sg(t, T.s13 - 0.2, T.s13 + 0.4))
    );
    const out = Math.max(sg(t, T.s9 - 0.5, T.s9 + 0.1), aside);
    if (a <= 0 || out >= 1) return;
    const lit = t > STEP_T(i);
    const pulse = (t > STEP_T(i) && t < STEP_T(i) + 0.55)
      ? 1 + 0.06 * Math.sin(sg(t, STEP_T(i), STEP_T(i) + 0.55) * Math.PI) : 1;
    const h = 104, gap = 14;
    const x = SAFE.x0, w = SAFE.w;
    const totalH = 6 * h + 5 * gap;
    const y = SAFE.y0 + (SAFE.h - totalH) / 2 + i * (h + gap);
    g.save();
    g.globalAlpha = (lit ? 1 : 0.62) * (1 - ease(out)) * ease(a);
    g.translate(W / 2, y + h / 2); g.scale(pulse, pulse);
    g.translate(-W / 2, -(y + h / 2) + (1 - ease(a)) * 40);
    g.fillStyle = 'rgba(8,12,20,0.90)'; hudRR(g, x, y, w, h, 20); g.fill();
    g.strokeStyle = step.color; g.lineWidth = lit ? 5 : 3; hudRR(g, x, y, w, h, 20); g.stroke();
    g.fillStyle = step.color; g.beginPath(); g.arc(x + 74, y + h / 2, 40, 0, 7); g.fill();
    g.fillStyle = '#0a1018'; g.font = '700 44px Deva, serif'; g.textAlign = 'center';
    g.fillText(step.n, x + 74, y + h / 2 + 2);
    g.fillStyle = lit ? '#f6e6c2' : '#8fa0ae'; g.font = '700 56px Deva, serif'; g.textAlign = 'left';
    g.fillText(step.label, x + 140, y + h / 2 + 2);
    g.restore();
  });

  // ---- proof ----
  const pf = G.proof;
  if (pf) {
    const a = sg(t, T.s7 + 0.5, T.s7 + 1.1), out = sg(t, T.s9 - 0.9, T.s9 - 0.3);
    if (a > 0 && out < 1) {
      g.save(); g.globalAlpha = ease(a) * (1 - ease(out));
      const y = SAFE.y0 + SAFE.h * 0.32 + (1 - ease(a)) * 30;
      panel(g, SAFE.x0 + 10, y, SAFE.w - 20, 330, pf.accent || '#5ab86a');
      g.textAlign = 'center';
      if (pf.stars) { g.fillStyle = '#8ef0a8'; g.font = '700 46px Deva, serif'; g.fillText(pf.stars, W / 2, y + 66); }
      g.fillStyle = '#f6e6c2'; g.font = '400 42px Deva, serif';
      (pf.lines || []).forEach((ln, i) => g.fillText(ln, W / 2, y + 152 + i * 56));
      if (pf.foot) { g.fillStyle = '#9fd8b0'; g.font = '400 32px Deva, serif'; g.fillText(pf.foot, W / 2, y + 278); }
      g.restore();
    }
  }

  // ---- cost ----
  const cs = G.cost;
  if (cs) {
    const a = sg(t, T.s12 + 0.4, T.s12 + 1.0), out = sg(t, T.s13, T.s13 + 0.5);
    if (a > 0 && out < 1) {
      g.save(); g.globalAlpha = ease(a) * (1 - ease(out));
      const y = SAFE.y0 + SAFE.h * 0.36 + (1 - ease(a)) * 30;
      panel(g, SAFE.x0 + 10, y, SAFE.w - 20, 300, cs.accent || '#e0574a', 'rgba(30,10,14,0.95)');
      g.textAlign = 'center';
      g.fillStyle = '#ffd9c9'; g.font = '700 50px Deva, serif'; g.fillText(cs.line1, W / 2, y + 92);
      g.fillStyle = '#ff7a66'; g.font = '700 62px Deva, serif'; g.fillText(cs.line2, W / 2, y + 176);
      if (cs.foot) { g.fillStyle = '#f0b8a8'; g.font = '400 34px Deva, serif'; g.fillText(cs.foot, W / 2, y + 244); }
      g.restore();
    }
  }

  // ---- sold stamp ----
  const sd = G.sold;
  if (sd) {
    const a = sg(t, T.s13 + 2.4, T.s13 + 2.9), out = sg(t, T.s14 + 0.1, T.s14 + 0.7);
    if (a > 0 && out < 1) {
      g.save(); g.globalAlpha = ease(a) * (1 - ease(out));
      g.translate((SAFE.x0 + SAFE.x1) / 2, SAFE.y0 + SAFE.h * 0.5); g.rotate(-0.08);
      const sc = 0.7 + 0.3 * ease(a); g.scale(sc, sc);
      g.fillStyle = 'rgba(6,20,12,0.92)'; hudRR(g, -290, -115, 580, 230, 22); g.fill();
      g.strokeStyle = '#4ad07a'; g.lineWidth = 16; hudRR(g, -290, -115, 580, 230, 22); g.stroke();
      g.fillStyle = '#6ef09a'; g.font = '700 104px Deva, serif'; g.textAlign = 'center';
      g.fillText(sd.label, 0, 6);
      g.restore();
    }
  }

  // ---- end card ----
  const ec = G.end;
  if (ec) {
    const a = sg(t, T.s14 + 1.6, T.s14 + 2.5);
    if (a > 0) {
      g.save(); g.globalAlpha = ease(a);
      const y = SAFE.y0 + SAFE.h * 0.22 + (1 - ease(a)) * 30;
      panel(g, SAFE.x0, y, SAFE.w, 360, ec.accent || '#e8b64c');
      g.textAlign = 'center';
      g.fillStyle = '#f6e6c2'; g.font = '700 66px Deva, serif'; g.fillText(ec.line1, W / 2, y + 108);
      g.fillStyle = ec.accent || '#e8b64c'; g.font = '700 66px Deva, serif'; g.fillText(ec.line2, W / 2, y + 188);
      if (ec.foot) { g.fillStyle = '#9fb6c4'; g.font = '400 30px Deva, serif'; g.fillText(ec.foot, W / 2, y + 282); }
      g.restore();
    }
  }

  // ---- captions: the narration itself, timed to the voice ----
  // Works with zero configuration: any film with lines gets readable captions.
  if (FILM.captions !== false) {
    const cur = Object.entries(LINES).find(([id, L]) => t >= L.start - 0.05 && t <= L.start + L.dur + 0.35);
    if (cur) {
      const [, L] = cur;
      const text = (FILM.lines.find(l => l.id === cur[0]) || {}).text || '';
      const fade = Math.min(1, sg(t, L.start - 0.05, L.start + 0.12)) * (1 - sg(t, L.start + L.dur + 0.1, L.start + L.dur + 0.35));
      const size = Math.round((FILM.captionSize || 44));
      g.save();
      g.globalAlpha = fade;
      g.font = `600 ${size}px Deva, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const maxW = SAFE.w - 20;
      const words = text.split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      const lh = size * 1.35;
      const blockH = lines.length * lh;
      const baseY = SAFE.y1 - blockH / 2 - 18;
      lines.forEach((ln, i) => {
        const y = baseY + i * lh;
        g.lineWidth = size * 0.16; g.strokeStyle = 'rgba(8,10,16,0.92)';
        g.strokeText(ln, (SAFE.x0 + SAFE.x1) / 2, y);
        g.fillStyle = '#ffffff';
        g.fillText(ln, (SAFE.x0 + SAFE.x1) / 2, y);
      });
      g.restore();
    }
  }

  // ---- cartoon FX (2D sprites, the way these shorts punch a beat) ----
  (FILM.fx || []).forEach(fx => {
    const anchor = fx.at in T ? T[fx.at] : (LINES[fx.at] ? LINES[fx.at].start : null);
    if (anchor === null) return;
    const t0 = anchor + (fx.offset || 0);
    const dur = fx.dur || 0.6;
    const p = (t - t0) / dur;
    if (p < 0 || p > 1) return;
    const cx = (fx.x ?? 0.5) * W, cy = (fx.y ?? 0.45) * H;
    g.save();
    g.globalAlpha = Math.pow(1 - p, 1.6);
    if (fx.kind === 'impact') {
      const r = 40 + p * 260 * (fx.scale || 1);
      g.strokeStyle = fx.color || '#ffd45e';
      g.lineWidth = 12 * (1 - p) + 2;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.3;
        const r0 = r * 0.75, r1 = r * 1.25;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        g.stroke();
      }
    } else {
      const n = fx.count || 12;
      g.fillStyle = fx.color || '#ffe08a';
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (fx.seed || 0);
        const dist = (0.25 + 0.75 * p) * 260 * (fx.scale || 1);
        const x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist;
        const s = (1 - p) * 13;
        g.beginPath();
        for (let q = 0; q < 4; q++) {
          const ang = a + q * Math.PI / 2;
          g.lineTo(x + Math.cos(ang) * s, y + Math.sin(ang) * s);
          g.lineTo(x + Math.cos(ang + Math.PI / 4) * s * 0.38, y + Math.sin(ang + Math.PI / 4) * s * 0.38);
        }
        g.closePath(); g.fill();
      }
    }
    g.restore();
  });

  // ---- progress bar ----
  const pr = Math.min(1, t / DUR);
  const barY = SAFE.y0 - 14;
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(SAFE.x0, barY, SAFE.w, 5);
  g.fillStyle = '#e8b64c'; g.fillRect(SAFE.x0, barY, SAFE.w * pr, 5);

  // ?safe=1 draws the platform UI zones so you can check a frame
  if (DEBUG_SAFE) {
    g.save();
    g.fillStyle = 'rgba(255,60,60,0.22)';
    g.fillRect(0, 0, W, SAFE.y0);
    g.fillRect(0, SAFE.y1, W, H - SAFE.y1);
    g.fillRect(0, 0, SAFE.x0, H);
    g.fillRect(SAFE.x1, 0, W - SAFE.x1, H);
    g.strokeStyle = '#4ad07a'; g.lineWidth = 4;
    g.strokeRect(SAFE.x0, SAFE.y0, SAFE.w, SAFE.h);
    g.fillStyle = '#4ad07a'; g.font = '600 30px ui-monospace, monospace';
    g.fillText(`safe: ${SAFE_NAME}  x ${Math.round(SAFE.x0)}-${Math.round(SAFE.x1)}  y ${Math.round(SAFE.y0)}-${Math.round(SAFE.y1)}`, SAFE.x0 + 8, SAFE.y0 + 34);
    g.restore();
  }
  g.restore();
}

// ---------------- camera ----------------
const camera = new THREE.PerspectiveCamera(38, CW / CH, 0.1, 200);
const camKey = (p, l, fov) => ({ p: new THREE.Vector3(...p), l: new THREE.Vector3(...l), fov });
const camLerp = (a, b, k) => ({ p: mix3(a.p, b.p, k), l: mix3(a.l, b.l, k), fov: lerp(a.fov, b.fov, k) });

// ---------------- timeline ----------------
const STEP_T = i => T.s5 + i * 0.68;

// ---------------- per-frame updates ----------------
function updateRavi(t) {
  let pose = POSE.idle, mouth = 0, headYaw = 0;
  if (t < T.s2) { pose = POSE.talk; mouth = mouthAt(t) * 0.8; }
  else if (t < T.s3) { pose = POSE.present; mouth = mouthAt(t) * 1.0; }
  else if (t < T.s4) { pose = POSE.sad; mouth = mouthAt(t) * 0.4; }
  else if (t < T.s9) { pose = POSE.listen; mouth = mouthAt(t) * 0.3; headYaw = 0.15; }
  else if (t < T.s11) { pose = POSE.listen; mouth = mouthAt(t) * 0.9; headYaw = -0.1; }
  else if (t < T.s12) { pose = POSE.talk; mouth = mouthAt(t) * 0.9; }
  else if (t < T.s13) { pose = POSE.pointUp; mouth = mouthAt(t) * 0.9; }
  else { pose = POSE.happy; mouth = mouthAt(t) * 0.8; }
  poseHuman(ravi, pose, 0.9);
  // idle breathing on top
  const br = Math.sin(t * 1.5) * 0.012;
  ravi.bones.Spine.quaternion.multiply(_q.setFromEuler(_e.set(br, 0, 0)));
  ravi.bones.Head.quaternion.multiply(_q.setFromEuler(_e.set(0, headYaw, 0)));
  speak(ravi, mouth);
}

function updateCust(t) {
  cust.root.visible = t > T.s9 - 0.8;
  if (!cust.root.visible) return;
  let pose = POSE.idle, mouth = 0;
  if (t < T.s10) { pose = POSE.talk; mouth = mouthAt(t) * 1.0; }
  else if (t < T.s11) { pose = POSE.listen; mouth = mouthAt(t) * 0.35; }
  else if (t < T.s12) { pose = POSE.talk; mouth = mouthAt(t) * 0.95; }
  else if (t < T.s13) { pose = POSE.listen; mouth = mouthAt(t) * 0.3; }
  else { pose = POSE.happy; mouth = mouthAt(t) * 0.6; }
  poseHuman(cust, pose, 0.9);
  speak(cust, mouth);
  // walk in / walk out
  const kin = easeOut(seg(t, T.s9 - 0.8, T.s9 + 1.0));
  const kout = easeInOut(seg(t, T.s13 + 1.6, T.s14 + 0.4));
  cust.root.position.set(lerp(4.4, 0.90, kin) + kout * 4.6, 0.0, -0.35);
  cust.root.rotation.y = lerp(-0.9, 0.22, kin) + kout * 1.2;
}

function placeBillboard(m, x, y, z, scale = 1, face = true) {
  m.position.set(x, y, z);
  m.scale.setScalar(scale);
  if (face) m.lookAt(camera.position);
}

function updateGraphics3D(t) {
  return;
  // eslint-disable-next-line no-unreachable
  sign.visible = !(t > T.s4 - 0.4 && t < T.s9 + 0.4);
  // title
  const ti = seg(t, 0.6, 1.4);
  G.title.visible = ti > 0 && t < 4.6;
  if (G.title.visible) {
    placeBillboard(G.title, 0, 2.62, 0.4, 1.0);
    G.title.material.opacity = Math.min(easeOut(ti), 1 - seg(t, 3.8, 4.6));
  }
  // question card
  const qa = seg(t, T.s3 + 1.1, T.s3 + 1.7);
  G.question.visible = qa > 0 && t < T.s4 + 0.8;
  if (G.question.visible) {
    placeBillboard(G.question, 0.55, 3.05, -1.2, 0.95 * easeOut(qa));
    G.question.material.opacity = easeOut(qa) * (1 - seg(t, T.s4, T.s4 + 0.8));
  }
  // steps
  G.steps.forEach((m, i) => {
    const a = seg(t, T.s4 + i * 0.14, T.s4 + i * 0.14 + 0.5);
    if (a <= 0 || t > T.s9 - 0.5) { m.visible = false; return; }
    m.visible = true;
    const y = 4.30 - i * 0.60;
    placeBillboard(m, 0.15, y - (1 - easeOut(a)) * 0.35, 0.35, easeOut(a) * 1.0);
    const lit = t > STEP_T(i);
    m.material.opacity = lit ? 1 : 0.45;
    const pulse = (t > STEP_T(i) && t < STEP_T(i) + 0.55) ? 1 + 0.10 * bump(t, STEP_T(i), STEP_T(i) + 0.55) : 1;
    let extra = 1;
    if (t > T.s6 && t < T.s7 && i < 3) extra = 1.06;
    if (t > T.s7 && t < T.s8 && i === 3) extra = 1.12;
    if (t > T.s8 && t < T.s9 && i >= 4) extra = 1.08;
    m.scale.multiplyScalar(pulse * extra);
  });
  // proof
  const pa = seg(t, T.s7 + 0.5, T.s7 + 1.1);
  G.proof.visible = pa > 0 && t < T.s9 - 0.4;
  if (G.proof.visible) {
    placeBillboard(G.proof, 0.9, 3.25, -0.7, 0.95 * easeOut(pa));
    G.proof.material.opacity = easeOut(pa) * (1 - seg(t, T.s9 - 0.9, T.s9 - 0.3));
  }
  // cost
  const ca = seg(t, T.s12 + 0.4, T.s12 + 1.0);
  G.cost.visible = ca > 0 && t < T.s13;
  if (G.cost.visible) {
    placeBillboard(G.cost, 0.75, 3.3, -0.6, 0.95 * easeOut(ca));
    G.cost.material.opacity = easeOut(ca);
  }
  // packs
  const pk = seg(t, T.s13 + 0.4, T.s13 + 1.0);
  packA.visible = packB.visible = pk > 0 && t < T.s13 + 4.4;
  if (pk > 0) {
    packA.position.set(0.55, 1.16, -0.55); packA.rotation.y = 0.25;
    packB.position.set(1.25, 1.22, -0.55); packB.rotation.y = -0.15;
    packA.scale.setScalar(easeOut(pk));
    packB.scale.setScalar(easeOut(pk));
  }
  // sold
  const sa = seg(t, T.s13 + 2.4, T.s13 + 2.9);
  G.sold.visible = sa > 0 && t < T.s14 + 0.6;
  if (G.sold.visible) {
    placeBillboard(G.sold, -0.8, 3.1, -0.9, 0.9 * (0.6 + 0.4 * easeOut(sa)));
    G.sold.rotation.z = -0.1;
    G.sold.material.opacity = easeOut(sa) * (1 - seg(t, T.s14 + 0.1, T.s14 + 0.6));
  }
  // end card
  const ea = seg(t, T.s14 + 1.6, T.s14 + 2.5);
  G.end.visible = ea > 0;
  if (G.end.visible) {
    placeBillboard(G.end, 0, 2.75, 0.8, 0.95 * (0.75 + 0.25 * easeOut(ea)));
    G.end.material.opacity = easeOut(ea);
  }
  // fades
  fade.material.opacity = Math.max(1 - seg(t, 0.2, 1.5), seg(t, DUR - 0.9, DUR));
}


// =====================================================================
// ---------------- camera ----------------
function cameraAt(t) {
  const K = {
    open: camKey([1.0, 2.75, 10.2], [0.1, 2.55, -2.2], 40),
    wide: camKey([0.75, 2.35, 7.6], [0.05, 2.15, -2.0], 38),
    medium: camKey([0.30, 2.02, 4.7], [-0.40, 1.85, -2.0], 34),
    tight: camKey([0.05, 1.95, 3.6], [-0.80, 1.80, -2.1], 30),
    cards: camKey([0.2, 2.40, 7.2], [0.1, 2.95, -0.4], 42),
    cardsIn: camKey([0.2, 2.50, 6.4], [0.1, 3.05, -0.3], 42),
    proof: camKey([0.5, 2.30, 6.2], [0.3, 2.85, -0.4], 40),
    morning: camKey([0.5, 2.20, 7.0], [0.3, 2.15, -1.2], 39),
    twoShot: camKey([0.30, 2.05, 5.4], [0.30, 1.95, -1.3], 36),
    custClose: camKey([0.55, 1.95, 4.0], [0.85, 1.80, -0.4], 32),
    raviClose: camKey([0.10, 1.95, 3.9], [-0.85, 1.82, -2.0], 30),
    sale: camKey([0.30, 2.15, 6.2], [0.20, 2.05, -1.1], 39),
    end: camKey([0.20, 2.45, 7.8], [0.10, 2.45, -0.9], 42)
  };
  if (t < T.s2) return camLerp(K.open, K.wide, easeInOut(seg(t, 0.6, T.s2 - 1.0)));
  if (t < T.s3) return camLerp(K.wide, K.medium, easeInOut(seg(t, T.s2, T.s2 + 1.6)));
  if (t < T.s4) return camLerp(K.medium, K.tight, easeInOut(seg(t, T.s3, T.s3 + 1.8)));
  if (t < T.s5) return camLerp(K.tight, K.cards, easeInOut(seg(t, T.s4, T.s4 + 2.0)));
  if (t < T.s6) return camLerp(K.cards, K.cardsIn, easeInOut(seg(t, T.s5, T.s6)));
  if (t < T.s7) return camLerp(K.cardsIn, K.cards, easeInOut(seg(t, T.s6, T.s6 + 1.4)));
  if (t < T.s8) return camLerp(K.cards, K.proof, easeInOut(seg(t, T.s7, T.s7 + 1.2)));
  if (t < T.s9) return camLerp(K.proof, K.morning, easeInOut(seg(t, T.s8, T.s9)));
  if (t < T.s10) return camLerp(K.morning, K.twoShot, easeInOut(seg(t, T.s9, T.s10)));
  if (t < T.s11) return camLerp(K.twoShot, K.raviClose, easeInOut(seg(t, T.s10, T.s10 + 1.4)));
  if (t < T.s12) return camLerp(K.raviClose, K.custClose, easeInOut(seg(t, T.s11, T.s11 + 1.2)));
  if (t < T.s13) return camLerp(K.custClose, K.sale, easeInOut(seg(t, T.s12, T.s12 + 1.4)));
  if (t < T.s14) return K.sale;
  return camLerp(K.sale, K.end, easeInOut(seg(t, T.s14, T.s14 + 2.0)));
}

// ---------------- mood ----------------
function updateMood(t) {
  const k = smooth(seg(t, T.s9 - 2.0, T.s9 + 1.0));
  scene.background = new THREE.Color(0x10161f).lerp(new THREE.Color(0x1d2a3a), k);
  hemi.intensity = lerp(0.75, 1.05, k);
  key.intensity = lerp(2.2, 2.8, k);
  key.color.setHex(0xffd9a8).lerp(new THREE.Color(0xfff0d8), k);
}

// ---------------- main ----------------
function update(t) {
  updateMood(t);
  sign.visible = !(t > T.s4 - 0.4 && t < T.s9 + 0.4);
  updateRavi(t);
  updateCust(t);
  const ck = cameraAt(t);
  camera.position.copy(ck.p);
  // constant slow push-in (~0.14 %/frame): a camera that never fully stops is the
  // single biggest difference between an amateur hold and a professional one
  const push = 1 - 0.0014 * ((t * FPS) % 100000);
  camera.position.lerp(ck.l, 1 - Math.max(0.86, push));
  camera.fov = ck.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(ck.l);
  updateGraphics3D(t);
}

if (STYLE === 'toon') makeToon();

const canvas = renderer.domElement;
const c2d = document.createElement('canvas'); c2d.width = CW; c2d.height = CH;
const g2d = c2d.getContext('2d');
const vigGrad = g2d.createRadialGradient(CW / 2, CH / 2, CH * 0.16, CW / 2, CH / 2, CH * 0.70);
vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
vigGrad.addColorStop(0.55, `rgba(0,0,0,${(GRADE.vignette * 0.22).toFixed(3)})`);
vigGrad.addColorStop(1, `rgba(0,0,0,${GRADE.vignette.toFixed(3)})`);
window.renderFrame = function (i) {
  const t = i / FPS;
  update(t);
  if (outline) outline.render(scene, camera);
  else renderer.render(scene, camera);
  g2d.drawImage(canvas, 0, 0);
  // grade: lift the floor to a warm near-black (never pure black) — 'lighten'
  // raises any channel below the target and leaves everything above untouched
  drawHUD(t, g2d);
  g2d.fillStyle = vigGrad; g2d.fillRect(0, 0, CW, CH);
  // lift last, so the warm floor survives the vignette
  g2d.globalCompositeOperation = 'lighten';
  g2d.fillStyle = `rgb(${GRADE.lift[0]},${GRADE.lift[1]},${GRADE.lift[2]})`;
  g2d.fillRect(0, 0, CW, CH);
  g2d.globalCompositeOperation = 'source-over';
  const fo = fade.material.opacity;
  if (fo > 0.001) { g2d.globalAlpha = fo; g2d.fillStyle = '#000'; g2d.fillRect(0, 0, CW, CH); g2d.globalAlpha = 1; }
  return c2d.toDataURL('image/jpeg', 0.93);
};
window.USE_OVERLAY = Q.get('ov') !== '0';
window.FPS = FPS; window.TOTAL = Math.round(FPS * DUR);
update(0);
if (outline) outline.render(scene, camera); else renderer.render(scene, camera);
window.sceneReady = true;
