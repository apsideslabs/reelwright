import * as THREE from 'three';
import { FPS, DUR, T, LINES } from './timeline.js';
import { FILM } from './film.js';
import * as K from './scene-kit.js';

// =====================================================================
//  The Mountain Nobody Saw — five locations, eight shots, a moving cast
//  Peak XV, 1852. Every cut derives from T (measured speech).
// =====================================================================
const Q = new URLSearchParams(location.search);
const app = K.createApp({
  w: parseInt(Q.get('w') || '1080', 10),
  h: parseInt(Q.get('h') || '1920', 10),
  exposure: 1.22, shadows: true
});
const { scene, camera } = app;

const rig = await K.loadRig('./assets/readyplayer.me.glb');
const envelope = await fetch('./envelope.json').then(r => r.json()).catch(() => null);

const CLERK = { height: 1.70, top: 0x35507a, bottom: 0x1e2434, skin: 0x9a7150, hair: 0x1a1410,
  hide: ['Wolf3D_Headwear', 'Wolf3D_Beard'] };
const SURVEYOR = { height: 1.76, top: 0x38465c, bottom: 0x252c3a, skin: 0x9a7150, hair: 0x1a1410,
  hide: ['Wolf3D_Headwear', 'Wolf3D_Beard'] };
const OFFICIAL_A = { height: 1.74, top: 0x453a56, bottom: 0x272733, skin: 0xbe9773 };
const OFFICIAL_B = { height: 1.72, top: 0x2b3849, bottom: 0x22242e, skin: 0xc4a07c, hide: ['Wolf3D_Beard'] };

const PEAK = [
  [-3.2, -26], [-2.0, -16], [-1.0, -10.5], [-0.1, -5.6], [0.8, -1.2],
  [1.7, 3.0], [2.5, 6.4], [3.3, 9.0], [4.1, 10.6], [4.9, 11.2],
  [5.6, 10.3], [6.3, 8.9], [7.1, 7.2], [7.9, 5.4],
  [8.7, 6.2], [9.5, 4.0], [10.4, 1.4], [11.4, -2.4], [12.6, -8.0], [13.8, -15], [14.8, -26]
];
const DUSK = [[0, '#060c16'], [0.32, '#0f2036'], [0.58, '#25415e'], [0.84, '#7d5334'], [1, '#c9873f']];

function addHair(human, colour = 0x1b1512) {
  const head = human.bones.Head;
  if (!head) return;
  const hairMat = K.mat(colour);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
  cap.position.set(0, 0.104, -0.030); cap.scale.set(1.03, 1.05, 1.1);
  cap.castShadow = true; head.add(cap);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 12), hairMat);
  back.position.set(0, 0.056, -0.078); back.scale.set(1.12, 1.3, 1.0);
  head.add(back);
}
function legs(h) {
  K.boneRot(h, 'LeftUpLeg'); K.boneRot(h, 'RightUpLeg');
  K.boneRot(h, 'LeftLeg'); K.boneRot(h, 'RightLeg');
}
function shake(t, amp = 0.005) {
  const h = K.handheld(t, amp);
  camera.position.x += h.x;
  camera.position.y += h.y;
  camera.rotation.z += h.roll;
}
function outsidePeak(group, z, scale, x) {
  K.plane(300, 200, new THREE.MeshBasicMaterial({ map: K.gradientTex(DUSK) }), 0, 8, z - 40, group);
  const p = K.peakGroup(PEAK, { scale, z: z - 20, lit: 0x9fb3c9, shadow: 0x64788f, snow: 0xd8e6f5 });
  p.position.x = x;
  group.add(p);
  return p;
}

