// Interactive 3D model of Nawaf Villa (ground floor), built from NWGF-Model.pdf.
// Source for assets/js/model3d.js — after editing, rebuild it from src/: `npm install` (once), then `npm run model`.
//
// Everything below is traced from the plan drawing in *plan pixels* (the PDF rendered
// ~1300px wide); P() converts them to metres. Plot ≈ 28.2 m × 37 m → ~18.3 px per metre.
// Textures and the sky are CC0 assets from Poly Haven (assets/model/).
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, BloomEffect, BrightnessContrastEffect, HueSaturationEffect } from "postprocessing";
import { N8AOPostPass } from "n8ao";

const { Vector2, Vector3, Group, Mesh, BoxGeometry, MeshStandardMaterial, MeshPhysicalMaterial } = THREE;

const PX = 18.3; // plan pixels per metre
const CX = 661, CZ = 421; // plan centre
const P = (x, z) => new Vector2((x - CX) / PX, (z - CZ) / PX);

const FLOOR = 0.45; // finished floor level (plinth)
const WALL_H = 3.4; // wall height up to the roof slab
const EXT = 0.3, INT = 0.16; // wall thicknesses (m)

const root = document.querySelector("[data-model3d]");
const BASE = root?.dataset.assets || "assets/model/";
const small = window.matchMedia("(max-width: 760px)").matches;

// ───────── materials ─────────
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
// foliage: leaves painted onto a canvas, cut out with alpha
function canvasTex(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const GREENS = ["#4f6b2f", "#5e7c36", "#6c8a3e", "#7a9848", "#435d28", "#8aa655", "#56733a"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function leafTexture() {
  const t = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 2600; i++) {
      g.save();
      g.translate(Math.random() * w, Math.random() * h);
      g.rotate(Math.random() * Math.PI * 2);
      g.fillStyle = pick(GREENS);
      g.globalAlpha = 0.85 + Math.random() * 0.15;
      const l = 7 + Math.random() * 9;
      g.beginPath(); g.ellipse(0, 0, l, l * 0.42, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}
function frondTexture() {
  return canvasTex(256, 1024, (g, w, h) => {
    g.lineCap = "round";
    for (let y = h * 0.97; y > h * 0.02; y -= 7) {
      const t = 1 - y / h; // 0 base → 1 tip
      const len = w * 0.48 * Math.sin(Math.PI * Math.min(1, 0.12 + t));
      for (const side of [-1, 1]) {
        g.strokeStyle = pick(GREENS);
        g.lineWidth = 3 + Math.random() * 2;
        g.beginPath();
        g.moveTo(w / 2, y);
        g.quadraticCurveTo(w / 2 + side * len * 0.5, y - 10, w / 2 + side * len, y - 26 - Math.random() * 14);
        g.stroke();
      }
    }
    g.strokeStyle = "#7b6a45"; g.lineWidth = 5;
    g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h * 0.02); g.stroke();
  });
}
function foliage(map, color) {
  return new MeshStandardMaterial({ color, map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78, metalness: 0 });
}
const plain = (color, roughness = 0.9, extra = {}) => new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

const M = {
  stucco: pbr("white_stucco", { size: 3, arm: true, color: "#f6f2ec", normal: 0.6 }),
  plaster: pbr("white_stucco", { size: 3, color: "#f7f4ef", normal: 0.2, roughness: 0.95 }),
  boundary: pbr("white_stucco", { size: 3, arm: true, color: "#eadfce", normal: 0.8 }),
  pavers: pbr("concrete_pavers", { size: 1.6, arm: true, color: "#efe7da" }),
  court: pbr("large_floor_tiles_02", { size: 3, arm: true, color: "#f2ede6" }),
  marble: pbr("marble_tiles", { size: 2.4, roughness: 0.22, normal: 0.3, envMapIntensity: 1.2 }),
  deck: pbr("wood_floor_deck", { size: 2.2, arm: true }),
  grass: pbr("leafy_grass", { size: 2.5, arm: true, color: "#c9dcb0" }),
  soft: pbr("leafy_grass", { size: 2, arm: true, color: "#e0ecc4" }),
  asphalt: pbr("asphalt_02", { size: 5, color: "#b9b6b2" }),
  sand: pbr("sand_01", { size: 9, color: "#ddd2c0", normal: 0.6 }),
  roofTop: pbr("large_floor_tiles_02", { size: 2, color: "#d9d6d0" }),
  water: new MeshPhysicalMaterial({ color: "#2e7d8f", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, normalScale: new Vector2(0.35, 0.35) }),
  glass: new MeshPhysicalMaterial({ color: "#a9c2cc", metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.28, envMapIntensity: 2.6, clearcoat: 1, depthWrite: false }),
  frame: new MeshStandardMaterial({ color: "#2f3236", metalness: 0.75, roughness: 0.35 }),
  louver: new MeshStandardMaterial({ color: "#8b8d8f", metalness: 0.85, roughness: 0.32 }),
  carGlass: new MeshPhysicalMaterial({ color: "#10161b", metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 2 }),
  tyre: plain("#1c1c1c", 0.8),
  rim: new MeshStandardMaterial({ color: "#c8c8c8", metalness: 1, roughness: 0.25 }),
  bark: plain("#7d6552", 1),
  palmBark: plain("#9a8163", 1),
  leaf: foliage(leafTexture(), "#ffffff"),
  palmLeaf: foliage(frondTexture(), "#c9cfb4"),
  shrub: foliage(leafTexture(), "#cfe0b8"),
  fabric: plain("#d9d0c3", 1),
  fabricDark: plain("#6e655c", 1),
  wood: plain("#6b4a33", 0.55),
  rug: plain("#b9a58d", 1),
  metal: new MeshStandardMaterial({ color: "#2b2b2b", metalness: 0.7, roughness: 0.4 }),
  step: pbr("marble_tiles", { size: 1.2, roughness: 0.3, normal: 0.2 }),
  line: plain("#f4f1ea", 0.7),
  context: pbr("white_stucco", { size: 3, color: "#ebe4d8", normal: 0.5 }),
  contextGlass: new MeshStandardMaterial({ color: "#26343c", metalness: 0.6, roughness: 0.15 }),
};
M.water.normalMap = texLoader.load(`${BASE}waternormals.jpg`);
M.water.normalMap.wrapS = M.water.normalMap.wrapT = THREE.RepeatWrapping;
M.water.normalMap.repeat.set(0.35, 0.35);
const CAR_PAINT = ["#f2f2f0", "#15171a", "#8d9196", "#1f2f45", "#e8e4dc"].map((color) => new MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 }));

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

