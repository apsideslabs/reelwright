/* "Slow as molasses" — a 56 s vertical cartoon short, Babylon.js, deterministic frame stepping.
   Every frame is posed from the narration's word timings (timeline.js). No render loop. */
const W = 720, H = 1280, FPS = TIMELINE.FPS, TOTAL = TIMELINE.TOTAL;
const EV = TIMELINE.events;
const LINES = TIMELINE.lines;

// ------------------------------------------------------------------ engine
const canvas = document.getElementById("c");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, alpha: false }, true);
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.72, 0.82, 0.92, 1);
scene.ambientColor = new BABYLON.Color3(0.34, 0.34, 0.4);
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogColor = new BABYLON.Color3(0.72, 0.82, 0.92);
scene.fogDensity = 0.0085;

// deterministic PRNG for every painted texture
let __seed = 0x9e3779b9;
function rand() {
  __seed |= 0; __seed = (__seed + 0x6D2B79F5) | 0;
  let t = Math.imul(__seed ^ (__seed >>> 15), 1 | __seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * clamp01(u);
const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);

const INK = new BABYLON.Color3(0.043, 0.039, 0.047);
const PLUM = "#241726";
const OW = 0.1;

function canvasTex(w, h, draw) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new BABYLON.DynamicTexture("dt", { width: w, height: h }, scene, false);
  t.getContext().drawImage(cv, 0, 0); t.update(false); t.hasAlpha = true;
  return t;
}
function makeInk(m, w) { m.renderOutline = true; m.outlineColor = INK; m.outlineWidth = w || OW; return m; }
function stdMat(name, tex) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseTexture = tex; m.specularColor = new BABYLON.Color3(0, 0, 0);
  m.ambientColor = new BABYLON.Color3(1, 1, 1); return m;
}
function flatMat(name, r, g, b) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseColor = new BABYLON.Color3(r, g, b); m.specularColor = new BABYLON.Color3(0, 0, 0); return m;
}

// ------------------------------------------------------------------ sky layers (day / cold / dusk)
function skyTex(stops) {
  return canvasTex(16, 1024, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(([p, c]) => grd.addColorStop(p, c));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}
const SKY = {
  day:   skyTex([[0, "#1f5ab5"], [0.38, "#3f81d4"], [0.62, "#8db8e6"], [1, "#d8e6f4"]]),
  cold:  skyTex([[0, "#4a6076"], [0.40, "#6f8496"], [0.66, "#9aabb8"], [1, "#c8d3da"]]),
  dusk:  skyTex([[0, "#2b3560"], [0.34, "#6d5a86"], [0.58, "#c98a72"], [1, "#f0c79a"]]),
};
const skyLayer = new BABYLON.Layer("sky", null, scene, true);
skyLayer.texture = SKY.day;

// flash layer for the burst
const flashTex = canvasTex(8, 8, (g) => { g.fillStyle = "#fff8e8"; g.fillRect(0, 0, 8, 8); });
const flashLayer = new BABYLON.Layer("flash", null, scene, false);
flashLayer.texture = flashTex;
flashLayer.isEnabled = false;

// ------------------------------------------------------------------ lights
const hemi = new BABYLON.HemisphericLight("hemi", V3(0.2, 1, 0.1), scene);
const sun = new BABYLON.DirectionalLight("sun", V3(-0.45, -1, 0.35), scene);
const LIGHTS = {
  day:  { hi: 0.66, si: 1.5, hd: [1.0, 0.96, 0.9], hg: [0.30, 0.29, 0.38], sd: [1.0, 0.95, 0.84], fog: [0.72, 0.82, 0.92] },
  cold: { hi: 0.52, si: 0.85, hd: [0.82, 0.88, 1.0], hg: [0.22, 0.26, 0.34], sd: [0.72, 0.80, 0.95], fog: [0.62, 0.70, 0.76] },
  dusk: { hi: 0.50, si: 1.35, hd: [1.0, 0.86, 0.72], hg: [0.26, 0.24, 0.36], sd: [1.0, 0.72, 0.45], fog: [0.72, 0.60, 0.60] },
};
function applyLight(name) {
  const L = LIGHTS[name];
  hemi.intensity = L.hi; hemi.diffuse = new BABYLON.Color3(...L.hd); hemi.groundColor = new BABYLON.Color3(...L.hg);
  sun.intensity = L.si; sun.diffuse = new BABYLON.Color3(...L.sd);
  scene.fogColor = new BABYLON.Color3(...L.fog);
}

// ------------------------------------------------------------------ ground + street
const cobbleTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#8a7358"; g.fillRect(0, 0, w, h);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) {
    const x = col * 88 + (row % 2) * 44, y = row * 66;
    g.fillStyle = ["#c8b79c", "#b3a189", "#bfae94", "#a6947c"][(row * 3 + col) % 4];
    g.beginPath(); g.roundRect(x + 5, y + 5, 78, 56, 10); g.fill();
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x + 10, y + 9, 68, 11);
  }
});
const street = BABYLON.MeshBuilder.CreateGround("street", { width: 13.8, height: 110 }, scene);
const smat = stdMat("streetMat", cobbleTex);
cobbleTex.uScale = 2.4; cobbleTex.vScale = 13;
street.material = smat; street.position.set(0, 0, 25);

const walkwayTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#9aa08c"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = ["#a6ab97", "#8f9581", "#b0b5a2"][i % 3];
    g.fillRect(rand() * w, rand() * h, 6 + rand() * 18, 4 + rand() * 10);
  }
});
const walkMat = new BABYLON.StandardMaterial("walkMat", scene);
walkMat.diffuseColor = new BABYLON.Color3(0.62, 0.63, 0.56);
walkMat.specularColor = new BABYLON.Color3(0, 0, 0);
[-1, 1].forEach((s) => {
  const p = BABYLON.MeshBuilder.CreateGround("walk" + s, { width: 3.4, height: 110 }, scene);
  p.material = walkMat; p.position.set(s * 8.6, 0.02, 25);
});

// ------------------------------------------------------------------ buildings
function facadeTex(base, trim, win) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
      g.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      g.fillRect(rand() * w, rand() * h, 8 + rand() * 20, 5 + rand() * 12);
    }
    g.fillStyle = trim; g.fillRect(0, h - 44, w, 44); g.fillRect(0, 16, w, 24);
    g.fillStyle = "rgba(0,0,0,0.13)"; g.fillRect(0, h - 44, w, 6);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = 48 + c * 152, y = 74 + r * 140, ww = 88, wh = 96;
      g.fillStyle = trim; g.fillRect(x - 8, y - 8, ww + 16, wh + 16);
      g.fillStyle = win; g.fillRect(x, y, ww, wh);
      g.fillStyle = "rgba(255,255,255,0.26)"; g.fillRect(x + 6, y + 6, ww * 0.32, wh - 12);
      g.fillStyle = "rgba(0,0,0,0.32)";
      g.fillRect(x + ww / 2 - 3, y, 6, wh); g.fillRect(x, y + wh / 2 - 3, ww, 6);
      g.fillStyle = trim; g.fillRect(x - 12, y + wh + 8, ww + 24, 8);
    }
  });
}
const HOUSE_COLORS = [
  ["#e3cfae", "#f6ecd8", "#4f7fa8"], ["#cf9a68", "#f2e4c9", "#43668c"],
  ["#bd7f5c", "#f0dcc2", "#3f5f83"], ["#d9c39c", "#f4ead6", "#4a7597"],
  ["#b78a6a", "#eedfc8", "#456a8e"], ["#e0cba6", "#f6ecd8", "#517fa4"],
];
function building(x, z, w, h, d, ci) {
  const [base, trim, win] = HOUSE_COLORS[ci % HOUSE_COLORS.length];
  const tex = facadeTex(base, trim, win);
  const box = BABYLON.MeshBuilder.CreateBox("b" + ci + x, { width: w, height: h, depth: d }, scene);
  box.position.set(x, h / 2, z); box.material = stdMat("bm" + ci + x, tex); makeInk(box, 0.09);
  const roof = BABYLON.MeshBuilder.CreateCylinder("r" + ci + x, {
    diameterTop: 0.05, diameterBottom: Math.max(w, d) * 1.2, height: 1.9, tessellation: 4
  }, scene);
  roof.rotation.y = Math.PI / 4; roof.position.set(x, h + 0.95, z);
  roof.material = flatMat("rm" + ci + x, 0.52, 0.24, 0.20); makeInk(roof, 0.09);
  return box;
}
// west and east terraces, leaving the street open toward the tank
[-1, 1].forEach((side) => {
  for (let i = 0; i < 6; i++) {
    const z = 1 + i * 7.0;
    building(side * 11.6, z, 5.6, 8.0 + (i % 3) * 1.4, 6.4, i + (side > 0 ? 3 : 0));
  }
});