// =====================================================================
//  1 · the Calcutta office — he walks in, then a close-up
// =====================================================================
function office(group) {
  const L = K.threePoint(group, {
    keyColor: 0xffc98a, keyIntensity: 3.6, keyPos: [3.6, 3.6, 2.2], shadowMap: 512,
    fillColor: 0x7d9ac6, fillIntensity: 2.0, fillPos: [-3.4, 2.2, 2.4],
    ambientColor: 0x8fa2bd, ambient: 2.2,
    practical: { color: 0xffcf94, intensity: 16, distance: 10, pos: [0.6, 2.9, -2.2] }
  });

  const floor = K.plane(30, 24, K.mat(0x2a2118), 0, 0, 0, group);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  K.windowOpening(group, { w: 1.9, h: 2.5, x: 2.9, y: 3.3, z: -7.4, wallMat: K.mat(0x23304a) });
  outsidePeak(group, -7.4, 0.5, 1.1);

  for (let i = 0; i < 3; i++) {
    K.box(2.5, 0.08, 0.5, 0x2a1e14, -2.0, 1.55 + i * 0.66, -5.6, group);
    for (let k = 0; k < 5; k++) {
      K.box(0.17, 0.4, 0.32, [0x8a6a4a, 0x6d7f96, 0x9a7b52, 0x5d6b52, 0x7a5c46][k], -2.85 + k * 0.42, 1.78 + i * 0.66, -5.6, group);
    }
  }

  K.box(3.0, 0.1, 1.2, 0x6b4a2f, 0.55, 0.78, -3.2, group);
  for (const dx of [-1.25, 1.25]) for (const dz of [-0.42, 0.42]) {
    K.box(0.1, 0.78, 0.1, 0x53381f, 0.55 + dx, 0.39, -3.2 + dz, group);
  }
  K.box(0.8, 0.02, 0.55, 0xe8e0c8, 0.2, 0.84, -3.1, group);
  K.box(0.55, 0.02, 0.4, 0x2f2a22, 1.15, 0.84, -3.05, group);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), K.flat(0xffe6bd));
  bulb.position.set(0.6, 2.55, -2.3); group.add(bulb);

  const dust = K.motes(group, { count: 110, centre: [0.7, 2.2, -3.0], spread: [5, 3.4, 4], size: 0.02, opacity: 0.4 });

  const clerk = K.makeHuman(rig, CLERK);
  addHair(clerk);
  clerk.root.position.set(3.2, 0, -3.9);
  clerk.root.rotation.y = -0.32;
  group.add(clerk.root);

  const WALK_A = 0.15, WALK_B = 2.4;
  const pick = K.shotPicker([
    { t0: -1, t1: T.s2 ?? 5, cam(u, t) {
        camera.position.set(K.lerp(2.0, 1.35, u), K.lerp(1.98, 1.86, u), K.lerp(6.0, 5.2, u));
        camera.lookAt(K.lerp(1.1, 0.9, u), K.lerp(1.55, 1.45, u), -3.4);
        shake(t);
      } },
    { t0: T.s2 ?? 5, t1: 999, cam(u, t) {
        camera.position.set(K.lerp(1.3, 1.15, u), K.lerp(1.68, 1.63, u), K.lerp(-1.45, -1.2, u));
        camera.lookAt(0.78, 1.55, -3.9);
        shake(t, 0.003);
      } }
  ]);

  return {
    camera(u, t) { pick(t); },
    update(t) {
      const walking = t > WALK_A && t < WALK_B;
      clerk.root.position.x = K.lerp(3.2, 0.75, K.smooth(K.seg(t, WALK_A, WALK_B)));
      if (walking) {
        K.walkCycle(clerk, t, { speed: 1.05, amp: 0.5 });
        K.headLook(clerk, -0.25, 0.1);
      } else {
        K.poseHuman(clerk, K.POSE.write, 1);
        legs(clerk);
        const looking = t > (T.s2 ?? 5);
        K.headLook(clerk, looking ? -0.5 : -0.15, looking ? -0.2 : 0.16);
      }
      const talking = K.speaking(LINES, 'l1', t) || K.speaking(LINES, 'l2', t);
      K.speak(clerk, K.mouthAt(envelope, t) * (talking ? 1 : 0));
      L.practical.intensity = 16 * (1 + 0.035 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 2.1));
      dust.update(t);
    }
  };
}