/** Flat slab from a polygon of plan points, top face at `top`, `depth` thick. UVs are in metres. */
function slab(points, top, depth, material, opts) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts(points)), { depth, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(Math.PI / 2); // shape y → world z, extrusion → world −y
  geo.translate(0, top, 0);
  return add(geo, material, opts);
}
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const circle = (cx, cz, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cz + r * Math.sin((i / n) * Math.PI * 2)]);
function roundRect(x0, z0, x1, z1, r, n = 6) {
  const out = [];
  const corner = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  corner(x0 + r, z0 + r, Math.PI);
  corner(x1 - r, z0 + r, -Math.PI / 2);
  corner(x1 - r, z1 - r, 0);
  corner(x0 + r, z1 - r, Math.PI / 2);
  return out;
}

/** Box whose UVs are in metres, so textures keep their real-world scale. */
function metricBox(w, h, d) {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  return g;
}
/** Box laid along the plan segment a→b (Vector2s in metres). */
function along(a, b, { h, t, base, material, extend = t, cast = true, parent = model }) {
  const len = a.distanceTo(b);
  const m = add(metricBox(len + extend, h, t), material, { cast, parent });
  m.position.set((a.x + b.x) / 2, base + h / 2, (a.y + b.y) / 2);
  m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  return m;
}
function wall(points, { h = WALL_H, t = EXT, base = FLOOR, material = M.stucco, closed = false, parent } = {}) {
  const p = pts(points);
  if (closed) p.push(p[0]);
  for (let i = 0; i < p.length - 1; i++) if (p[i].distanceTo(p[i + 1]) > 0.01) along(p[i], p[i + 1], { h, t, base, material, parent });
}
/** Glass between a and b from height y0 to y1 with aluminium mullions every `bay` metres. */
function pane(a, b, y0, y1, bay) {
  along(a, b, { h: y1 - y0, t: 0.03, base: FLOOR + y0, material: M.glass, extend: 0, cast: false });
  const len = a.distanceTo(b), n = Math.max(1, Math.round(len / bay));
  for (let i = 0; i <= n; i++) {
    const c = a.clone().lerp(b, i / n);
    const dir = b.clone().sub(a).normalize().multiplyScalar(0.03);
    along(c.clone().sub(dir), c.clone().add(dir), { h: y1 - y0, t: 0.08, base: FLOOR + y0, material: M.frame, extend: 0 });
  }
  along(a, b, { h: 0.06, t: 0.08, base: FLOOR + y1 - 0.06, material: M.frame, extend: 0 });
  along(a, b, { h: 0.06, t: 0.08, base: FLOOR + y0, material: M.frame, extend: 0 });
}
/** Window: sill wall, glass, lintel. */
function win(pa, pb) {
  const [a, b] = pts([pa, pb]);
  along(a, b, { h: 0.9, t: EXT, base: FLOOR, material: M.stucco });
  along(a, b, { h: WALL_H - 2.9, t: EXT, base: FLOOR + 2.9, material: M.stucco });
  pane(a, b, 0.9, 2.9, 1.2);
}
/** Floor-to-ceiling sliding glass. */
function glazing(pa, pb) {
  const [a, b] = pts([pa, pb]);
  along(a, b, { h: WALL_H - 3.0, t: EXT, base: FLOOR + 3.0, material: M.stucco });
  pane(a, b, 0, 3.0, 1.6);
}