// ------------------------------------------------------------------ the tank
const tankTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = "#8d4a34"; g.fillRect(0, 0, w, h);
  // riveted steel plates
  const cols = 8, rows = 6;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * (w / cols), y = r * (h / rows);
    g.fillStyle = ["#93503a", "#8a4632", "#9b5741", "#8f4c37"][(r * 3 + c) % 4];
    g.fillRect(x + 2, y + 2, w / cols - 4, h / rows - 4);
    g.strokeStyle = "rgba(40,18,12,0.45)"; g.lineWidth = 3;
    g.strokeRect(x + 2, y + 2, w / cols - 4, h / rows - 4);
    g.fillStyle = "rgba(45,20,14,0.5)";
    for (let k = 0; k < 14; k++) {
      g.beginPath(); g.arc(x + 10 + rand() * (w / cols - 20), y + 10 + rand() * (h / rows - 20), 2.6, 0, 7); g.fill();
    }
  }
  // weathering
  for (let i = 0; i < 260; i++) {
    g.fillStyle = "rgba(30,14,10,0.10)";
    g.fillRect(rand() * w, rand() * h, 6 + rand() * 40, 2 + rand() * 8);
  }
  // molasses seeping from the seams
  for (let i = 0; i < 26; i++) {
    const x = rand() * w, y0 = rand() * h * 0.7, len = 90 + rand() * 320, wd = 7 + rand() * 16;
    const grd = g.createLinearGradient(0, y0, 0, y0 + len);
    grd.addColorStop(0, "rgba(46,20,12,0.8)"); grd.addColorStop(1, "rgba(46,20,12,0)");
    g.fillStyle = grd; g.fillRect(x, y0, wd, len);
  }
});
const tankDripTex = canvasTex(1024, 1024, (g, w, h) => {
  g.drawImage(tankTex.getContext().canvas, 0, 0);
  // fresh brown paint over old seams + the drips it was meant to hide
  g.fillStyle = "rgba(96,42,26,0.55)"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    const x = rand() * w, len = 120 + rand() * 520, wd = 10 + rand() * 26;
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, "rgba(58,24,14,0.85)"); grd.addColorStop(1, "rgba(58,24,14,0)");
    g.fillStyle = grd; g.fillRect(x, rand() * h * 0.4, wd, len);
  }
  for (let i = 0; i < 22; i++) {
    g.fillStyle = "rgba(120,60,34,0.5)";
    g.beginPath(); g.ellipse(rand() * w, rand() * h, 20 + rand() * 40, 12 + rand() * 26, 0, 0, 7); g.fill();
  }
});
const tankMat = stdMat("tankMat", tankTex);
tankTex.uScale = 3.0; tankTex.vScale = 1.6;
const TANK_Z = 30, TANK_R = 4.6, TANK_H = 11.0;
const tank = BABYLON.MeshBuilder.CreateCylinder("tank", { diameter: TANK_R * 2, height: TANK_H, tessellation: 44 }, scene);
tank.position.set(0, TANK_H / 2, TANK_Z); tank.material = tankMat; makeInk(tank, 0.09);
const tankTop = BABYLON.MeshBuilder.CreateCylinder("tankTop", { diameter: TANK_R * 2 + 0.5, height: 0.5, tessellation: 44 }, scene);
tankTop.position.set(0, TANK_H + 0.2, TANK_Z); tankTop.material = flatMat("tankTopMat", 0.42, 0.20, 0.15); makeInk(tankTop, 0.09);
const tankDuskMat = stdMat("tankDuskMat", tankDripTex); tankDripTex.uScale = 3.0; tankDripTex.vScale = 1.6;

// ------------------------------------------------------------------ the molasses
const molTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#7c4622"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = ["rgba(140,74,34,0.55)", "rgba(84,40,20,0.55)", "rgba(176,104,52,0.30)"][i % 3];
    g.beginPath(); g.ellipse(rand() * w, rand() * h, 20 + rand() * 70, 10 + rand() * 40, rand() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = "rgba(150,88,44,0.22)"; g.lineWidth = 1.5 + rand() * 3;
    g.beginPath(); g.moveTo(rand() * w, rand() * h);
    g.bezierCurveTo(rand() * w, rand() * h, rand() * w, rand() * h, rand() * w, rand() * h); g.stroke();
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = i % 2 ? "rgba(28,12,8,0.5)" : "rgba(112,58,30,0.28)";
    g.beginPath(); g.arc(rand() * w, rand() * h, 6 + rand() * 26, 0, 7); g.fill();
  }
});
const molMat = new BABYLON.StandardMaterial("molMat", scene);
molMat.diffuseTexture = molTex; molMat.specularColor = new BABYLON.Color3(0.55, 0.42, 0.34);
molMat.specularPower = 48; molTex.uScale = 2.6; molTex.vScale = 1.6;