// =====================================================================
//  2 · the plains — the surveyor walks to the instrument
// =====================================================================
function plain(group) {
  K.threePoint(group, {
    keyColor: 0xffb877, keyIntensity: 2.5, keyPos: [-6, 4.5, 6],
    fillColor: 0x5f7fae, fillIntensity: 1.5, fillPos: [5, 3, 4],
    ambientColor: 0x4f6076, ambient: 1.4
  });

  K.plane(400, 260, new THREE.MeshBasicMaterial({ map: K.gradientTex(DUSK) }), 0, 14, -110, group);
  const ground = K.plane(120, 70, K.mat(0x3a4a3c), 0, -0.02, -18, group);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;

  for (const [seed, base, amp, z, col] of [[11, 3, 7.5, -74, 0x2b3f57], [23, 1.5, 6.0, -58, 0x21324a], [37, 0.5, 5.0, -44, 0x18263a]]) {
    const m = K.strip(K.ridgePts(seed, -90, 90, base, amp, 24), col);
    m.position.z = z; group.add(m);
  }
  const peak = K.peakGroup(PEAK, { scale: 0.9, z: -40 });
  peak.position.x = 2.5; group.add(peak);

  const tx = -0.1, tz = -2.6;
  for (const [dx, dz, rz] of [[-0.32, -0.22, 0.2], [0.32, -0.22, -0.2], [0, 0.32, 0]]) {
    const leg = K.cyl(0.028, 0.028, 0.95, 0x2a3240, tx + dx, 0.46, tz + dz, group);
    leg.rotation.z = rz; leg.rotation.x = dz * 0.35;
  }
  K.box(0.24, 0.18, 0.24, 0x33404f, tx, 0.98, tz, group);
  const barrel = K.cyl(0.05, 0.05, 0.6, 0x3d4a5a, tx + 0.1, 1.14, tz, group);
  barrel.rotation.z = -Math.PI / 2.6;

  const surveyor = K.makeHuman(rig, SURVEYOR);
  addHair(surveyor);
  surveyor.root.position.set(-2.3, 0, -3.4);
  surveyor.root.rotation.y = -0.18;
  group.add(surveyor.root);

  for (const [x, z] of [[-2.0, -6.0], [3.0, -7.2]]) {
    K.cyl(0.022, 0.022, 0.8, 0xd9c48a, x, 0.4, z, group);
  }
  const clouds = K.motes(group, { count: 26, centre: [2, 6, -34], spread: [40, 6, 10], size: 0.5, opacity: 0.05, colour: 0xc8d8ea, seed: 21 });

  const WA = (T.s3 ?? 7) + 0.2, WB = (T.s3 ?? 7) + 2.4;
  const pick = K.shotPicker([
    { t0: T.s3 ?? 7, t1: T.s4 ?? 11, cam(u, t) {
        camera.position.set(K.lerp(1.7, 1.1, u), K.lerp(1.95, 1.82, u), K.lerp(7.2, 6.3, u));
        camera.lookAt(K.lerp(0.5, 0.35, u), K.lerp(1.75, 1.8, u), -11);
        shake(t);
      } },
    { t0: T.s4 ?? 11, t1: T.s5 ?? 14, cam(u, t) {
        camera.position.set(K.lerp(-0.4, -0.15, u), K.lerp(0.7, 0.78, u), K.lerp(0.95, 0.6, u));
        camera.lookAt(K.lerp(1.0, 1.3, u), K.lerp(1.5, 1.62, u), -14);
        shake(t, 0.004);
      } },
    { t0: T.s5 ?? 14, t1: 999, cam(u, t) {
        camera.position.set(K.lerp(2.5, 2.15, u), K.lerp(1.62, 1.54, u), K.lerp(1.6, 1.2, u));
        camera.lookAt(0.8, 1.45, -3.6);
        shake(t, 0.004);
      } }
  ]);

  return {
    camera(u, t) { pick(t); },
    update(t) {
      const walking = t > WA && t < WB;
      surveyor.root.position.x = K.lerp(-2.3, 0.85, K.smooth(K.seg(t, WA, WB)));
      if (walking) {
        K.walkCycle(surveyor, t, { speed: 1.1, amp: 0.52 });
        K.headLook(surveyor, 0.1, 0.05);
      } else {
        K.poseHuman(surveyor, t > WB ? K.POSE.pointUp : K.POSE.talk, 1);
        legs(surveyor);
        K.headLook(surveyor, t > WB ? -0.2 : 0.15, t > WB ? -0.22 : 0);
      }
      const talking = K.speaking(LINES, 'l5', t);
      K.speak(surveyor, K.mouthAt(envelope, t) * (talking ? 1 : 0));
      clouds.update(t);
    }
  };
}

