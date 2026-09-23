// Interactive 3D model of Nawaf Villa — the final design from the renders in /final (night scene, Dubai skyline behind).
// Source for assets/js/model3d.js — after editing, rebuild it from src/: `npm install` (once), then `npm run model`.
//
// Footprint traced from NWGF-Model.pdf in *plan pixels* (the PDF rendered ~1300px wide); P() converts them to metres.
// Plot ≈ 28.2 m × 37 m → ~18.3 px per metre. The road is to the south (+z), the lane to the north (−z).
// The façade, slabs, fins and courtyard follow the final renders. Textures are CC0 (Poly Haven); the skyline is cropped from the project's own render.
//
// Performance: static geometry is merged per material (a few dozen draw calls), shadows are rendered once,
// frames are only drawn while something moves, and resolution adapts to the device.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, BloomEffect } from "postprocessing";

const { Vector2, Vector3, Group, Mesh, BoxGeometry, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial } = THREE;

const PX = 18.3; // plan pixels per metre
const CX = 661, CZ = 421; // plan centre
const P = (x, z) => new Vector2((x - CX) / PX, (z - CZ) / PX);

const FLOOR = 0.45; // ground-floor level
const FF = 4.65; // first-floor level (slab top)
const ROOF = 8.3; // underside of the roof slab
const EXT = 0.3;

const root = document.querySelector("[data-model3d]");
const BASE = root?.dataset.assets || "assets/model/";
const small = window.matchMedia("(max-width: 760px)").matches;

// ───────── textures & materials ─────────
THREE.Cache.enabled = true;
const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const tex = (id, map, size, srgb) => {
  const t = texLoader.load(`${BASE}tex/${id}_${map}.webp`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / size, 1 / size);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
/** PBR material from a Poly Haven texture set; UVs across the model are in metres, `size` = metres per tile. */
function pbr(id, { size = 2, arm = false, color = "#ffffff", roughness = 1, normal = 1, ...rest } = {}) {
  const m = new MeshStandardMaterial({ color, roughness, metalness: 0, map: tex(id, "diff", size, true), normalMap: tex(id, "nor", size), normalScale: new Vector2(normal, normal), ...rest });
  if (arm) { const a = tex(id, "arm", size); m.aoMap = a; m.roughnessMap = a; }
  return m;
}
function canvasTex(w, h, paint, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
const rnd = Math.random;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const GREENS = ["#3f5a2a", "#4d6a31", "#5b7a39", "#6a8a42", "#35502a", "#789a4b", "#48652f"];
const leafTexture = (flowers) => canvasTex(512, 512, (g, w, h) => {
  for (let i = 0; i < 2600; i++) {
    g.save();
    g.translate(rnd() * w, rnd() * h);
    g.rotate(rnd() * Math.PI * 2);
    g.fillStyle = flowers && rnd() < 0.12 ? pick(["#f4f1ea", "#e9d6de", "#f7efe3"]) : pick(GREENS);
    const l = 7 + rnd() * 9;
    g.beginPath(); g.ellipse(0, 0, l, l * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}, 2);
const frondTexture = () => canvasTex(256, 1024, (g, w, h) => {
  g.lineCap = "round";
  for (let y = h * 0.97; y > h * 0.02; y -= 7) {
    const t = 1 - y / h;
    const len = w * 0.48 * Math.sin(Math.PI * Math.min(1, 0.12 + t));
    for (const side of [-1, 1]) {
      g.strokeStyle = pick(GREENS);
      g.lineWidth = 3 + rnd() * 2;
      g.beginPath(); g.moveTo(w / 2, y);
      g.quadraticCurveTo(w / 2 + side * len * 0.5, y - 10, w / 2 + side * len, y - 26 - rnd() * 14);
      g.stroke();
    }
  }
  g.strokeStyle = "#7b6a45"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h * 0.02); g.stroke();
});
// raked zen gravel: fine grain plus flowing furrows
const gravelTexture = () => canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = "#e7dfd0"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) { g.fillStyle = pick(["#d8cfbf", "#f1ebe0", "#cfc5b4", "#ede6da"]); g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6); }
  g.strokeStyle = "rgba(120, 104, 84, .22)"; g.lineWidth = 2;
  for (let k = 0; k < 40; k++) {
    g.beginPath();
    for (let x = 0; x <= w; x += 8) { const y = k * (h / 40) + Math.sin((x / w) * Math.PI * 4) * 18; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
}, 1 / 7);
const glowTexture = () => canvasTex(128, 256, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h, 0, w / 2, h, h);
  gr.addColorStop(0, "rgba(255, 196, 128, .9)"); gr.addColorStop(0.35, "rgba(255, 180, 110, .35)"); gr.addColorStop(1, "rgba(255, 170, 100, 0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
// warm interior seen through glazing: ceiling glow, downlights, soft floor light, a few silhouettes
const interiorTexture = (bright) => {
  const t = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, bright ? "#f3c48a" : "#a8764a"); gr.addColorStop(0.18, bright ? "#b8834f" : "#6d4a2e");
    gr.addColorStop(0.7, bright ? "#5e3f27" : "#35251a"); gr.addColorStop(1, bright ? "#8a6240" : "#4a3322");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 40; x < w; x += 120) {
      const d = g.createRadialGradient(x, 18, 0, x, 18, 150);
      d.addColorStop(0, "rgba(255, 225, 170, .9)"); d.addColorStop(1, "rgba(255, 210, 150, 0)");
      g.fillStyle = d; g.fillRect(x - 150, 0, 300, 260);
    }
    g.fillStyle = "rgba(30, 20, 14, .55)";
    for (let i = 0; i < 4; i++) { const x = rnd() * w, bw = 40 + rnd() * 90, bh = 40 + rnd() * 110; g.fillRect(x, h - 70 - bh, bw, bh); }
    g.fillStyle = "rgba(255, 230, 190, .25)"; g.fillRect(0, h - 60, w, 60);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 4.5, 1 / 3.7);
  return t;
};
const plaqueTexture = () => canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = "#e3c79c"; g.font = "600 64px Georgia, 'Times New Roman', serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("PLOT F.30", w / 2, h / 2 + 4);
});