const waveBody = BABYLON.MeshBuilder.CreateBox("wave", { width: 26, height: 1, depth: 10 }, scene);
waveBody.material = molMat; makeInk(waveBody, 0.09);
const crestMat = new BABYLON.StandardMaterial("crestMat", scene);
crestMat.diffuseTexture = molTex; crestMat.specularColor = new BABYLON.Color3(0.8, 0.68, 0.55);
crestMat.specularPower = 90; crestMat.emissiveColor = new BABYLON.Color3(0.16, 0.09, 0.05);
const waveCrest = BABYLON.MeshBuilder.CreateCylinder("crest", { diameter: 1.5, height: 26, tessellation: 18 }, scene);
waveCrest.rotation.z = Math.PI / 2; waveCrest.material = crestMat; makeInk(waveCrest, 0.09);
const puddle = BABYLON.MeshBuilder.CreateGround("puddle", { width: 18, height: 40 }, scene);
const puddleMat = new BABYLON.StandardMaterial("puddleMat", scene);
puddleMat.diffuseTexture = molTex; puddleMat.specularColor = new BABYLON.Color3(0.3, 0.22, 0.18);
puddle.material = puddleMat; puddle.position.set(0, 0.04, 12);

// steel panels and debris thrown by the burst
const steelMat = flatMat("steel", 0.30, 0.20, 0.17);
const panels = [];
for (let i = 0; i < 7; i++) {
  const p = BABYLON.MeshBuilder.CreateBox("panel" + i, { width: 1.1, height: 0.75, depth: 0.08 }, scene);
  p.material = steelMat; makeInk(p, 0.06);
  panels.push(p);
}
const rubbleMat = flatMat("rubble", 0.70, 0.64, 0.55);
const rubble = [];
for (let i = 0; i < 14; i++) {
  const r = BABYLON.MeshBuilder.CreateBox("rub" + i, {
    width: 0.9 + rand() * 1.9, height: 0.35 + rand() * 0.8, depth: 0.7 + rand() * 1.5
  }, scene);
  r.material = rubbleMat; makeInk(r, 0.05);
  rubble.push({ mesh: r, x: (rand() - 0.5) * 13, z: 3 + rand() * 20, y: 0.05 + rand() * 0.25, ry: rand() * 3 });
}

// ------------------------------------------------------------------ cast (2D cards with their own plum ink)
const CW = 600, CH = 1000, SOLES = 975;
function makeCard(name, width, height) {
  const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
  const tex = new BABYLON.DynamicTexture(name + "Tex", { width: CW, height: CH }, scene, true);
  tex.hasAlpha = true; tex.vScale = -1; tex.vOffset = 1;
  const mat = new BABYLON.StandardMaterial(name + "Mat", scene);
  mat.diffuseTexture = tex; mat.emissiveTexture = tex;
  mat.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0.8);
  mat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mat.backFaceCulling = false; mat.useAlphaFromDiffuseTexture = true;
  mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST; mat.alphaCutOff = 0.35;
  const plane = BABYLON.MeshBuilder.CreatePlane(name, { width, height }, scene);
  plane.material = mat; plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  return { plane, tex, cv, ctx: cv.getContext("2d") };
}