// =====================================================================
//  3 · the summit — snow, arcs, a push into the snow line
// =====================================================================
function summit(group) {
  K.threePoint(group, {
    keyColor: 0xffc48a, keyIntensity: 3.0, keyPos: [-8, 6, 5],
    fillColor: 0x6d8dbb, fillIntensity: 1.4, fillPos: [6, 4, 3],
    ambientColor: 0x54687f, ambient: 1.5, shadows: false
  });

  K.plane(400, 260, new THREE.MeshBasicMaterial({
    map: K.gradientTex([[0, '#070d18'], [0.3, '#12253d'], [0.62, '#2c4a6b'], [0.86, '#b5763f'], [1, '#e0a15c']])
  }), 0, 10, -110, group);

  const peak = K.peakGroup(PEAK, { scale: 0.92, z: -16, lit: 0xd8e1ec, shadow: 0x93a8c2 });
  peak.position.x = -2.1; group.add(peak);

  const arcTex = K.canvasTex(720, 720, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(w / 2, h * 1.02, 170 + i * 58, Math.PI * 1.14, Math.PI * 1.86);
      g.strokeStyle = `rgba(255,196,110,${0.5 - i * 0.13})`;
      g.lineWidth = 5 - i;
      g.stroke();
    }
  });
  const arcs = K.plane(12, 12, new THREE.MeshBasicMaterial({ map: arcTex, transparent: true, depthWrite: false }), -2.1, 4.4, -10, group);
  K.plane(26, 10, new THREE.MeshBasicMaterial({ map: K.softDot('#ffd8a0', 0.28), transparent: true, depthWrite: false }), -1.0, 5.0, -13, group);
  const snow = K.snowfall(group, { count: 220, centre: [-1, 6, -9], area: [22, 14, 10], size: 0.045, speed: 0.85 });

  const cut = (T.s6 ?? 20) + 2.2;
  const pick = K.shotPicker([
    { t0: T.s6 ?? 20, t1: cut, cam(u, t) {
        camera.position.set(K.lerp(-0.8, 0.1, u), K.lerp(4.9, 5.5, u), K.lerp(20.5, 17.5, u));
        camera.lookAt(K.lerp(-0.7, -0.1, u), K.lerp(6.6, 7.1, u), -16);
        shake(t, 0.004);
      } },
    { t0: cut, t1: 999, cam(u, t) {
        camera.position.set(K.lerp(-1.5, -0.4, u), K.lerp(7.2, 8.1, u), K.lerp(11.0, 8.2, u));
        camera.lookAt(K.lerp(-2.0, -1.4, u), K.lerp(8.6, 9.2, u), -16);
        shake(t, 0.0035);
      } }
  ]);

  return {
    camera(u, t) { pick(t); },
    update(t) {
      arcs.material.opacity = 0.55 + 0.45 * Math.sin(t * 1.2);
      snow.update(t);
    }
  };
}