const plain = (color, roughness = 0.9, extra = {}) => new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
const foliage = (map, color = "#ffffff") => new MeshStandardMaterial({ color, map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
const glow = (color, k = 1) => new MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });

const M = {
  stucco: pbr("white_stucco", { size: 3, arm: true, color: "#efe5d5", normal: 0.5 }),
  boundary: pbr("white_stucco", { size: 3, arm: true, color: "#ece2d2", normal: 0.7 }),
  timber: pbr("wood_floor_deck", { size: 1.6, color: "#6b4a34", roughness: 0.6 }),
  deck: pbr("wood_floor_deck", { size: 2.2, arm: true, color: "#c49a72" }),
  pavers: pbr("concrete_pavers", { size: 1.6, arm: true, color: "#cfc6b8" }),
  grass: pbr("leafy_grass", { size: 2.5, arm: true, color: "#a9bf8e" }),
  asphalt: pbr("asphalt_02", { size: 5, color: "#6d6a6a", roughness: 0.42 }),
  sand: pbr("sand_01", { size: 9, color: "#bfb29d", normal: 0.6 }),
  gravel: new MeshStandardMaterial({ map: gravelTexture(), roughness: 0.95 }),
  stream: new MeshStandardMaterial({ color: "#07090c", roughness: 0.06, metalness: 0.3, envMapIntensity: 1.4 }),
  lit: new MeshStandardMaterial({ color: "#1c1a18", emissive: "#ffffff", emissiveMap: interiorTexture(true), emissiveIntensity: 0.95, roughness: 0.08, metalness: 0.4 }),
  litDim: new MeshStandardMaterial({ color: "#161618", emissive: "#ffffff", emissiveMap: interiorTexture(false), emissiveIntensity: 0.7, roughness: 0.08, metalness: 0.4 }),
  darkGlass: new MeshStandardMaterial({ color: "#14181d", roughness: 0.06, metalness: 0.6, envMapIntensity: 1.2 }),
  rail: new MeshPhysicalMaterial({ color: "#c9d6dc", roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
  frame: new MeshStandardMaterial({ color: "#2a2b2d", metalness: 0.7, roughness: 0.35 }),
  led: glow("#ffd9a6", 3),
  ledCool: glow("#fff1dd", 2),
  line: plain("#f4f1ea", 0.7),
  bark: plain("#6f5a48", 1),
  palmBark: plain("#8a735a", 1),
  leaf: foliage(leafTexture(false)),
  flowers: foliage(leafTexture(true)),
  palmLeaf: foliage(frondTexture(), "#b9c1a2"),
  rock: plain("#b9b2a6", 0.95),
  fabric: plain("#e9e3d8", 1),
  wood: plain("#7a563b", 0.55),
  metal: new MeshStandardMaterial({ color: "#222", metalness: 0.7, roughness: 0.4 }),
  tyre: plain("#141414", 0.8),
  rim: new MeshStandardMaterial({ color: "#bdbdbd", metalness: 1, roughness: 0.25 }),
  chrome: new MeshStandardMaterial({ color: "#d7d7d7", metalness: 1, roughness: 0.12 }),
  carGlass: new MeshPhysicalMaterial({ color: "#0b0f12", metalness: 0.3, roughness: 0.05, clearcoat: 1 }),
  tail: glow("#ff3b2f", 2),
  neighbour: pbr("white_stucco", { size: 3, color: "#8f877c", normal: 0.4 }),
  wash: new MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  plaque: new MeshBasicMaterial({ map: plaqueTexture(), color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, toneMapped: false }),
};
const PAINT = { black: new MeshPhysicalMaterial({ color: "#1b1c1e", metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04 }),
  silver: new MeshPhysicalMaterial({ color: "#b9bcbf", metalness: 0.8, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 }),
  white: new MeshPhysicalMaterial({ color: "#eeeeec", metalness: 0.4, roughness: 0.3, clearcoat: 1 }) };

// ───────── geometry helpers ─────────
const scene = new THREE.Scene();
const model = new Group();
scene.add(model);

function add(geo, material, { cast = true, receive = true, parent = model } = {}) {
  const m = new Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}
const pts = (list) => list.map((p) => (p.isVector2 ? p : P(p[0], p[1])));
function slab(points, top, depth, material, opts) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts(points)), { depth, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, top, 0);
  return add(geo, material, opts);
}
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const circle = (cx, cz, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cz + r * Math.sin((i / n) * Math.PI * 2)]);
/** Smooth closed or open outline through plan control points. */
function smooth(ctrl, n = 160, closed = true) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new Vector3(x, 0, z)), closed, "centripetal");
  return c.getSpacedPoints(n).slice(0, closed ? n : n + 1).map((v) => [v.x, v.z]);
}
/** Offset a smooth plan outline (px) outward by d metres. */
function offsetPoly(list, d) {
  const n = list.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const [x1, z1] = list[i], [x2, z2] = list[(i + 1) % n]; area += x1 * z2 - x2 * z1; }
  const s = Math.sign(area) * d * PX;
  return list.map(([x, z], i) => {
    const [ax, az] = list[(i - 1 + n) % n], [bx, bz] = list[(i + 1) % n];
    const tx = bx - ax, tz = bz - az, l = Math.hypot(tx, tz) || 1;
    return [x + (tz / l) * s, z - (tx / l) * s];
  });
}
function metricBox(w, h, d) {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  return g;
}
function along(a, b, { h, t, base, material, extend = t, cast = true }) {
  const len = a.distanceTo(b);
  const m = add(metricBox(len + extend, h, t), material, { cast });
  m.position.set((a.x + b.x) / 2, base + h / 2, (a.y + b.y) / 2);
  m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  return m;
}
function wall(points, { h, t = EXT, base = FLOOR, material = M.stucco, closed = false, cast = true } = {}) {
  const p = pts(points);
  if (closed) p.push(p[0]);
  for (let i = 0; i < p.length - 1; i++) if (p[i].distanceTo(p[i + 1]) > 0.01) along(p[i], p[i + 1], { h, t, base, material, cast });
}
/** Glowing glazing with slim mullions. */
function glazing(points, y0, y1, material = M.lit, bay = 1.6) {
  const p = pts(points);
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    along(a, b, { h: y1 - y0, t: 0.06, base: y0, material, extend: 0, cast: false });
    const len = a.distanceTo(b), n = Math.max(1, Math.round(len / bay));
    const dir = b.clone().sub(a).normalize().multiplyScalar(0.03);
    for (let k = 0; k <= n; k++) { const c = a.clone().lerp(b, k / n); along(c.clone().sub(dir), c.clone().add(dir), { h: y1 - y0, t: 0.12, base: y0, material: M.frame, extend: 0, cast: false }); }
  }
}
/** LED strip following a plan line at height y. */
function strip(list, y, { closed = true, r = 0.035, material = M.led } = {}) {
  const c = new THREE.CatmullRomCurve3(pts(list).map((v) => new Vector3(v.x, y, v.y)), closed);
  add(new THREE.TubeGeometry(c, Math.max(24, list.length * 2), r, 5, closed), material, { cast: false, receive: false });
}
/** Uplight wash on a wall facing +z (or rotated). */
function wash(x, z, y, w, h, rot = 0) {
  const p = P(x, z);
  const m = add(new THREE.PlaneGeometry(w, h), M.wash, { cast: false, receive: false });
  m.position.set(p.x + Math.sin(rot) * 0.2, y + h / 2, p.y + Math.cos(rot) * 0.2);
  m.rotation.y = rot;
  m.renderOrder = 2;
}