function inkShape(ctx, fill, lw, build) {
  ctx.lineWidth = lw || 13; ctx.strokeStyle = PLUM; ctx.fillStyle = fill;
  build(); ctx.fill(); ctx.stroke();
}
function limb(ctx, x0, y0, x1, y1, w, color) {
  ctx.strokeStyle = PLUM; ctx.lineWidth = w + 16; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

/* pose: 'walk' | 'run' | 'stand' | 'paint' | 'reach' */
function drawPerson(card, o) {
  const ctx = card.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, CW, CH);
  const ph = o.phase || 0;
  const bob = o.pose === "stand" ? 0 : Math.sin(ph * Math.PI * 4) * (o.pose === "run" ? 14 : 8);
  const swing = o.pose === "run" ? 0.5 : o.pose === "walk" ? 0.2 : 0.0;
  const legA = Math.sin(ph * Math.PI * 2) * swing;
  const armA = -Math.sin(ph * Math.PI * 2) * swing * 1.2;
  const lean = o.pose === "run" ? 0.16 : o.pose === "walk" ? 0.05 : 0.0;
  const hipY = 660, shoulderY = 372, headCY = 210, headW = 250, headH = 268;
  ctx.save();
  ctx.translate(CW / 2, bob); ctx.rotate(lean * 0.35);

  // legs
  const legLen = SOLES - hipY;
  [-1, 1].forEach((s) => {
    const a = legA * s + (o.pose === "stand" ? s * 0.04 : 0);
    const kx = s * 46 + Math.sin(a) * legLen * 0.5;
    const fx = s * 46 + Math.sin(a) * legLen * 0.95;
    limb(ctx, s * 46, hipY, kx, hipY + legLen * 0.5, 34, o.pants);
    limb(ctx, kx, hipY + legLen * 0.5, fx, SOLES - 14, 30, o.pants);
    ctx.save(); ctx.translate(fx, SOLES - 12); ctx.rotate(a * 0.5);
    inkShape(ctx, o.boots || "#2c2230", 12, () => { ctx.beginPath(); ctx.ellipse(10, 0, 40, 20, 0, 0, 7); });
    ctx.restore();
  });

  // torso
  inkShape(ctx, o.jacket, 13, () => {
    ctx.beginPath(); ctx.moveTo(-86, shoulderY);
    ctx.bezierCurveTo(-104, 470, -92, 600, -74, hipY + 6);
    ctx.lineTo(74, hipY + 6); ctx.bezierCurveTo(92, 600, 104, 470, 86, shoulderY);
    ctx.closePath();
  });
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-86, shoulderY);
  ctx.bezierCurveTo(-104, 470, -92, 600, -74, hipY + 6);
  ctx.lineTo(74, hipY + 6); ctx.bezierCurveTo(92, 600, 104, 470, 86, shoulderY);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = "rgba(60,26,60,0.20)"; ctx.fillRect(28, 300, 120, 420);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(-96, 300, 58, 420);
  ctx.restore();
  if (o.apron) inkShape(ctx, o.apron, 10, () => {
    ctx.beginPath(); ctx.roundRect(-44, 470, 88, 180, 26);
  });

  // arms
  [-1, 1].forEach((s) => {
    let ex, ey;
    if (o.pose === "paint" && s > 0) { ex = 128; ey = shoulderY - 60; }
    else if (o.pose === "reach" && s > 0) { ex = 150; ey = shoulderY - 20; }
    else if (o.pose === "run") { ex = s * 120 + Math.sin(armA * s) * 60; ey = shoulderY + 90; }
    else { ex = s * 116 + Math.sin(armA * s) * 118; ey = shoulderY + 168 + Math.cos(armA * s) * 34; }
    limb(ctx, s * 74, shoulderY + 30, ex, ey, 28, o.jacket);
    ctx.fillStyle = PLUM; ctx.beginPath(); ctx.arc(ex, ey, 15, 0, 7); ctx.fill();
    if (o.pose === "paint" && s > 0) {  // brush
      ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 12; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 54, ey - 78); ctx.stroke();
      ctx.fillStyle = "#3a1d12";
      ctx.beginPath(); ctx.ellipse(ex + 60, ey - 90, 18, 12, -0.9, 0, 7); ctx.fill();
    }
  });

  // neck + head
  ctx.fillStyle = o.skin || "#ffe2c2"; ctx.strokeStyle = PLUM; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.rect(-30, headCY + 110, 60, 60); ctx.fill(); ctx.stroke();
  inkShape(ctx, o.skin || "#ffe2c2", 14, () => {
    ctx.beginPath(); ctx.moveTo(0, headCY - headH / 2);
    ctx.bezierCurveTo(headW * 0.46, headCY - headH / 2, headW / 2, headCY - headH * 0.18, headW / 2, headCY + headH * 0.02);
    ctx.bezierCurveTo(headW / 2, headCY + headH * 0.34, headW * 0.30, headCY + headH / 2, 0, headCY + headH / 2);
    ctx.bezierCurveTo(-headW * 0.30, headCY + headH / 2, -headW / 2, headCY + headH * 0.34, -headW / 2, headCY + headH * 0.02);
    ctx.bezierCurveTo(-headW / 2, headCY - headH * 0.18, -headW * 0.46, headCY - headH / 2, 0, headCY - headH / 2);
    ctx.closePath();
  });
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, headCY, headW / 2, headH / 2, 0, 0, 7); ctx.clip();
  ctx.fillStyle = "rgba(190,120,120,0.22)"; ctx.fillRect(40, headCY - headH, 200, headH * 2);
  ctx.restore();

  if (o.hat === "cap") {
    inkShape(ctx, "#2f3a4a", 12, () => {
      ctx.beginPath(); ctx.moveTo(-headW / 2 + 4, headCY - headH * 0.14);
      ctx.bezierCurveTo(-headW * 0.44, headCY - headH * 0.68, headW * 0.44, headCY - headH * 0.68, headW / 2 - 4, headCY - headH * 0.14);
      ctx.closePath();
    });
    inkShape(ctx, "#3a4759", 11, () => {
      ctx.beginPath(); ctx.ellipse(46, headCY - headH * 0.16, 110, 22, 0.12, 0, 7);
    });
  } else if (o.hat === "bonnet") {
    inkShape(ctx, o.hatColor || "#c8d3e0", 12, () => {
      ctx.beginPath(); ctx.ellipse(0, headCY - 10, headW * 0.62, headH * 0.66, 0, Math.PI, 0);
      ctx.closePath();
    });
  } else {
    inkShape(ctx, o.hair || "#4a3324", 12, () => {
      ctx.beginPath(); ctx.moveTo(-headW / 2 + 6, headCY - headH * 0.12);
      ctx.bezierCurveTo(-headW * 0.46, headCY - headH * 0.62, headW * 0.46, headCY - headH * 0.62, headW / 2 - 6, headCY - headH * 0.12);
      ctx.bezierCurveTo(headW * 0.22, headCY - headH * 0.30, -headW * 0.22, headCY - headH * 0.30, -headW / 2 + 6, headCY - headH * 0.12);
      ctx.closePath();
    });
  }

  // face
  const eyeDx = 40, eyeY = headCY + 18;
  [-1, 1].forEach((s) => {
    ctx.fillStyle = PLUM;
    ctx.beginPath(); ctx.ellipse(s * eyeDx, eyeY, 15, 20, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = PLUM; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(s * eyeDx - 22, eyeY - 26); ctx.lineTo(s * eyeDx + 22, eyeY - 26); ctx.stroke();
  });
  [-1, 1].forEach((s) => {
    ctx.strokeStyle = PLUM; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(s * eyeDx - 20, eyeY - 52); ctx.lineTo(s * eyeDx + 20, eyeY - 60); ctx.stroke();
  });
  ctx.strokeStyle = PLUM; ctx.lineWidth = 9; ctx.lineCap = "round";
  if (o.mouth === "o") { ctx.beginPath(); ctx.arc(0, headCY + 82, 20, 0, 7); ctx.fillStyle = "#5a1e28"; ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(-26, headCY + 88); ctx.quadraticCurveTo(0, headCY + (o.mouth === "sad" ? 78 : 96), 26, headCY + 88); ctx.stroke(); }
  ctx.restore();

  const g2 = ctx.createRadialGradient(CW / 2, SOLES + 6, 6, CW / 2, SOLES + 6, 130);
  g2.addColorStop(0, "rgba(40,20,45,0.40)"); g2.addColorStop(1, "rgba(40,20,45,0)");
  ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(CW / 2, SOLES + 8, 150, 34, 0, 0, 7); ctx.fill();

  card.tex.getContext().clearRect(0, 0, CW, CH);
  card.tex.getContext().drawImage(card.cv, 0, 0);
  card.tex.update(false);
}