// ───────── landscape pieces ─────────
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function bumpy(radius, detail, amount) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position, v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (Math.sin(v.x * 3.1) * Math.cos(v.z * 2.7) + Math.sin(v.y * 4.3)) * amount * 0.5 + (rand() - 0.5) * amount;
    p.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
function tree(x, z, s = 1, base = 0.2) {
  const p = P(x, z), g = new Group();
  const trunk = add(new THREE.CylinderGeometry(0.1 * s, 0.18 * s, 2.2 * s, 10), M.bark, { parent: g });
  trunk.position.y = 1.1 * s;
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2, r = (i === 0 ? 0 : 0.85) * s, rr = (0.95 + rand() * 0.5) * s;
    const y = (2.6 + rand() * 0.8) * s;
    for (const k of [1, 0.8, 0.6]) {
      const c = add(bumpy(rr * k, 3, 0.3), M.leaf, { parent: g });
      c.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      c.rotation.set(rand() * 3, rand() * 3, 0);
    }
  }
  g.position.set(p.x, base, p.y);
  g.rotation.y = rand() * 6;
  model.add(g);
}
const frondGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 4, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5; // 0 at base → 1 at tip
    const x = p.getX(i) * 1.5;
    p.setXYZ(i, x, Math.abs(x) * 0.45 - t * t * 1.6 + t * 0.4, t * 3.6);
  }
  g.computeVertexNormals();
  return g;
})();
function palm(x, z, h = 6, base = 0.2, parent = model) {
  const p = P(x, z), g = new Group();
  const lean = (rand() - 0.5) * 0.15;
  const tg = new THREE.CylinderGeometry(0.2, 0.28, h, 12, 24);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const k = 1 + 0.08 * Math.max(0, Math.sin(y * 9)); tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); }
  tg.computeVertexNormals();
  const trunk = add(tg, M.palmBark, { parent: g });
  trunk.position.y = h / 2;
  trunk.rotation.z = lean;
  const crown = new Group();
  crown.position.set(-Math.sin(lean) * h * 0.5, h, 0);
  for (let i = 0; i < 22; i++) {
    const f = add(frondGeo, M.palmLeaf, { parent: crown });
    f.rotation.order = "YXZ";
    f.rotation.y = (i / 22) * Math.PI * 2 + rand() * 0.25;
    f.rotation.x = -0.75 + (i % 3) * 0.3 + rand() * 0.2;
    f.scale.setScalar(0.8 + rand() * 0.35);
  }
  g.add(crown);
  g.position.set(p.x, base, p.y);
  parent.add(g);
}
function shrubs(points, base) {
  for (const [x, z] of points) {
    const p = P(x, z), r = 0.5 + rand() * 0.2;
    for (const k of [1, 0.75]) {
      const s = add(bumpy(r * k, 2, 0.3), M.shrub);
      s.position.set(p.x, base + 0.35, p.y);
      s.rotation.set(rand() * 3, rand() * 3, 0);
    }
  }
}

function car(x, z, rot, paint) {
  const p = P(x, z), g = new Group();
  const body = add(new RoundedBoxGeometry(4.7, 0.78, 1.88, 4, 0.3), paint, { parent: g });
  body.position.y = 0.72;
  const cabin = add(new RoundedBoxGeometry(2.6, 0.62, 1.66, 4, 0.26), M.carGlass, { parent: g });
  cabin.position.set(-0.25, 1.33, 0);
  const top = add(new RoundedBoxGeometry(2.1, 0.08, 1.5, 2, 0.04), paint, { parent: g });
  top.position.set(-0.3, 1.66, 0);
  const wheel = new THREE.CylinderGeometry(0.37, 0.37, 0.26, 28);
  const rimG = new THREE.CylinderGeometry(0.24, 0.24, 0.28, 20);
  for (const [wx, wz] of [[1.45, 0.82], [1.45, -0.82], [-1.5, 0.82], [-1.5, -0.82]]) {
    const w = add(wheel, M.tyre, { parent: g }); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.37, wz);
    const r = add(rimG, M.rim, { parent: g }); r.rotation.x = Math.PI / 2; r.position.set(wx, 0.37, wz);
  }
  g.position.set(p.x, FLOOR - 0.35, p.y);
  g.rotation.y = rot;
  model.add(g);
}