// landscape pieces
function bumpy(radius, detail, amount) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position, v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (Math.sin(v.x * 3.1) * Math.cos(v.z * 2.7) + Math.sin(v.y * 4.3)) * amount * 0.5 + (rnd() - 0.5) * amount;
    p.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
function tree(x, z, s = 1, base = 0.2, material = M.leaf) {
  const p = P(x, z), g = new Group();
  const trunk = add(new THREE.CylinderGeometry(0.1 * s, 0.18 * s, 2.2 * s, 8), M.bark, { parent: g });
  trunk.position.y = 1.1 * s;
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, r = (i === 0 ? 0 : 0.8) * s, rr = (0.95 + rnd() * 0.5) * s, y = (2.6 + rnd() * 0.8) * s;
    for (const k of [1, 0.72]) {
      const c = add(bumpy(rr * k, 2, 0.3), material, { parent: g });
      c.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      c.rotation.set(rnd() * 3, rnd() * 3, 0);
    }
  }
  g.position.set(p.x, base, p.y);
  g.rotation.y = rnd() * 6;
  model.add(g);
}
function bonsai(x, z, base) {
  const p = P(x, z), g = new Group();
  const trunk = add(new THREE.CylinderGeometry(0.12, 0.25, 1.4, 8), M.bark, { parent: g });
  trunk.position.y = 0.7; trunk.rotation.z = 0.25;
  for (const [dx, dy, dz, r] of [[0, 1.7, 0, 0.9], [0.8, 1.35, 0.3, 0.6], [-0.7, 1.45, -0.2, 0.65], [0.2, 2.2, 0.1, 0.55]]) {
    const c = add(bumpy(r, 2, 0.25), M.leaf, { parent: g });
    c.position.set(dx, dy, dz); c.scale.y = 0.55;
  }
  g.position.set(p.x, base, p.y);
  model.add(g);
}
const frondGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 3, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5, x = p.getX(i) * 1.5;
    p.setXYZ(i, x, Math.abs(x) * 0.45 - t * t * 1.6 + t * 0.4, t * 3.6);
  }
  g.computeVertexNormals();
  return g;
})();
function palm(x, z, h = 6, base = 0.2, s = 1) {
  const p = P(x, z), g = new Group();
  const lean = (rnd() - 0.5) * 0.15;
  const trunk = add(new THREE.CylinderGeometry(0.2 * s, 0.28 * s, h, 8, 1), M.palmBark, { parent: g });
  trunk.position.y = h / 2; trunk.rotation.z = lean;
  const crown = new Group();
  crown.position.set(-Math.sin(lean) * h * 0.5, h, 0);
  for (let i = 0; i < 16; i++) {
    const f = add(frondGeo, M.palmLeaf, { parent: crown });
    f.rotation.order = "YXZ";
    f.rotation.y = (i / 16) * Math.PI * 2 + rnd() * 0.3;
    f.rotation.x = -0.75 + (i % 3) * 0.3 + rnd() * 0.2;
    f.scale.setScalar((0.8 + rnd() * 0.35) * s);
  }
  g.add(crown);
  g.position.set(p.x, base, p.y);
  model.add(g);
}
function shrubs(list, base, material = M.leaf, size = 0.55) {
  for (const [x, z] of list) {
    const p = P(x, z), r = size * (0.8 + rnd() * 0.5);
    const s = add(bumpy(r, 2, 0.3), material);
    s.position.set(p.x, base + r * 0.5, p.y);
    s.rotation.set(rnd() * 3, rnd() * 3, 0);
  }
}
function agave(x, z, base = 0.2, s = 1) {
  const p = P(x, z);
  for (let i = 0; i < 11; i++) {
    const leaf = add(new THREE.ConeGeometry(0.09 * s, 1.1 * s, 4), M.palmLeaf, { cast: false });
    const a = (i / 11) * Math.PI * 2;
    leaf.position.set(p.x + Math.cos(a) * 0.25 * s, base + 0.45 * s, p.y + Math.sin(a) * 0.25 * s);
    leaf.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  }
}
function car(x, z, rot, paint, type) {
  const p = P(x, z), g = new Group();
  const suv = type === "suv";
  const L = suv ? 5.35 : 4.85, W = suv ? 2.05 : 1.95, H = suv ? 1.05 : 0.78;
  const body = add(new RoundedBoxGeometry(L, H, W, 4, 0.28), paint, { parent: g }); body.position.y = 0.4 + H / 2;
  const cab = add(new RoundedBoxGeometry(suv ? 3.1 : 2.2, suv ? 0.72 : 0.55, W - 0.2, 4, 0.22), M.carGlass, { parent: g });
  cab.position.set(suv ? -0.35 : -0.55, 0.4 + H + (suv ? 0.34 : 0.25), 0);
  const top = add(new RoundedBoxGeometry(suv ? 2.9 : 1.8, 0.07, W - 0.3, 2, 0.03), paint, { parent: g });
  top.position.set(suv ? -0.4 : -0.6, 0.4 + H + (suv ? 0.72 : 0.53), 0);
  if (suv) { const gr = add(new BoxGeometry(0.06, 0.55, 0.7), M.chrome, { parent: g }); gr.position.set(L / 2 + 0.01, 0.95, 0); }
  for (const zz of [-1, 1]) {
    const hl = add(new BoxGeometry(0.05, 0.06, 0.5), M.ledCool, { parent: g, cast: false }); hl.position.set(L / 2 + 0.01, suv ? 1.2 : 0.95, zz * (W / 2 - 0.35));
    const tl = add(new BoxGeometry(0.05, 0.08, 0.45), M.tail, { parent: g, cast: false }); tl.position.set(-L / 2 - 0.01, suv ? 1.15 : 0.95, zz * (W / 2 - 0.3));
  }
  const wheel = new THREE.CylinderGeometry(suv ? 0.44 : 0.37, suv ? 0.44 : 0.37, 0.28, 20);
  const rimG = new THREE.CylinderGeometry(suv ? 0.3 : 0.25, suv ? 0.3 : 0.25, 0.3, 16);
  for (const [wx, wz] of [[L / 2 - 0.95, W / 2 - 0.12], [L / 2 - 0.95, -W / 2 + 0.12], [-L / 2 + 1.0, W / 2 - 0.12], [-L / 2 + 1.0, -W / 2 + 0.12]]) {
    const w = add(wheel, M.tyre, { parent: g }); w.rotation.x = Math.PI / 2; w.position.set(wx, suv ? 0.44 : 0.37, wz);
    const r = add(rimG, M.rim, { parent: g }); r.rotation.x = Math.PI / 2; r.position.set(wx, suv ? 0.44 : 0.37, wz);
  }
  g.position.set(p.x, 0.12, p.y);
  g.rotation.y = rot;
  model.add(g);
}
function box(x, z, w, d, h, y, material, rot = 0) {
  const p = P(x, z);
  const m = add(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.05, h / 3)), material);
  m.position.set(p.x, y + h / 2, p.y); m.rotation.y = rot;
  return m;
}