const worker = makeCard("worker", 1.35, 2.25);
const kidA = makeCard("kidA", 1.05, 1.75);
const woman = makeCard("woman", 1.3, 2.15);
const worker2 = makeCard("worker2", 1.35, 2.25);

const OUTFIT_W = { jacket: "#4a5f7a", pants: "#2f3a4a", boots: "#241c26", hat: "cap", apron: "#6d5b47", skin: "#e8bf9c" };
const OUTFIT_K = { jacket: "#e0603f", pants: "#3a4a72", boots: "#2c2230", hair: "#4a3324", skin: "#ffe2c2" };
const OUTFIT_WM = { jacket: "#7a4a6d", pants: "#3a3450", boots: "#2c2230", hat: "bonnet", hatColor: "#d9c9b0", skin: "#f7d3b0" };

// ------------------------------------------------------------------ camera
const cam = new BABYLON.FreeCamera("cam", V3(0, 1.7, -8), scene);
cam.fov = 0.86; cam.minZ = 0.1;
let shakeAmt = 0;
function shake(f) {
  const t = f / FPS;
  return V3(Math.sin(t * 91.7) * shakeAmt, Math.cos(t * 77.3) * shakeAmt * 0.8, 0);
}

// ------------------------------------------------------------------ shot state
function shotAt(f) {
  for (let i = 0; i < LINES.length; i++) {
    const L = LINES[i];
    const next = i + 1 < LINES.length ? LINES[i + 1].a : TOTAL;
    if (f >= L.a && f < next) return { i, L, u: (f - L.a) / Math.max(1, next - L.a) };
  }
  return { i: LINES.length - 1, L: LINES[LINES.length - 1], u: 1 };
}

function hideAll() {
  [worker, kidA, woman, worker2].forEach((c) => c.plane.setEnabled(false));
  panels.forEach((p) => p.setEnabled(false));
  rubble.forEach((r) => r.mesh.setEnabled(false));
  waveBody.setEnabled(false); waveCrest.setEnabled(false); puddle.setEnabled(false);
  flashLayer.isEnabled = false;
}