// simple furniture
function box(x, z, w, d, h, y, material, rot = 0) {
  const p = P(x, z);
  const m = add(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.05, h / 3)), material);
  m.position.set(p.x, y + h / 2, p.y);
  m.rotation.y = rot;
  return m;
}
function table(x, z, w, d, chairs, rot = 0, y = FLOOR) {
  const g = new Group(), p = P(x, z);
  const top = add(new RoundedBoxGeometry(w, 0.05, d, 2, 0.02), M.wood, { parent: g }); top.position.y = 0.75;
  const leg = add(new BoxGeometry(0.1, 0.72, Math.max(0.1, d - 0.4)), M.metal, { parent: g }); leg.position.y = 0.36;
  const n = chairs / 2;
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < n; i++) {
    const c = add(new RoundedBoxGeometry(0.5, 0.45, 0.5, 2, 0.06), M.fabric, { parent: g });
    c.position.set(-w / 2 + (w / n) * (i + 0.5), 0.23, side * (d / 2 + 0.35));
    const back = add(new RoundedBoxGeometry(0.5, 0.45, 0.08, 2, 0.03), M.fabric, { parent: g });
    back.position.set(c.position.x, 0.65, side * (d / 2 + 0.58));
  }
  g.position.set(p.x, y, p.y);
  g.rotation.y = rot;
  model.add(g);
}
function roundTable(x, z, r, chairs, y) {
  const p = P(x, z);
  const t = add(new THREE.CylinderGeometry(r, r, 0.05, 32), M.wood); t.position.set(p.x, y + 0.75, p.y);
  const l = add(new THREE.CylinderGeometry(0.06, 0.2, 0.72, 12), M.metal); l.position.set(p.x, y + 0.36, p.y);
  for (let i = 0; i < chairs; i++) {
    const a = (i / chairs) * Math.PI * 2;
    const c = add(new RoundedBoxGeometry(0.5, 0.45, 0.5, 2, 0.08), M.fabric);
    c.position.set(p.x + Math.cos(a) * (r + 0.4), y + 0.23, p.y + Math.sin(a) * (r + 0.4));
    c.rotation.y = -a;
  }
}

// ───────── site & context ─────────
// desert ground, streets
{
  const g = new THREE.PlaneGeometry(4000, 4000);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4000, uv.getY(i) * 4000);
  g.rotateX(-Math.PI / 2);
  add(g, M.sand, { cast: false });
}
const FAR = 9000;
slab(rect(-FAR, 800, FAR, 1070), 0.04, 0.1, M.asphalt, { cast: false });
slab(rect(-FAR, 765, FAR, 800), 0.16, 0.2, M.pavers, { cast: false });
slab(rect(-FAR, 1070, FAR, 1105), 0.16, 0.2, M.pavers, { cast: false });
slab(rect(-FAR, -30, FAR, 76), 0.04, 0.1, M.asphalt, { cast: false });
for (let x = -2000; x < 3000; x += 110) slab(rect(x, 933, x + 55, 937), 0.05, 0.01, M.line, { cast: false });

// neighbouring villas (simple massing, fading into the haze)
function contextVilla(x0, z0, x1, z1, plot) {
  wall([[plot[0], plot[1]], [plot[2], plot[1]], [plot[2], plot[3]], [plot[0], plot[3]]], { h: 1.8, t: 0.25, base: 0, material: M.boundary, closed: true });
  const [a, b] = [P(x0, z0), P(x1, z1)];
  const w = b.x - a.x, d = b.y - a.y;
  const lower = add(metricBox(w, 4.2, d), M.context);
  lower.position.set((a.x + b.x) / 2, 2.1, (a.y + b.y) / 2);
  const upper = add(metricBox(w * 0.7, 3.6, d * 0.75), M.context);
  upper.position.set(a.x + w * 0.4, 6, (a.y + b.y) / 2 + d * 0.05);
  for (const [y, hh] of [[1.2, 2], [5, 1.8]]) {
    const g = add(new BoxGeometry(w * 0.5, hh, 0.05), M.contextGlass, { cast: false });
    g.position.set(a.x + w * 0.45, y + hh / 2, (z1 > 421 ? b.y : a.y) + (z1 > 421 ? 0.03 : -0.03));
  }
}
contextVilla(60, 200, 330, 640, [-110, 82, 398, 762]);
contextVilla(990, 180, 1290, 620, [925, 82, 1430, 762]);
contextVilla(460, -560, 860, -140, [405, -660, 918, -40]);
contextVilla(-40, -560, 330, -140, [-110, -660, 398, -40]);
contextVilla(460, 1180, 860, 1600, [405, 1115, 918, 1700]);
contextVilla(990, 1180, 1300, 1600, [925, 1115, 1430, 1700]);
contextVilla(20, 1180, 330, 1600, [-110, 1115, 398, 1700]);
for (let x = -500; x < 1900; x += 330) palm(x, 785, 7, 0.2);