// ───────── sky & skyline ─────────
{
  const g = new THREE.SphereGeometry(1400, 32, 16);
  const col = [], c = new THREE.Color(), top = new THREE.Color("#141838"), hor = new THREE.Color("#3a3963"), low = new THREE.Color("#1b1b2a");
  for (let i = 0; i < g.attributes.position.count; i++) {
    const y = g.attributes.position.getY(i) / 1400;
    if (y > 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(low, Math.min(1, -y * 4));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const sky = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -2;
  scene.add(sky);
}
const skylineTex = texLoader.load(`${BASE}skyline.webp`, (t) => { t.colorSpace = THREE.SRGBColorSpace; });
{
  const R = 520, arc = 1.25, Hh = R * arc * (915 / 1231);
  skylineTex.wrapS = THREE.RepeatWrapping; skylineTex.repeat.x = -1; skylineTex.offset.x = 1; // seen from inside
  const g = new THREE.CylinderGeometry(R, R, Hh, 48, 1, true, Math.PI - arc / 2, arc);
  const m = new Mesh(g, new MeshBasicMaterial({ map: skylineTex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.position.set(0, Hh / 2 - 26, 0);
  m.renderOrder = -1;
  scene.add(m);
}

// ───────── site & streets ─────────
{
  const g = new THREE.PlaneGeometry(3000, 3000);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3000, uv.getY(i) * 3000);
  g.rotateX(-Math.PI / 2);
  add(g, M.sand, { cast: false });
}
const FAR = 9000;
slab(rect(-FAR, 800, FAR, 1070), 0.04, 0.1, M.asphalt, { cast: false });
slab(rect(-FAR, 765, FAR, 800), 0.16, 0.2, M.pavers, { cast: false });
slab(rect(-FAR, 1070, FAR, 1100), 0.16, 0.2, M.pavers, { cast: false });
slab(rect(-FAR, 1100, FAR, 1400), 0.12, 0.1, M.grass, { cast: false });
slab(rect(-FAR, -30, FAR, 76), 0.04, 0.1, M.asphalt, { cast: false });
for (let x = -2000; x < 3000; x += 110) slab(rect(x, 933, x + 55, 937), 0.05, 0.01, M.line, { cast: false });
// foreground verge planting (the street-level view looks across it)
for (let i = 0; i < 26; i++) agave(300 + rnd() * 760, 1130 + rnd() * 160, 0.12, 0.8 + rnd() * 0.6);
shrubs(Array.from({ length: 30 }, () => [250 + rnd() * 860, 1120 + rnd() * 200]), 0.12, M.leaf, 0.35);

// neighbouring villas: two storeys, warm windows
function neighbour(x0, z0, x1, z1, flip) {
  const [a, b] = [P(x0, z0), P(x1, z1)];
  const w = b.x - a.x, d = b.y - a.y;
  const lower = add(metricBox(w, 4.3, d), M.neighbour); lower.position.set((a.x + b.x) / 2, 2.15, (a.y + b.y) / 2);
  const upper = add(metricBox(w * 0.8, 3.8, d * 0.85), M.neighbour); upper.position.set(a.x + w * (flip ? 0.6 : 0.4), 6.2, (a.y + b.y) / 2);
  for (const [y, hh, k] of [[1.1, 2.4, 0.6], [5.0, 2.1, 0.5]]) {
    const g = add(new BoxGeometry(w * k, hh, 0.06), Math.random() < 0.5 ? M.lit : M.litDim, { cast: false });
    g.position.set(a.x + w * 0.5, y + hh / 2, b.y + 0.04);
  }
}
neighbour(60, 220, 360, 690, false);
neighbour(960, 200, 1290, 670, true);
neighbour(440, -560, 880, -150, false);
neighbour(-60, -560, 350, -150, true);
neighbour(1000, -560, 1400, -150, false);
for (const x of [-160, 250, 1080, 1400]) palm(x, 782, 7.5, 0.2);

// ───────── the plot ─────────
const plot = [[405, 80], [918, 82], [905, 762], [752, 757], [600, 752], [548, 742], [430, 762]];
slab(plot, 0.12, 0.12, M.pavers, { cast: false });
wall([[810, 81], [405, 80], [430, 740]], { h: 2.2, t: 0.24, base: 0, material: M.boundary });
wall([[905, 82], [918, 82], [905, 740]], { h: 2.2, t: 0.24, base: 0, material: M.boundary });

// front garden walls: low, curved, with an LED line and the plot name
const frontL = smooth([[430, 742], [470, 736], [520, 728], [556, 724]], 30, false);
const frontR = smooth([[756, 728], [800, 718], [850, 712], [900, 718], [908, 740]], 30, false);
for (const f of [frontL, frontR]) {
  wall(f, { h: 1.9, t: 0.35, base: 0, material: M.boundary });
  strip(f.map(([x, z]) => [x, z + 4]), 1.55, { closed: false, r: 0.025 });
}
{
  const pl = add(new THREE.PlaneGeometry(3.2, 0.8), M.plaque, { cast: false, receive: false });
  const p = P(485, 738); pl.position.set(p.x, 0.95, p.y + 0.2);
}
for (const x of [455, 490, 525]) { agave(x, 752, 0.12, 0.9); wash(x, 738, 0.1, 1.6, 1.9); }
for (const x of [790, 830, 870]) wash(x, 722, 0.1, 1.4, 1.9);
shrubs([[770, 712], [790, 709], [812, 706], [835, 704], [858, 705], [880, 710]], 1.9, M.flowers, 0.45);

// driveway & cars in front of the garage, one more inside
slab(rect(600, 655, 752, 762), 0.14, 0.05, M.pavers, { cast: false });
car(650, 720, -Math.PI / 2 - 0.05, PAINT.black, "suv");
car(716, 728, -Math.PI / 2 + 0.06, PAINT.silver, "coupe");
car(636, 600, -Math.PI / 2, PAINT.white, "suv");

// ───────── building ─────────
const westWing = [[476, 178], [600, 178], [600, 522], [752, 522], [752, 655], [600, 655], [600, 720], [548, 720], [548, 700], [482, 700],
  ...Array.from({ length: 7 }, (_, i) => { const a = Math.PI / 2 + (i / 6) * (Math.PI / 2); return [482 + 20 * Math.cos(a), 680 + 20 * Math.sin(a)]; }),
  [462, 192], [466, 182]];
const eastWing = smooth([[758, 382], [864, 382], [868, 690], [760, 696]], 80);
slab(westWing, FLOOR, FLOOR, M.stucco);
slab(eastWing, FLOOR, FLOOR, M.stucco);

// ground floor
wall([[600, 178], [476, 178], [466, 182], [462, 192], [462, 680]], { h: FF - FLOOR - 0.45 });
wall([[600, 178], [600, 300]], { h: FF - FLOOR - 0.45 });
glazing([[600, 300], [600, 515]], FLOOR, FF - 0.45);
glazing([[610, 522], [745, 522]], FLOOR, FF - 0.45, M.litDim);
glazing([[505, 704], [548, 704]], FLOOR, FF - 0.45);
wall([[548, 704], [560, 722], [600, 722], [600, 655]], { h: FF - FLOOR - 0.45 });
wall([[600, 655], [600, 545]], { h: FF - FLOOR - 0.45, t: 0.2, material: M.timber }); // garage side & back walls in timber
wall([[600, 545], [752, 545], [752, 655]], { h: FF - FLOOR - 0.45, t: 0.2, material: M.timber });
slab(rect(600, 545, 752, 700), FF - 0.45, 0.08, M.timber); // slatted timber soffit over the car porch
wall(eastWing.slice(0, 40), { h: FF - FLOOR - 0.45 });
glazing(eastWing.slice(58, 74), FLOOR, FF - 0.45, M.litDim);
wall(eastWing.slice(40, 58), { h: FF - FLOOR - 0.45 });
{ // entrance door: tall timber panel
  const d = add(metricBox(1.4, 3.6, 0.1), M.timber); const p = P(578, 724); d.position.set(p.x, FLOOR + 1.8, p.y);
}
// the drum: a two-storey cylinder at the west corner
{
  const p = P(488, 704);
  const d = add(new THREE.CylinderGeometry(1.7, 1.7, ROOF, 40), M.stucco); d.position.set(p.x, ROOF / 2, p.y);
  wash(488, 740, FLOOR, 2.4, 4.2);
}

// first-floor slab: flowing outline around the courtyard with a deep cantilever at the front
const ffCtrl = [[450, 186], [520, 176], [610, 182], [618, 250], [616, 420], [620, 512], [660, 530], [740, 526], [746, 450], [748, 376], [800, 368], [870, 370], [884, 420],
  [886, 560], [884, 660], [880, 708], [830, 722], [760, 716], [690, 708], [620, 712], [560, 722], [500, 728], [452, 716], [446, 600], [446, 300]];
const ffOutline = smooth(ffCtrl, 220);
slab(ffOutline, FF, 0.45, M.stucco);
strip(offsetPoly(ffOutline, 0.02), FF - 0.44);

// first floor walls
const F1 = FF, F2 = ROOF;
wall([[470, 190], [600, 190]], { base: F1, h: F2 - F1 });
wall([[458, 200], [458, 600]], { base: F1, h: F2 - F1 });
glazing([[606, 196], [606, 510]], F1, F2);
along(P(606, 196), P(606, 510), { h: 0.7, t: 0.2, base: F2 - 0.7, material: M.timber });
glazing([[616, 516], [740, 516]], F1, F2, M.litDim);
along(P(616, 516), P(740, 516), { h: 0.7, t: 0.2, base: F2 - 0.7, material: M.timber });
glazing([[750, 380], [750, 505]], F1, F2, M.litDim);
glazing([[760, 376], [870, 376]], F1, F2, M.litDim);
wall([[876, 380], [876, 640]], { base: F1, h: F2 - F1 });
glazing([[505, 708], [560, 712]], F1, F2);
glazing([[560, 700], [740, 700]], F1, F2);
glazing([[745, 640], [870, 640]], F1, F2); // terrace doors, set back behind the balcony
along(P(750, 712), P(878, 700), { h: 1.1, t: 0.05, base: F1, material: M.rail, extend: 0, cast: false }); // glass balustrade
for (let x = 566; x <= 736; x += 12.5) { // timber fins
  const f = add(metricBox(0.22, F2 - F1, 0.55), M.timber); const p = P(x, 710); f.position.set(p.x, F1 + (F2 - F1) / 2, p.y);
}

// roof slab: thicker, sweeping up over the drum and flaring out over the terrace
const roofCtrl = ffCtrl.map(([x, z]) => [x, z]);
roofCtrl.splice(13, 4, [888, 430], [892, 560], [904, 680], [900, 718], [846, 732]);
const roofOutline = smooth(roofCtrl, 240);
{
  const shape = new THREE.Shape(pts(roofOutline));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, ROOF + 0.55, 0);
  const pos = geo.attributes.position;
  const lift = (x) => { const px = x * PX + CX; return 0.9 * Math.exp(-Math.pow((px - 480) / 70, 2)) + 0.25 * Math.exp(-Math.pow((px - 880) / 60, 2)); };
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > ROOF + 0.3) pos.setY(i, pos.getY(i) + lift(pos.getX(i)));
  geo.computeVertexNormals();
  add(geo, M.stucco);
  strip(offsetPoly(roofOutline, 0.02), ROOF - 0.01);
}
// starlit soffit under the cantilever (points, drawn after the merge)
const stars = (() => {
  const v = [];
  for (let i = 0; i < 700; i++) {
    const x = 560 + rnd() * 340, z = x > 740 ? 640 + rnd() * 85 : 700 + rnd() * 24;
    const p = P(x, z); v.push(p.x, ROOF - 0.03, p.y);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color("#ffd49a").multiplyScalar(3), size: 0.07, toneMapped: false, transparent: true, depthWrite: false }));
})();