// =====================================================================
//  4 · the map room — two men, a table, the same mountain outside
// =====================================================================
function mapRoom(group) {
  const L = K.threePoint(group, {
    keyColor: 0xffcf9a, keyIntensity: 2.9, keyPos: [2.8, 4.0, 2.6], shadowMap: 512,
    fillColor: 0x7f8fc4, fillIntensity: 1.2, fillPos: [-3.6, 2.4, 2.0],
    ambientColor: 0x6a6480, ambient: 1.5,
    practical: { color: 0xffc98a, intensity: 12, distance: 9, pos: [0.8, 2.6, -2.4] }
  });

  const floor = K.plane(30, 24, K.mat(0x1d1a24), 0, 0, 0, group);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  K.windowOpening(group, { w: 1.6, h: 2.9, x: 3.4, y: 3.6, z: -7.4, wallMat: K.mat(0x2c2437) });
  outsidePeak(group, -7.4, 0.5, 2.6);

  const mapTex = K.canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,70,90,0.3)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = 'rgba(120,90,60,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(300, 150, 40 + i * 26, 26 + i * 17, 0.2, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(190,60,50,0.9)'; g.beginPath(); g.arc(300, 150, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(190,60,50,0.8)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(300, 150); g.lineTo(392, 96); g.stroke();
    g.fillStyle = 'rgba(40,45,60,0.75)'; g.font = 'bold 20px "DejaVu Sans", sans-serif';
    g.fillText('PEAK XV', 330, 84);
  });

  K.box(2.3, 0.1, 1.3, 0x5d4029, 0.55, 0.86, -3.0, group);
  for (const [x, z] of [[-0.4, -3.5], [1.5, -3.5], [-0.4, -2.5], [1.5, -2.5]]) {
    K.box(0.09, 0.86, 0.09, 0x4a321f, x, 0.43, z, group);
  }
  const mapPlane = K.plane(1.75, 1.05, new THREE.MeshLambertMaterial({ map: mapTex }), 0.55, 0.92, -3.0, group);
  mapPlane.rotation.x = -Math.PI / 2;
  mapPlane.receiveShadow = true;

  K.plane(2.2, 1.35, new THREE.MeshLambertMaterial({ map: mapTex }), 0.4, 4.3, -7.35, group);
  K.box(2.4, 0.08, 0.08, 0x3a2f22, 0.4, 5.0, -7.35, group);
  K.box(2.4, 0.08, 0.08, 0x3a2f22, 0.4, 3.6, -7.35, group);

  const waugh = K.makeHuman(rig, OFFICIAL_A);
  waugh.root.position.set(-1.4, 0, -3.95);
  waugh.root.rotation.y = 0.42;
  group.add(waugh.root);

  const everest = K.makeHuman(rig, OFFICIAL_B);
  everest.root.position.set(2.5, 0, -3.95);
  everest.root.rotation.y = -0.42;
  group.add(everest.root);

  const WA = (T.s7 ?? 24) + 0.2, WB = (T.s7 ?? 24) + 2.0;
  const cut = (T.s7 ?? 24) + 2.6;
  const pick = K.shotPicker([
    { t0: T.s7 ?? 24, t1: cut, cam(u, t) {
        camera.position.set(K.lerp(1.5, 0.95, u), K.lerp(2.05, 1.9, u), K.lerp(6.4, 5.7, u));
        camera.lookAt(K.lerp(0.7, 0.6, u), K.lerp(1.55, 1.5, u), -3.3);
        shake(t);
      } },
    { t0: cut, t1: 999, cam(u, t) {
        camera.position.set(K.lerp(1.35, 0.85, u), K.lerp(1.62, 1.58, u), K.lerp(1.7, 1.25, u));
        camera.lookAt(K.lerp(0.7, 0.62, u), K.lerp(1.45, 1.42, u), -3.6);
        shake(t, 0.0035);
      } }
  ]);

  return {
    camera(u, t) { pick(t); },
    update(t) {
      const walking = t > WA && t < WB;
      waugh.root.position.x = K.lerp(-1.4, -0.25, K.smooth(K.seg(t, WA, WB)));
      everest.root.position.x = K.lerp(2.5, 1.45, K.smooth(K.seg(t, WA, WB)));
      if (walking) {
        K.walkCycle(waugh, t, { speed: 1.0, amp: 0.45 });
        K.walkCycle(everest, t + 0.5, { speed: 1.0, amp: 0.45 });
        K.headLook(waugh, 0.2, 0); K.headLook(everest, -0.2, 0);
      } else {
        const waughTalking = K.speaking(LINES, 'l7', t);
        K.poseHuman(waugh, waughTalking ? K.POSE.present : K.POSE.talk, 1);
        K.poseHuman(everest, K.POSE.listen, 1);
        legs(waugh); legs(everest);
        K.headLook(waugh, -0.08, 0.04);
        K.headLook(everest, 0.12, 0.04);
        K.speak(waugh, K.mouthAt(envelope, t) * (waughTalking ? 1 : 0));
        K.speak(everest, 0);
      }
      L.practical.intensity = 12 * (1 + 0.04 * Math.sin(t * 6.1));
    }
  };
}