// ───────── the plot ─────────
const plot = [[405, 80], [918, 82], [905, 762], [752, 757], [600, 752], [548, 742], [430, 762]];
slab(plot, 0.12, 0.12, M.pavers, { cast: false });
wall([[810, 81], [405, 80], [430, 762], [548, 742]], { h: 2.1, t: 0.24, base: 0, material: M.boundary });
wall([[752, 757], [905, 762], [918, 82], [905, 82]], { h: 2.1, t: 0.24, base: 0, material: M.boundary });
// sliding gates
along(P(600, 752), P(752, 757), { h: 1.9, t: 0.06, base: 0.1, material: M.louver, extend: 0 });

slab(rect(410, 86, 795, 150), 0.2, 0.1, M.grass, { cast: false });
slab(rect(600, 655, 752, 752), 0.14, 0.05, M.court, { cast: false });
slab(rect(600, 178, 868, 522), 0.18, 0.1, M.court, { cast: false });
slab(rect(602, 180, 700, 362), 0.3, 0.12, M.deck);
slab(circle(668, 360, 45), 0.3, 0.12, M.deck);

// meandering water feature: pale channel bed + animated water surface
const riverPath = new THREE.CatmullRomCurve3(
  [[688, 222], [730, 238], [765, 262], [745, 292], [778, 318], [756, 348], [726, 376], [738, 408], [712, 442], [722, 476], [704, 516]].map(([x, z]) => new Vector3(x, 0, z))
);
const rp = riverPath.getSpacedPoints(120);
const offset = (d) => rp.map((p, i) => { const t = riverPath.getTangentAt(i / (rp.length - 1)); return [p.x - t.z * d, p.z + t.x * d]; });
slab([...offset(9), ...offset(-9).reverse()], 0.26, 0.1, M.stucco);
slab([...offset(7), ...offset(-7).reverse()], 0.29, 0.05, M.water, { cast: false });

slab([...offset(-10).slice(13, 78), [760, 376], [866, 376], [866, 181], [745, 181]], 0.24, 0.1, M.soft, { cast: false });
slab([[710, 455], [745, 452], [752, 470], [752, 520], [714, 520], [718, 488]], 0.24, 0.1, M.soft, { cast: false });

for (const r of [rect(590, 660, 602, 714), rect(762, 694, 836, 706), rect(818, 742, 870, 753)]) {
  slab(r, 0.7, 0.55, M.stucco);
  slab(r, 0.66, 0.05, M.soft, { cast: false });
}
shrubs([[596, 668], [596, 688], [596, 706], [772, 700], [792, 700], [812, 700], [830, 700], [830, 747], [852, 747], [866, 747]], 0.6);
shrubs([[845, 200], [858, 230], [790, 360], [856, 355], [742, 505]], 0.2);

for (const x of [436, 486, 580, 682, 735, 776]) palm(x, 160, 6.5 + rand() * 1.5, 0.2);
tree(812, 238, 1.15, 0.25); tree(846, 318, 1, 0.25); tree(730, 492, 0.85, 0.25); tree(846, 728, 0.7); tree(520, 732, 0.75);

// deck furniture: outdoor dining on the round deck, loungers on the timber deck
roundTable(668, 360, 0.75, 6, 0.3);
box(620, 205, 0.7, 2, 0.35, 0.3, M.fabric, 0); box(648, 205, 0.7, 2, 0.35, 0.3, M.fabric, 0);
box(640, 290, 2.4, 0.9, 0.4, 0.3, M.fabricDark); box(640, 316, 1.1, 0.6, 0.35, 0.3, M.wood);

// open parking on the lane
for (const x of [812, 860, 908]) slab(rect(x - 1, 92, x + 1, 164), 0.13, 0.01, M.line, { cast: false });
car(838, 126, Math.PI / 2, CAR_PAINT[3]); car(884, 126, Math.PI / 2, CAR_PAINT[4]);

// ───────── building ─────────
const westWing = [[476, 178], [600, 178], [600, 522], [752, 522], [752, 655], [600, 655], [600, 720], [548, 720], [548, 700], [482, 700],
  ...Array.from({ length: 7 }, (_, i) => { const a = Math.PI / 2 + (i / 6) * (Math.PI / 2); return [482 + 20 * Math.cos(a), 680 + 20 * Math.sin(a)]; }),
  [462, 192], [466, 182]];