// rooftop garden over the west wing: curved glass-railed terrace, palms and planting
const roofTop = ROOF + 0.55;
const deckLoop = smooth([[470, 470], [520, 452], [590, 470], [596, 600], [560, 700], [480, 708], [462, 620]], 90);
wall(deckLoop, { base: roofTop, h: 1.0, t: 0.3 });
strip(offsetPoly(deckLoop, 0.17), roofTop + 1.0);
slab(smooth([[480, 480], [580, 480], [585, 590], [480, 600]], 40), roofTop + 0.2, 0.2, M.grass, { cast: false });
palm(500, 520, 3.8, roofTop, 0.8); palm(560, 560, 3.2, roofTop, 0.7); palm(520, 660, 3.6, roofTop, 0.75);
shrubs([[480, 690], [500, 700], [470, 640], [586, 610], [575, 650], [540, 690]], roofTop, M.leaf, 0.55);
glazing([[760, 440], [860, 440]], roofTop, roofTop + 1.1, M.rail); // rail on the east roof

// ───────── courtyard: zen garden ─────────
slab(rect(600, 178, 868, 522), 0.2, 0.12, M.gravel, { cast: false });
slab(rect(612, 182, 866, 262), 0.34, 0.14, M.deck); // dining & lounge deck
slab(circle(690, 300, 50), 0.36, 0.16, M.deck);
{ // round white planter with a bonsai
  const p = P(690, 300);
  const pl = add(new THREE.CylinderGeometry(1.6, 1.7, 0.8, 48), M.stucco); pl.position.set(p.x, 0.76, p.y);
  bonsai(690, 300, 1.16);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; const s = add(new RoundedBoxGeometry(0.5, 0.42, 0.5, 2, 0.08), M.fabric); s.position.set(p.x + Math.cos(a) * 2.2, 0.73, p.y + Math.sin(a) * 2.2); }
}
const riverPath = new THREE.CatmullRomCurve3(
  [[630, 505], [652, 470], [700, 455], [728, 420], [712, 380], [742, 352], [790, 362], [828, 332], [860, 300]].map(([x, z]) => new Vector3(x, 0, z))
);
const rp = riverPath.getSpacedPoints(140);
const offset = (d) => rp.map((p, i) => { const t = riverPath.getTangentAt(i / (rp.length - 1)); return [p.x - t.z * d, p.z + t.x * d]; });
slab([...offset(7), ...offset(-7).reverse()], 0.25, 0.06, M.stream, { cast: false });
strip(offset(10), 0.28, { closed: false, r: 0.02 });
slab(smooth([[780, 480], [860, 470], [866, 520], [770, 520]], 40), 0.24, 0.1, M.grass, { cast: false });
shrubs([[640, 440], [660, 460], [630, 470], [800, 300], [815, 330], [790, 350], [850, 250], [858, 280], [760, 350], [770, 330]], 0.26, M.flowers, 0.6);
for (const [x, z] of [[628, 430], [805, 320], [840, 400]]) { const r = add(bumpy(0.6, 1, 0.35), M.rock); const p = P(x, z); r.position.set(p.x, 0.4, p.y); r.scale.y = 0.6; }
tree(636, 452, 1.1, 0.26); tree(848, 480, 1.2, 0.26); tree(610, 200, 0.9, 0.3);
// dining, lounge, parasol
{
  const g = new Group(), p = P(820, 222);
  const top = add(new RoundedBoxGeometry(3.4, 0.06, 1.1, 2, 0.02), M.wood, { parent: g }); top.position.y = 0.76;
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const c = add(new RoundedBoxGeometry(0.5, 0.8, 0.5, 2, 0.06), M.fabric, { parent: g }); c.position.set(-1.35 + i * 0.68, 0.4, s * 0.85); }
  g.position.set(p.x, 0.48, p.y); g.rotation.y = Math.PI / 2; model.add(g);
}
box(735, 210, 2.4, 0.9, 0.42, 0.48, M.fabric); box(735, 238, 1.2, 0.7, 0.3, 0.48, M.wood); box(760, 210, 0.9, 0.9, 0.42, 0.48, M.fabric, 0.4);
{
  const p = P(752, 230);
  const pole = add(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8), M.metal); pole.position.set(p.x, 1.78, p.y);
  const can = add(new THREE.ConeGeometry(1.7, 0.6, 12, 1, true), M.fabric); can.position.set(p.x, 3.0, p.y);
}