// wave geometry from a height + front position
function setWave(h, zFront, zBack) {
  if (h <= 0.02) { waveBody.setEnabled(false); waveCrest.setEnabled(false); return; }
  waveBody.setEnabled(true); waveCrest.setEnabled(true);
  const depth = Math.max(1.2, zBack - zFront);
  waveBody.scaling = V3(1, h, 1);
  waveBody.position.set(0, h / 2, zFront + depth / 2);
  waveBody.scaling.z = depth / 10;
  waveCrest.scaling = V3(1, 1, depth / 1.5);
  waveCrest.position.set(0, h, zFront + 0.75);
}

function poseCard(card, x, y, z, scale, opts) {
  card.plane.setEnabled(true);
  card.plane.position.set(x, y, z);
  card.plane.scaling.setAll(scale);
  drawPerson(card, opts);
}

// ------------------------------------------------------------------ frame
function renderFrame(f) {
  hideAll();
  const { i, L, u } = shotAt(f);
  applyLight("day"); skyLayer.texture = SKY.day; scene.fogDensity = 0.0085;
  tank.setEnabled(true); tankTop.setEnabled(true);
  if (tank.material === tankDuskMat) tank.material = tankMat;
  shakeAmt = 0;
  const t = f / FPS;
  const ev = (name) => (EV[name] || 0);

  // ============ S1 hook: the street, the tank at the end of it
  if (i === 0) {
    const k = smooth(u);
    cam.position = V3(lerp(0.5, 0.2, k), lerp(1.85, 1.75, k), lerp(-3.2, 0.4, k));
    cam.setTarget(V3(0.15, lerp(5.6, 5.0, k), 30));
    cam.fov = 0.92;
    poseCard(worker, 2.3, 1.12, 13.0, 1.0, { ...OUTFIT_W, pose: "walk", phase: t * 1.1 });
    poseCard(kidA, 1.2, 0.86, 15.6, 1.0, { ...OUTFIT_K, pose: "walk", phase: t * 1.35 });
  }
  // ============ S2 set: low angle up eight metres of steel
  else if (i === 1) {
    const k = smooth(u);
    cam.position = V3(lerp(3.6, 2.6, k), lerp(0.8, 0.95, k), lerp(11.8, 10.6, k));
    cam.setTarget(V3(lerp(-0.1, 0, k), lerp(3.4, 8.2, smooth(k)), 30));
    cam.fov = 0.95;
    poseCard(worker, 2.5, 1.12, 18.2, 1.0, { ...OUTFIT_W, pose: "stand", phase: 0 });
  }
  // ============ S3 leak: the seams, the brown paint, the drips
  else if (i === 2) {
    const k = smooth(u);
    cam.position = V3(lerp(3.9, 3.2, k), lerp(2.2, 2.4, k), lerp(15.0, 16.0, k));
    cam.setTarget(V3(lerp(0.7, 0.4, k), lerp(4.3, 4.5, k), 25.4));
    cam.fov = 1.05;
    poseCard(worker, 2.7, 1.12, 20.2, 1.0, { ...OUTFIT_W, pose: "paint", phase: 0 });
    poseCard(kidA, 4.9, 0.86, 19.6, 0.95, { ...OUTFIT_K, pose: "reach", phase: 0, mouth: "o" });
  }
  // ============ S4 snap: the steel tears
  else if (i === 3) {
    const b = EV.burst;
    const kb = clamp01((f - b) / 18);
    const k = smooth(u);
    cam.position = V3(lerp(-0.6, 0.5, k), lerp(2.1, 2.5, k), lerp(8.6, 6.8, k));
    cam.setTarget(V3(0.1, lerp(4.4, 4.8, k), 26));
    cam.fov = 1.05;
    if (f < b) {
      poseCard(worker2, -3.4, 1.12, 17.0, 1.0, { ...OUTFIT_W, pose: "stand", phase: 0 });
    } else {
      tank.setEnabled(false); tankTop.setEnabled(false);
      const dt = (f - b) / FPS;
      shakeAmt = Math.max(0, 0.55 - dt * 1.3);
      if (f - b < 2) { flashLayer.isEnabled = true; flashLayer.alpha = 0.8 - (f - b) * 0.35; }
      panels.forEach((p, idx) => {
        p.setEnabled(true);
        const a = idx / panels.length * Math.PI * 2;
        const sp = 3.2 + idx * 0.35;
        p.position.set(Math.cos(a) * sp * dt * 2.4, 5.4 + Math.sin(a) * 2.6 * dt, 25.4 - 7.5 * dt);
        p.rotation.set(dt * 4 + idx, dt * 5.2, dt * 3.1);
      });
      setWave(lerp(1.0, 7.6, smooth(kb)), lerp(25.5, 18.0, kb), lerp(30, 26, kb));
      poseCard(worker2, -3.4, 1.12, 17.0, 1.0, { ...OUTFIT_W, pose: "run", phase: t * 2.2, mouth: "o" });
    }
  }
  // ============ S5 dead: luckily, molasses is slow
  else if (i === 4) {
    const k = smooth(u);
    cam.position = V3(lerp(0.9, -0.2, k), 1.55, lerp(-1.4, 0.4, k));
    cam.setTarget(V3(0, lerp(2.4, 2.8, k), 15));
    cam.fov = 1.05;
    const front = lerp(13.5, 8.5, smooth(u * 1.05));
    setWave(6.6, front, front + 7);
    poseCard(worker, -1.9, 1.12, 8.2, 1.05, { ...OUTFIT_W, pose: "run", phase: t * 2.4, mouth: "o" });
    poseCard(woman, 1.9, 1.08, 9.4, 1.0, { ...OUTFIT_WM, pose: "run", phase: t * 2.2 + 0.4, mouth: "o" });
    poseCard(kidA, 0.2, 0.86, 6.8, 1.0, { ...OUTFIT_K, pose: "run", phase: t * 2.6 + 0.7, mouth: "o" });
  }
  // ============ S6 why: gravity current, then it cools and stops being a wave
  else if (i === 5) {
    const ts = EV.tsunami, co = EV.cooled;
    const k = smooth(u);
    if (f < ts) {
      cam.position = V3(lerp(-7.0, -6.0, k), lerp(7.2, 6.4, k), lerp(-2.5, -1.0, k));
      cam.setTarget(V3(0.6, lerp(3.0, 2.6, k), 17.5));
      cam.fov = 1.05;
      const front = lerp(19.5, 15.0, smooth(u * 1.4));
      setWave(7.4, front, front + 8);
    } else if (f < co) {
      const kk = clamp01((f - ts) / Math.max(1, co - ts));
      cam.position = V3(lerp(0.6, -0.6, kk), 1.4, lerp(-1.5, 0.5, kk));
      cam.setTarget(V3(0, 4.0, 13));
      cam.fov = 1.05;
      const front = lerp(14.0, 9.0, smooth(kk));
      setWave(7.6, front, front + 9);
      shakeAmt = 0.05;
    } else {
      const kk = clamp01((f - co) / 70);
      applyLight("cold"); skyLayer.texture = SKY.cold;
      cam.position = V3(lerp(-4.6, -3.6, kk), lerp(3.8, 3.2, kk), lerp(-7.0, -5.4, kk));
      cam.setTarget(V3(-0.2, lerp(1.6, 1.1, kk), 11.0));
      cam.fov = 1.05;
      setWave(lerp(7.4, 2.4, smooth(kk)), lerp(5.6, 3.6, smooth(kk)), 12.5);
    }
  }
  // ============ S7 conseq: what it left, and the rule that followed
  else if (i === 6) {
    applyLight("cold"); skyLayer.texture = SKY.cold; scene.fogDensity = 0.012;
    tank.setEnabled(false); tankTop.setEnabled(false);
    const k = 1 - (1 - clamp01(u)) * (1 - clamp01(u));
    cam.position = V3(lerp(-2.4, -1.2, k), lerp(1.85, 1.55, k), lerp(-4.0, -1.0, k));
    cam.setTarget(V3(0.4, lerp(2.2, 1.9, k), 15));
    cam.fov = 0.9;
    puddle.setEnabled(true);
    rubble.forEach((r) => {
      r.mesh.setEnabled(true);
      r.mesh.position.set(r.x, r.y, r.z);
      r.mesh.rotation.set(0, r.ry, 0.12);
    });
    poseCard(worker, 1.4, 1.12, 10.5, 1.0, { ...OUTFIT_W, pose: "stand", phase: 0, mouth: "sad" });
  }
  // ============ S8 twist: it was painted brown so nobody would notice
  else {
    applyLight("dusk"); skyLayer.texture = SKY.dusk; scene.fogDensity = 0.009;
    const k = smooth(u);
    tank.material = tankDuskMat;
    cam.position = V3(lerp(4.6, 3.6, k), lerp(6.4, 6.9, k), lerp(17.6, 18.8, k));
    cam.setTarget(V3(lerp(0.9, 0.4, k), lerp(6.2, 6.6, k), 25.4));
    cam.fov = 0.8;
  }

  // camera shake on top of the shot pose
  if (shakeAmt > 0) cam.position = cam.position.add(shake(f));

  scene.render(); scene.render();
  return canvas.toDataURL("image/png");
}

// warm-up: render one frame from each shot twice so every material compiles
[0, 220, 446, 560, 700, 900, 1000, 1150, 1300].forEach((f) => { renderFrame(f); renderFrame(f); });
hideAll(); scene.render();
window.renderFrame = renderFrame;
window.TOTAL = TOTAL;
window.__ready = true;