const eastWing = roundRect(755, 378, 868, 700, 22);
slab(westWing, FLOOR, FLOOR, M.marble);
slab(eastWing, FLOOR, FLOOR, M.marble);
slab(rect(600, 522, 752, 655), FLOOR + 0.005, 0.01, M.court, { cast: false });

// west wing façades
wall([[600, 290], [600, 178], [590, 178]]);
win([590, 178], [512, 178]);
wall([[512, 178], [476, 178], [466, 182], [462, 192], [462, 330]]);
win([462, 330], [462, 385]);
wall([[462, 385], [462, 420]]);
win([462, 420], [462, 475]);
wall([[462, 475], [462, 680]]);
wall(westWing.slice(10, 17).reverse().concat([[482, 700], [548, 700], [548, 720], [560, 720]]));
wall([[588, 720], [600, 720], [600, 655]]);
glazing([600, 298], [600, 512]);
wall([[600, 512], [600, 522], [752, 522], [752, 655]]);
wall([[600, 545], [600, 655]]);
along(P(600, 655), P(752, 655), { h: 0.6, t: 0.35, base: FLOOR + WALL_H - 0.6, material: M.stucco }); // garage beam

// west wing interior: service rooms, guest suite, living, stair hall, stores
const int = (list) => wall(list, { t: INT, material: M.plaster });
int([[462, 290], [520, 290]]); int([[542, 290], [600, 290]]);
int([[500, 178], [500, 262]]); int([[500, 215], [600, 215]]); int([[545, 178], [545, 215]]);
int([[462, 240], [488, 240]]); int([[462, 262], [488, 262]]);
int([[462, 517], [548, 517]]);
int([[470, 522], [508, 522], [508, 556], [470, 556]]); // lift shaft
int([[552, 522], [552, 545]]); int([[552, 570], [552, 655]]);
int([[552, 545], [600, 545]]); int([[552, 598], [600, 598]]); int([[552, 655], [600, 655]]);

// sculptural curved stair with a glass balustrade
{
  const c = P(502, 612), steps = 19;
  for (let i = 0; i < steps; i++) {
    const a = Math.PI / 2 + (i / steps) * Math.PI;
    const s = add(new BoxGeometry(1.7, 0.06, 0.5), M.step);
    s.position.set(c.x + Math.cos(a) * 1.4, FLOOR + 0.18 * (i + 1), c.y + Math.sin(a) * 1.4);
    s.rotation.y = -a;
    const g = add(new BoxGeometry(0.02, 1, 0.5), M.glass, { cast: false });
    g.position.set(c.x + Math.cos(a) * 0.52, FLOOR + 0.18 * (i + 1) + 0.5, c.y + Math.sin(a) * 0.52);
    g.rotation.y = -a;
  }
}

// garage
for (const x of [652, 700]) slab(rect(x - 1, 548, x + 1, 650), FLOOR + 0.02, 0.01, M.line, { cast: false });
car(628, 598, Math.PI / 2, CAR_PAINT[0]); car(676, 598, Math.PI / 2, CAR_PAINT[1]); car(724, 598, Math.PI / 2, CAR_PAINT[2]);

// east wing: dining, washrooms, saloon
wall(eastWing.slice(0, 7).concat([[780, 378]]));
glazing([780, 378], [843, 378]);
wall([[843, 378], ...eastWing.slice(7, 14), [868, 405]]);
win([868, 405], [868, 452]);
wall([[868, 452], [868, 560]]);
win([868, 560], [868, 640]);
wall([[868, 640], ...eastWing.slice(14, 21), [828, 700]]);
wall([[812, 700], ...eastWing.slice(21), [755, 456]]);
glazing([755, 400], [755, 456]);
int([[755, 462], [790, 462], [790, 520], [755, 520]]);
int([[820, 520], [820, 462], [868, 462]]); int([[820, 520], [868, 520]]);
// vertical aluminium louvres screening the saloon's street façade
for (let x = 778; x <= 846; x += 5.5) {
  const f = add(new BoxGeometry(0.06, WALL_H, 0.35), M.louver);
  const p = P(x, 707);
  f.position.set(p.x, FLOOR + WALL_H / 2, p.y);
}