// ───────── merge static geometry by material ─────────
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.renderOrder}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, order: o.renderOrder, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    g.applyMatrix4(o.matrixWorld);
    buckets.get(key).geos.push(g);
  });
  const out = new Group();
  for (const { material, cast, order, geos } of buckets.values()) {
    const m = new Mesh(mergeGeometries(geos), material);
    m.castShadow = cast; m.receiveShadow = true; m.renderOrder = order;
    m.matrixAutoUpdate = false;
    out.add(m);
  }
  return out;
}
const merged = mergeStatic(model);
scene.remove(model);
scene.add(merged, stars);

// ───────── viewer ─────────
const LABELS = [
  ["Starlit terrace", 830, 690, ROOF - 1.2, 0, 0.45],
  ["Timber fins", 650, 712, 6.6, 0, 0.45],
  ["Car porch", 676, 700, 2.6, 0, 0.45],
  ["Rooftop garden", 520, 560, roofTop + 3.6, 0.35, 1],
  ["Zen courtyard", 700, 400, 1.6, 0.6, 1],
];
const ease = (t) => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;

function mount() {
  const stage = root.querySelector("[data-model-stage]");
  const status = root.querySelector("[data-model-status]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: "high-performance" });
  } catch (e) {
    root.classList.add("is-unsupported");
    return;
  }
  let dpr = Math.min(window.devicePixelRatio, small ? 1 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // the scene is static: shadows are drawn once
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.prepend(renderer.domElement);

  // dusk lighting: cool moonlight + sky fill, warm light from the house
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader(manager).load(`${BASE}sky.hdr`, (hdr) => { scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); });
  scene.environmentIntensity = 0.22;
  scene.fog = new THREE.Fog("#2c2c48", 70, 560);
  scene.add(new THREE.HemisphereLight("#6f7cc0", "#2b2219", 1.1));
  const moon = new THREE.DirectionalLight("#b4c2ff", 1.1);
  moon.position.set(-30, 55, 45);
  moon.castShadow = true;
  moon.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 32, bottom: -32, near: 1, far: 140 });
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04; moon.shadow.radius = 4;
  scene.add(moon);
  for (const [x, z, y, i, d] of [[820, 680, ROOF - 0.6, 30, 18], [660, 690, FF - 0.8, 22, 14], [676, 600, FF - 1, 14, 12], [700, 330, 2.6, 12, 16], [800, 420, 2.4, 10, 14]]) {
    const l = new THREE.PointLight("#ffb56b", i, d, 2); const p = P(x, z); l.position.set(p.x, y, p.y); scene.add(l);
  }

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 3000);
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const effects = [new BloomEffect({ intensity: 1.1, luminanceThreshold: 0.75, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.7 }),
    new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new VignetteEffect({ offset: 0.38, darkness: 0.5 })];
  composer.addPass(new EffectPass(camera, ...effects));
  if (!small) composer.addPass(new EffectPass(camera, new SMAAEffect()));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 150;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = 1.62;
  controls.enableZoom = false;
  renderer.domElement.style.touchAction = "pan-y";
  controls.addEventListener("change", () => { controls.target.clamp(new Vector3(-20, 0, -24), new Vector3(20, 10, 24)); dirty = true; });

  // scroll story: street-level at dusk (like the hero render) → craning up over the courtyard
  const court = P(720, 330);
  const shot = (e) => {
    const t = new Vector3(lerp(0.6, court.x, e), lerp(6.2, 0.5, e), lerp(8, court.y, e));
    const narrow = Math.min(1.9, Math.max(1, 1.5 / (camera.aspect || 1)));
    const sph = new THREE.Spherical(lerp(58, 50, e) * narrow, lerp(1.6, 1.0, e) - 0.85 * Math.sin(Math.PI * e), lerp(0, 2.55, e));
    return { target: t, pos: t.clone().add(new Vector3().setFromSpherical(sph)) };
  };
  let userMoved = false, dirty = true;
  const goTo = (e, instant) => {
    const s = shot(e);
    if (instant) { camera.position.copy(s.pos); controls.target.copy(s.target); }
    return s;
  };

  // The page always scrolls: the wheel only zooms with Ctrl/⌘ held (trackpad pinch sends Ctrl too).
  // Runs in the capture phase, before OrbitControls' own wheel handler on the canvas; touch pinch keeps zooming.
  const hint = root.querySelector("[data-model-hint]");
  let hintShown = 0;
  stage.addEventListener("wheel", (e) => {
    controls.enableZoom = e.ctrlKey || e.metaKey;
    if (controls.enableZoom) userMoved = true;
    else if (hint && performance.now() - hintShown > 8000) {
      hintShown = performance.now();
      hint.classList.add("is-nudge");
      clearTimeout(hint._t); hint._t = setTimeout(() => hint.classList.remove("is-nudge"), 1600);
    }
  }, { capture: true, passive: true });
  stage.addEventListener("pointerdown", () => { controls.enableZoom = true; });
  controls.addEventListener("start", () => { userMoved = true; });
  const zoomBy = (k) => {
    userMoved = true;
    const d = camera.position.clone().sub(controls.target).multiplyScalar(k);
    const len = THREE.MathUtils.clamp(d.length(), controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(d.setLength(len));
    dirty = true;
  };
  root.querySelector("[data-model-zoom-in]")?.addEventListener("click", () => zoomBy(0.8));
  root.querySelector("[data-model-zoom-out]")?.addEventListener("click", () => zoomBy(1.25));

  const labelWrap = root.querySelector("[data-model-labels]");
  const labels = LABELS.map(([text, x, z, y, from, to]) => {
    const el = document.createElement("span");
    el.className = "model__label"; el.textContent = text;
    labelWrap?.appendChild(el);
    const p = P(x, z);
    return { el, pos: new Vector3(p.x, y, p.y), from, to };
  });
  let storyE = 0;
  const v = new Vector3();
  const placeLabels = () => {
    if (!labelWrap || labelWrap.hidden) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const l of labels) {
      v.copy(l.pos).project(camera);
      const inStory = userMoved || (storyE >= l.from && storyE <= l.to);
      const on = inStory && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      l.el.style.visibility = on ? "" : "hidden";
      l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    }
  };
  const labelBtn = root.querySelector("[data-model-labels-toggle]");
  labelBtn?.addEventListener("click", () => {
    labelWrap.hidden = !labelWrap.hidden;
    labelBtn.setAttribute("aria-pressed", String(!labelWrap.hidden));
    dirty = true;
  });
  root.querySelector("[data-model-reset]")?.addEventListener("click", () => { userMoved = false; dirty = true; });

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    dirty = true;
  };
  new ResizeObserver(resize).observe(stage);
  resize();
  goTo(root._scroll ?? 0, true);
  controls.update();

  // adaptive resolution: step down while frames are slow
  let slowFrames = 0;
  const clock = new THREE.Clock();
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!userMoved) {
      storyE = reduceMotion ? 0 : root._scroll ?? 0;
      const s = goTo(storyE);
      const k = Math.min(1, dt * 4);
      if (camera.position.distanceToSquared(s.pos) > 1e-4 || controls.target.distanceToSquared(s.target) > 1e-4) {
        camera.position.lerp(s.pos, k); controls.target.lerp(s.target, k); dirty = true;
      }
    }
    controls.update();
    if (!dirty) return;
    dirty = false;
    composer.render(dt);
    placeLabels();
    if (dt > 0.034) { if (++slowFrames > 20 && dpr > 0.7) { dpr = Math.max(0.7, dpr * 0.8); renderer.setPixelRatio(dpr); resize(); slowFrames = 0; } } else slowFrames = Math.max(0, slowFrames - 1);
  };

  let visible = false, ready = false;
  const run = () => { renderer.setAnimationLoop(visible && ready ? frame : null); if (visible) { clock.getDelta(); dirty = true; } };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; run(); }).observe(stage);
  manager.onProgress = (_, done, total) => { if (status) status.textContent = `Loading model ${Math.round((done / total) * 100)}%`; };
  manager.onLoad = () => {
    ready = true;
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
    run();
    root.classList.add("is-ready");
  };
  root._view = { camera, controls };
}

if (root) mount();