// =====================================================================
//  5 · finale — the mountain with its own names
// =====================================================================
function finale(group) {
  K.threePoint(group, {
    keyColor: 0xffb877, keyIntensity: 2.6, keyPos: [-7, 4, 6],
    fillColor: 0x5f7fae, fillIntensity: 1.3, fillPos: [5, 3, 4],
    ambientColor: 0x4f6076, ambient: 1.4, shadows: false
  });

  K.plane(400, 260, new THREE.MeshBasicMaterial({ map: K.gradientTex(DUSK) }), 0, 14, -110, group);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), K.flat(0xf6c078));
  sun.position.set(-12, 8.6, -100); group.add(sun);
  K.plane(14, 14, new THREE.MeshBasicMaterial({ map: K.softDot('#f0b96b', 0.35), transparent: true, depthWrite: false }), -12, 8.6, -99.4, group);

  for (const [seed, base, amp, z, col] of [[11, 3, 7.5, -74, 0x2b3f57], [23, 1.5, 6.0, -58, 0x21324a]]) {
    const m = K.strip(K.ridgePts(seed, -90, 90, base, amp, 26), col);
    m.position.z = z; group.add(m);
  }
  const peak = K.peakGroup(PEAK, { scale: 1.0, z: -22 });
  peak.position.x = 1.5; group.add(peak);
  const near = K.strip(K.ridgePts(51, -90, 90, -3.0, 4.2, 18), 0x0d1725);
  near.position.z = -8; group.add(near);
  const clouds = K.motes(group, { count: 30, centre: [0, 7, -40], spread: [46, 6, 12], size: 0.6, opacity: 0.05, colour: 0xc8d8ea, seed: 33 });

  const pick = K.shotPicker([
    { t0: T.s8 ?? 29, t1: 999, cam(u, t) {
        camera.position.set(K.lerp(-0.6, 1.1, u), K.lerp(2.7, 3.4, u), K.lerp(17.5, 13.5, u));
        camera.lookAt(K.lerp(1.4, 2.1, u), K.lerp(5.4, 6.1, u), -22);
        shake(t, 0.004);
      } }
  ]);

  return {
    camera(u, t) { pick(t); },
    update(t) { clouds.update(t); }
  };
}

// =====================================================================
//  cut list
// =====================================================================
const stages = K.createStages(scene, [
  { key: 'office', t0: -1, t1: T.s3 ?? 7, build: office },
  { key: 'plain', t0: T.s3 ?? 7, t1: T.s6 ?? 20, build: plain },
  { key: 'summit', t0: T.s6 ?? 20, t1: T.s7 ?? 24, build: summit },
  { key: 'mapRoom', t0: T.s7 ?? 24, t1: T.s8 ?? 29, build: mapRoom },
  { key: 'final', t0: T.s8 ?? 29, t1: DUR + 1, build: finale }
]);

const hud = K.makeHud({
  film: FILM,
  lines: LINES,
  safe: K.SAFE,
  debugSafe: Q.get('safe') === '1',
  times: {
    stepsIn: (T.s4 ?? 11) + 0.1,
    stepsOut: T.s6 ?? 20,
    stepBeats: [T.s4 ?? 11, T.s5 ?? 14, (T.s5 ?? 14) + 1.4],
    proofIn: T.s6 ?? 20,
    proofOut: T.s7 ?? 24
  }
});

K.run(app, {
  fps: FPS,
  dur: DUR,
  hud,
  update(t) { stages.update(t); }
});