// furniture
box(530, 330, 3.2, 0.95, 0.75, FLOOR, M.fabric); box(514, 355, 0.95, 2.2, 0.75, FLOOR, M.fabric);
slab(rect(505, 320, 585, 395), FLOOR + 0.015, 0.015, M.rug, { cast: false });
box(548, 362, 1.3, 0.8, 0.38, FLOOR, M.wood);
table(530, 460, 2.6, 1.05, 8);
box(565, 252, 1.9, 2.1, 0.55, FLOOR, M.fabric); box(565, 232, 1.9, 0.12, 1.1, FLOOR, M.wood);
table(811, 420, 3, 1.1, 8);
box(766, 610, 0.85, 7, 0.65, FLOOR, M.fabric); box(857, 610, 0.85, 7, 0.65, FLOOR, M.fabric);
slab(rect(778, 540, 846, 680), FLOOR + 0.015, 0.015, M.rug, { cast: false });
box(811, 610, 1.4, 2.4, 0.4, FLOOR, M.wood);

// roof, parapets — lifted away on scroll to reveal the plan
const roof = new Group();
model.add(roof);
const roofMats = [M.stucco.clone(), M.roofTop.clone()];
for (const m of roofMats) m.transparent = true;
const RT = FLOOR + WALL_H + 0.6;
slab(westWing, RT, 0.6, roofMats[0], { parent: roof });
slab(eastWing, RT, 0.6, roofMats[0], { parent: roof });
slab(westWing, RT + 0.02, 0.02, roofMats[1], { parent: roof, cast: false });
slab(eastWing, RT + 0.02, 0.02, roofMats[1], { parent: roof, cast: false });
wall(westWing, { h: 0.9, t: 0.25, base: RT, material: roofMats[0], closed: true, parent: roof });
wall(eastWing, { h: 0.9, t: 0.25, base: RT, material: roofMats[0], closed: true, parent: roof });
for (const [x, z] of [[540, 400], [520, 250], [811, 600]]) {
  const u = add(metricBox(1.4, 0.9, 1), plain("#cfcfcf", 0.5, { transparent: true }), { parent: roof });
  const p = P(x, z); u.position.set(p.x, RT + 0.45, p.y);
  roofMats.push(u.material);
}

// ───────── viewer ─────────
const LABELS = [
  ["Family living & dining", 530, 400],
  ["Guest bedroom", 550, 252],
  ["Dining", 811, 420],
  ["Garage", 676, 600],
  ["Courtyard garden", 790, 300],
];
const smooth = (t) => t * t * (3 - 2 * t);

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in post
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.prepend(renderer.domElement);
  for (const m of Object.values(M)) if (m.map) m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // sky + image-based lighting
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader(manager).load(`${BASE}sky.hdr`, (hdr) => {
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
  });
  texLoader.load(`${BASE}sky.jpg`, (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  });
  scene.backgroundIntensity = 1;
  scene.environmentIntensity = 0.75;
  scene.fog = new THREE.Fog("#cdd6df", 70, 480);

  const sun = new THREE.DirectionalLight("#ffe8c7", 4.4);
  sun.position.set(-34, 42, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 36, bottom: -36, near: 1, far: 140 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight("#e8f0ff", "#c8b394", 0.35));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 1200);
  const home = { pos: new Vector3(44, 16, 52), target: new Vector3(0, 1.5, 2) };
  // the camera rises from a street-level view to a bird's-eye view as the roof lifts (until the visitor takes over)
  let userMoved = false;
  const sph = new THREE.Spherical(), off = new Vector3();

  // post-processing: ambient occlusion, filmic tone mapping, anti-aliasing, soft vignette
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const ao = new N8AOPostPass(scene, camera, 1, 1);
  Object.assign(ao.configuration, { aoRadius: 2.2, distanceFalloff: 1.2, intensity: 2.6, halfRes: small, gammaCorrection: false });
  ao.setQualityMode(small ? "Low" : "Medium");
  composer.addPass(ao);
  composer.addPass(new EffectPass(camera,
    new BloomEffect({ intensity: 0.25, luminanceThreshold: 0.92, mipmapBlur: true }),
    new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
    new BrightnessContrastEffect({ brightness: 0.02, contrast: 0.1 }),
    new HueSaturationEffect({ saturation: 0.04 }),
    new VignetteEffect({ offset: 0.4, darkness: 0.35 })));
  composer.addPass(new EffectPass(camera, new SMAAEffect()));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 10;
  controls.maxDistance = 140;
  controls.maxPolarAngle = 1.45;
  controls.enableZoom = false;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.4;
  // one-finger vertical swipes keep scrolling the page; horizontal swipes orbit, pinch zooms
  renderer.domElement.style.touchAction = "pan-y";
  controls.addEventListener("change", () => { controls.target.clamp(new Vector3(-18, 0, -22), new Vector3(18, 5, 22)); });

  const resetView = () => {
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    if (aspect < 1.2) camera.position.multiplyScalar(Math.min(1.7, 1 / aspect + 0.15)); // fit narrow screens
    controls.update();
  };

  // the scroll wheel only zooms once the visitor has clicked into the model; until then it scrolls the page
  const hint = root.querySelector("[data-model-hint]");
  const engage = (on) => {
    controls.enableZoom = on;
    stage.classList.toggle("is-engaged", on);
    if (on) { stage.setAttribute("data-lenis-prevent", ""); controls.autoRotate = false; } else stage.removeAttribute("data-lenis-prevent");
  };
  stage.addEventListener("pointerdown", (e) => { if (e.target === renderer.domElement) engage(true); });
  stage.addEventListener("pointerleave", () => engage(false));
  stage.addEventListener("wheel", () => { if (!controls.enableZoom) { hint?.classList.add("is-nudge"); clearTimeout(hint?._t); if (hint) hint._t = setTimeout(() => hint.classList.remove("is-nudge"), 1200); } }, { passive: true });

  // labels
  const labelWrap = root.querySelector("[data-model-labels]");
  const labels = LABELS.map(([text, x, z]) => {
    const el = document.createElement("span");
    el.className = "model__label";
    el.textContent = text;
    labelWrap?.appendChild(el);
    const p = P(x, z);
    return { el, pos: new Vector3(p.x, FLOOR + 1.6, p.y) };
  });
  const v = new Vector3();
  const placeLabels = (alpha) => {
    if (!labelWrap || labelWrap.hidden) return;
    labelWrap.style.opacity = alpha;
    if (alpha < 0.01) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const l of labels) {
      v.copy(l.pos).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      l.el.style.visibility = on ? "" : "hidden";
      l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    }
  };

  // roof: follows the scroll ("auto") until the visitor picks on/off
  let roofMode = "auto", lift = 0;
  const roofBtn = root.querySelector("[data-model-roof]");
  const roofTarget = () => (roofMode === "on" ? 0 : roofMode === "off" ? 1 : root._scroll ?? 1);
  roofBtn?.addEventListener("click", () => {
    roofMode = roofTarget() > 0.5 ? "on" : "off";
    roofBtn.setAttribute("aria-pressed", String(roofMode === "on"));
  });
  const labelBtn = root.querySelector("[data-model-labels-toggle]");
  labelBtn?.addEventListener("click", () => {
    labelWrap.hidden = !labelWrap.hidden;
    labelBtn.setAttribute("aria-pressed", String(!labelWrap.hidden));
  });
  controls.addEventListener("start", () => { userMoved = true; });
  root.querySelector("[data-model-reset]")?.addEventListener("click", () => {
    userMoved = false;
    resetView();
    roofMode = "auto";
    controls.autoRotate = !reduceMotion;
  });

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();
  resetView();

  const clock = new THREE.Clock();
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    M.water.normalMap.offset.x += dt * 0.03;
    M.water.normalMap.offset.y += dt * 0.012;

    const target = roofTarget();
    lift += (target - lift) * Math.min(1, dt * 6);
    const e = smooth(Math.min(1, Math.max(0, lift)));
    roof.visible = e < 0.995;
    roof.position.y = e * 9;
    const op = 1 - smooth(Math.min(1, Math.max(0, (e - 0.35) / 0.65)));
    for (const m of roofMats) { m.opacity = op; m.depthWrite = op > 0.98; }
    if (roofBtn && roofMode === "auto") roofBtn.setAttribute("aria-pressed", String(target < 0.5));
    if (!userMoved) {
      off.copy(camera.position).sub(controls.target);
      sph.setFromVector3(off);
      const narrow = Math.min(1.7, Math.max(1, 1 / (camera.aspect || 1) + 0.15));
      const k = Math.min(1, dt * 5);
      sph.phi += (THREE.MathUtils.lerp(1.4, 0.85, e) - sph.phi) * k;
      sph.radius += (THREE.MathUtils.lerp(70, 62, e) * narrow - sph.radius) * k;
      camera.position.copy(controls.target).add(off.setFromSpherical(sph));
    }

    controls.update();
    composer.render(dt);
    placeLabels(smooth(Math.min(1, Math.max(0, (e - 0.6) / 0.4))));
  };

  let visible = false, ready = false;
  const run = () => renderer.setAnimationLoop(visible && ready ? frame : null);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; run(); }).observe(stage);
  manager.onProgress = (_, done, total) => { if (status) status.textContent = `Loading model ${Math.round((done / total) * 100)}%`; };
  manager.onLoad = () => {
    ready = true;
    clock.getDelta();
    frame();
    run();
    root.classList.add("is-ready");
  };
  root._view = { camera, controls };
}

if (root) mount();
