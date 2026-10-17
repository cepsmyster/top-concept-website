"""Retail Park, Sharjah: the desert around the massing (used by massing.py, `--env desert`).

Everything is built from code: no downloaded models, textures or HDRIs. The site itself is the plan's
ground surfaces (plan/site_ground.png: asphalt, paving, pavers, sand, planting and the jogging trail, with
the road markings) at true scale. Around it, laid out from the satellite view of the plot (north-east of the
interchange), in plan metres:
  - the plan's roads carry on: the rear road west to the overpass road and east to the road by the housing,
    the collector (the plan's main road) back into the highway at both ends, the junction road down to the highway;
  - the highway (dual carriageway) curving south-east past the site, the overpass road and the roundabout road
    bridging it, the loop ramp, and the local road along the farms;
  - date-palm farms south-west of the highway and north of the site, walled compounds and housing blocks;
  - the dark gravel plain with pale sand patches, scattered acacia and ghaf trees and shrubs;
  - low dunes far out, a hazy sky and a fog volume that only closes in over the last kilometres.
Positions away from the plan are read off the satellite image by eye (about 0.7 m a pixel), so they are
approximate; everything that touches the site follows the plan exactly.

Axes as massing.py: plan x west -> east, z rear road (north) -> main road (south); Blender (x, -z, height).
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

V5 = bpy.app.version >= (5, 0, 0)
rng = np.random.default_rng(20261017)


def B(x, z, y=0.0):
    return (x, -z, y)


def srgb(c):
    """sRGB 0-255 -> linear 0-1."""
    c = np.asarray(c, float) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


# ───────── layout ─────────
CENTRE = (35.0, 12.0)            # middle of the site
EXTENT = 8000.0                  # the ground runs this far out from the centre in every direction
SAND = (206, 184, 150)           # the plan's sand colour: the graded plot round the site matches it exactly
GRAVEL = (104, 96, 86)           # the dark gravel plain
PATCH = (196, 178, 146)          # pale sand patches on the plain
FARM = (184, 150, 112)           # farmland
DUNE = (204, 172, 132)           # the far dunes

HIGHWAY = [(-3000, 36), (-700, 44), (-420, 48), (-300, 56), (-200, 72), (-130, 92), (-60, 113), (43, 158), (141, 211),
           (246, 278), (351, 348), (526, 474), (701, 603), (3000, 2290)]
# (name, centreline, width, lanes, bridge) ; bridge = (z of the crossing, deck height)
ROADS = [
    ("rear_road_west", [(-80.4, -23.4), (-168, -23.4)], 7.75, 2, None),
    ("rear_road_east", [(151.1, -23.3), (781, -23.3)], 7.55, 2, None),
    ("collector_west", [(-80.4, 67.9), (-150, 67.8), (-215, 69.5), (-300, 64.5), (-420, 56.5), (-700, 52.5), (-3000, 44.5)], 7.35, 2, None),
    ("collector_east", "bezier", 8.5, 2, None),
    ("junction_road", [(84.9, 80.7), (74.2, 91.2), (28.0, 136.5)], 7.8, 2, None),
    ("overpass_road", [(-177, -3000), (-177, 3000)], 18.0, 4, (78.6, 7.5)),
    ("roundabout_road", [(-401, -3000), (-401, 3000)], 15.0, 4, (48.0, 7.5)),
    ("housing_road", [(790, -3000), (790, 661)], 15.0, 4, None),
    ("farm_road", [(-401, 182), (-370, 208), (421, 706), (2400, 1950)], 7.5, 2, None),
]
COLLECTOR_EAST = [(151.0, 76.2), (246.0, 81.0), (255.4, 277.4), (420.0, 391.0)]  # cubic Bezier into the highway
LOOP_RAMP = ((-118.0, 160.0), 55.0, 45.0)   # centre, radii (x, z)
ROUNDABOUT = ((-401.0, -7.0), 30.0)
SITE_BOX = (-95.4, -68.4, 166.1, 91.7)       # the plan sheet (min x, min z, max x, max z)

# rotated rectangles (centre x, centre z, width, depth, angle in degrees): palm farms and walled compounds
FARMS = [(-330, 185, 95, 105, 33), (-215, 240, 120, 120, 33), (60, 320, 185, 150, 33), (305, 488, 160, 170, 33),
         (-120, 420, 170, 140, 33), (190, 600, 190, 150, 33), (-300, 380, 120, 130, 33), (480, 720, 220, 160, 33),
         (-40, -112, 230, 62, 0), (-255, -95, 140, 110, 0), (160, -125, 110, 70, 0), (-520, -60, 160, 140, 0)]
COMPOUNDS = [(246, 190, 38, 30, 33), (372, 238, 46, 40, 33), (420, 300, 30, 30, 33), (484, 82, 52, 44, 0),
             (510, 140, 34, 30, 0), (690, 143, 150, 100, 0), (715, -18, 36, 30, 0), (600, -150, 60, 50, 0),
             (-560, 230, 60, 50, 33), (330, -180, 44, 40, 0)]
HOUSING = [(812, z, 14, 42, 0) for z in range(-135, 330, 58)] + [(862, z, 14, 42, 0) for z in range(-110, 300, 58)]


# ───────── helpers ─────────
def catmull(points, step):
    """Smooth path through `points`, sampled about every `step` metres."""
    P = [np.array(p, float) for p in points]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1:i + 3]
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return np.array(out)


def bezier(p, step):
    p = [np.array(v, float) for v in p]
    L = sum(np.linalg.norm(b - a) for a, b in zip(p, p[1:]))
    t = np.linspace(0, 1, max(4, int(L / step)))[:, None]
    return (1 - t) ** 3 * p[0] + 3 * (1 - t) ** 2 * t * p[1] + 3 * (1 - t) * t ** 2 * p[2] + t ** 3 * p[3]


def resample(poly, step):
    """Straight polyline, sampled every `step` metres (corners kept)."""
    out = [np.array(poly[0], float)]
    for a, b in zip(poly, poly[1:]):
        a, b = np.array(a, float), np.array(b, float)
        n = max(1, int(np.linalg.norm(b - a) / step))
        out += [a + (b - a) * k / n for k in range(1, n + 1)]
    return np.array(out)


def offset(path, d):
    """Offset a path sideways by d (positive = to the right of travel, seen from above with z pointing down)."""
    t = np.gradient(path, axis=0)
    t /= np.linalg.norm(t, axis=1)[:, None]
    nrm = np.stack([-t[:, 1], t[:, 0]], 1)
    return path + nrm * d


def in_rect(x, z, rect, pad=0.0):
    cx, cz, w, d, a = rect
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    u = (x - cx) * c + (z - cz) * s
    v = -(x - cx) * s + (z - cz) * c
    return (np.abs(u) < w / 2 + pad) & (np.abs(v) < d / 2 + pad), u, v


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def waves(x, z, scale, n, seed, amp=1.0):
    """Smooth isotropic noise from a few random sine waves (about -1..1)."""
    r = np.random.default_rng(seed)
    out = np.zeros_like(x)
    for _ in range(n):
        a = r.uniform(0, math.tau)
        k = math.tau / (scale * r.uniform(0.7, 1.4))
        out += np.sin((x * math.cos(a) + z * math.sin(a)) * k + r.uniform(0, math.tau))
    return out * amp / math.sqrt(n / 2)


# ───────── road network ─────────
class Road:
    def __init__(self, name, path, width, lanes, bridge=None, kind="road"):
        self.name, self.path, self.width, self.lanes, self.bridge, self.kind = name, np.asarray(path, float), width, lanes, bridge, kind

    def height(self, z):
        if not self.bridge:
            return np.zeros_like(z)
        zc, h = self.bridge
        d = np.abs(z - zc)
        return h * (1 - smoothstep(16, 110, d))


def road_network():
    roads = []
    hw = catmull(HIGHWAY, 6)
    for side, nm in ((-8.0, "highway_north"), (8.0, "highway_south")):
        roads.append(Road(nm, offset(hw, side), 11.0, 3))
    roads.append(Road("highway_median", hw, 0.6, 0, kind="barrier"))
    for name, pts, w, lanes, bridge in ROADS:
        if pts == "bezier":
            path = bezier(COLLECTOR_EAST, 4)
        elif len(pts) > 2:
            path = catmull(pts, 4) if name != "junction_road" else resample(pts, 3)
        else:
            path = resample(pts, 4 if bridge else 12)
        if w > 12:  # dual roads: two carriageways either side of a 3 m median
            for side in (-1, 1):
                roads.append(Road(f"{name}_{'ab'[side > 0]}", offset(path, side * (w / 4 + 0.75)), w / 2 - 1.5, lanes // 2, bridge))
        else:
            roads.append(Road(name, path, w, lanes, bridge))
    (cx, cz), rx, rz = LOOP_RAMP
    a = np.linspace(0, math.tau, 140)
    roads.append(Road("loop_ramp", np.stack([cx + rx * np.cos(a), cz + rz * np.sin(a)], 1), 6.5, 1))
    (cx, cz), r = ROUNDABOUT
    roads.append(Road("roundabout", np.stack([cx + r * np.cos(a), cz + r * np.sin(a)], 1), 9.0, 2))
    return roads


# ───────── mask raster: where the ground must stay flat (site, roads, farms, compounds) ─────────
class Mask:
    def __init__(self, half, cell):
        self.cell, self.half = cell, half
        n = int(2 * half / cell)
        self.x0, self.z0 = CENTRE[0] - half, CENTRE[1] - half
        self.flat = np.ones((n, n), np.float32)   # 1 = free terrain, 0 = flattened
        self.road = np.full((n, n), 1e4, np.float32)  # distance to the nearest road edge

    def block(self, x0, z0, x1, z1):
        n = self.flat.shape[0]
        i0, i1 = max(0, int((z0 - self.z0) / self.cell)), min(n, int((z1 - self.z0) / self.cell) + 1)
        j0, j1 = max(0, int((x0 - self.x0) / self.cell)), min(n, int((x1 - self.x0) / self.cell) + 1)
        if i0 >= i1 or j0 >= j1:
            return None
        zz = self.z0 + (np.arange(i0, i1) + 0.5) * self.cell
        xx = self.x0 + (np.arange(j0, j1) + 0.5) * self.cell
        X, Z = np.meshgrid(xx, zz)
        return (slice(i0, i1), slice(j0, j1)), X, Z

    def add_road(self, road, falloff=45.0):
        p = road.path
        hw = road.width / 2
        for a, b in zip(p, p[1:]):
            r = hw + falloff
            blk = self.block(min(a[0], b[0]) - r, min(a[1], b[1]) - r, max(a[0], b[0]) + r, max(a[1], b[1]) + r)
            if blk is None:
                continue
            sl, X, Z = blk
            ab = b - a
            t = np.clip(((X - a[0]) * ab[0] + (Z - a[1]) * ab[1]) / max(ab @ ab, 1e-9), 0, 1)
            d = np.hypot(X - a[0] - t * ab[0], Z - a[1] - t * ab[1]) - hw
            self.road[sl] = np.minimum(self.road[sl], d)
            self.flat[sl] = np.minimum(self.flat[sl], smoothstep(4, falloff, d))

    def add_rect(self, rect, falloff):
        cx, cz, w, d, ang = rect
        r = math.hypot(w, d) / 2 + falloff
        blk = self.block(cx - r, cz - r, cx + r, cz + r)
        if blk is None:
            return
        sl, X, Z = blk
        _, u, v = in_rect(X, Z, rect)
        dist = np.maximum(np.abs(u) - w / 2, np.abs(v) - d / 2)
        self.flat[sl] = np.minimum(self.flat[sl], smoothstep(0, falloff, dist))

    def sample(self, x, z, what="flat"):
        a = getattr(self, what)
        n = a.shape[0]
        i = np.clip(((z - self.z0) / self.cell).astype(int), 0, n - 1)
        j = np.clip(((x - self.x0) / self.cell).astype(int), 0, n - 1)
        out = a[i, j]
        outside = (np.abs(x - CENTRE[0]) > self.half) | (np.abs(z - CENTRE[1]) > self.half)
        return np.where(outside, 1.0 if what == "flat" else 1e4, out)


def site_rect():
    x0, z0, x1, z1 = SITE_BOX
    return ((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0)


def build_mask(roads):
    near = Mask(3000, 3.0)
    far = Mask(EXTENT, 16.0)
    for m in (near, far):
        for rd in roads:
            m.add_road(rd, 45 if m is near else 60)
        m.add_rect(site_rect(), 40)
        for r in FARMS:
            m.add_rect(r, 30)
        for r in COMPOUNDS + HOUSING:
            m.add_rect(r, 25)
    return near, far


def sample_mask(near, far, x, z, what="flat"):
    inner = (np.abs(x - CENTRE[0]) < near.half - 10) & (np.abs(z - CENTRE[1]) < near.half - 10)
    return np.where(inner, near.sample(x, z, what), far.sample(x, z, what))


# ───────── terrain ─────────
def raw_height(x, z):
    r = np.hypot(x - CENTRE[0], z - CENTRE[1])
    plain = waves(x, z, 260, 10, 1, 0.9) + waves(x, z, 70, 10, 2, 0.25)
    mounds = np.maximum(0, waves(x, z, 180, 12, 3)) ** 2 * 1.8 * smoothstep(250, 600, r)
    ridges = (0.5 + 0.5 * np.sin((x * 0.6 + z * 0.8) / 95 + waves(x, z, 400, 8, 4, 1.6))) ** 2.5
    dunes = (ridges * 9 + np.maximum(0, waves(x, z, 700, 10, 5)) * 6) * smoothstep(1200, 3200, r)
    return plain + mounds + dunes


def ground_colour(x, z, road_d):
    """Linear RGB per point: graded plot round the site, gravel plain with sand patches, farms, far dunes."""
    r = np.hypot(x - CENTRE[0], z - CENTRE[1])
    col = np.tile(srgb(GRAVEL), (len(x), 1))
    patch = smoothstep(0.35, 0.75, waves(x, z, 160, 12, 11) + 0.5 * waves(x, z, 45, 8, 12))
    col = col * (1 - patch[:, None]) + srgb(PATCH) * patch[:, None]
    for f in FARMS:
        _, u, v = in_rect(x, z, f)
        k = 1 - smoothstep(-6, 10, np.maximum(np.abs(u) - f[2] / 2, np.abs(v) - f[3] / 2))
        col = col * (1 - k[:, None]) + srgb(FARM) * k[:, None]
    x0, z0, x1, z1 = SITE_BOX  # the graded plot: plan sand, reaching a little past the sheet
    dist = np.maximum.reduce([x0 - 30 - x, x - x1 - 110, z0 - 25 - z, z - z1 - 20])
    k = 1 - smoothstep(-10, 45, dist + 12 * waves(x, z, 60, 6, 13))
    col = col * (1 - k[:, None]) + srgb(SAND) * k[:, None]
    dusty = (1 - smoothstep(0, 9, road_d)) * 0.55  # dust along the road edges
    col = col * (1 - dusty[:, None]) + srgb(PATCH) * dusty[:, None]
    far = smoothstep(1300, 3200, r)
    return col * (1 - far[:, None]) + srgb(DUNE) * far[:, None]


def build_terrain(near, far, mat, coll, sheet):
    """The ground round the site: one mesh out to EXTENT, with a hole where the site ground (the plan sheet) is."""
    n = 520
    a = 4.4
    u = np.linspace(-1, 1, n)
    g = EXTENT * np.sinh(a * u) / math.sinh(a)   # about 3.3 m between rows near the site, 150 m at the edge
    xs, zs = CENTRE[0] + g, CENTRE[1] + g
    gx0, gz0, gx1, gz1 = sheet
    for arr, lo, hi in ((xs, gx0, gx1), (zs, gz0, gz1)):  # grid lines exactly on the sheet's edges
        arr[np.argmin(np.abs(arr - lo))] = lo
        arr[np.argmin(np.abs(arr - hi))] = hi
    X, Z = np.meshgrid(xs, zs)
    x, z = X.ravel(), Z.ravel()
    h = raw_height(x, z) * sample_mask(near, far, x, z)
    road_d = sample_mask(near, far, x, z, "road")
    col = ground_colour(x, z, road_d)
    me = bpy.data.meshes.new("terrain")
    verts = np.stack([x, -z, h], 1)
    idx = np.arange(n * n).reshape(n, n)
    quads = np.stack([idx[:-1, :-1], idx[1:, :-1], idx[1:, 1:], idx[:-1, 1:]], -1).reshape(-1, 4)
    qx, qz = x[quads], z[quads]
    hole = (qx.min(1) >= gx0 - 1e-6) & (qx.max(1) <= gx1 + 1e-6) & (qz.min(1) >= gz0 - 1e-6) & (qz.max(1) <= gz1 + 1e-6)
    quads = quads[~hole]
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    me.loops.add(quads.size)
    me.loops.foreach_set("vertex_index", quads.astype(np.int32).ravel())
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", (np.arange(len(quads)) * 4).astype(np.int32))
    me.polygons.foreach_set("loop_total", np.full(len(quads), 4, np.int32))
    me.update()
    me.validate()
    ca = me.color_attributes.new("ground", "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", np.concatenate([col, np.ones((len(col), 1))], 1).astype(np.float32).ravel())
    me.polygons.foreach_set("use_smooth", np.ones(len(quads), bool))
    me.materials.append(mat)
    ob = bpy.data.objects.new("terrain", me)
    coll.objects.link(ob)
    return ob


# ───────── road meshes ─────────
def ribbon_mesh(name, roads, mat, coll, lift=0.04):
    """All roads in one mesh: a strip per road, UV u = metres along, v = metres across, plus the road width
    and lane count as attributes for the markings shader. Bridge decks get a 1.2 m edge face."""
    V, F, UV, W, L = [], [], [], [], []
    for rd in roads:
        p = rd.path
        t = np.gradient(p, axis=0)
        t /= np.linalg.norm(t, axis=1)[:, None]
        nrm = np.stack([-t[:, 1], t[:, 0]], 1)
        s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))])
        y = rd.height(p[:, 1]) + lift
        hw = rd.width / 2
        o = len(V)
        for k in range(len(p)):
            for side in (-1, 1):
                q = p[k] + nrm[k] * side * hw
                V.append(B(q[0], q[1], y[k]))
                UV.append((s[k], (side + 1) / 2 * rd.width))
                W.append(rd.width)
                L.append(rd.lanes)
        for k in range(len(p) - 1):
            a = o + 2 * k
            F.append((a, a + 2, a + 3, a + 1))
        if rd.bridge:  # deck edges and the embankment walls down to the ground
            for side in (0, 1):
                o2 = len(V)
                for k in range(len(p)):
                    top = Vector(V[o + 2 * k + side])
                    V.append(tuple(top))
                    V.append((top.x, top.y, max(0.0, top.z - 1.2) if top.z > 5 else -0.2))
                    UV += [(0, 0), (0, 0)]
                    W += [0, 0]
                    L += [0, 0]
                for k in range(len(p) - 1):
                    a = o2 + 2 * k
                    F.append((a, a + 1, a + 3, a + 2) if side else (a, a + 2, a + 3, a + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, [], F)
    uv = me.uv_layers.new(name="UVMap")
    loops = np.array([l.vertex_index for l in me.loops])
    uv.data.foreach_set("uv", np.array(UV, np.float32)[loops].ravel())
    for nm, vals in (("road_w", W), ("lanes", L)):
        at = me.attributes.new(nm, "FLOAT", "POINT")
        at.data.foreach_set("value", np.array(vals, np.float32))
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def bridge_piers(roads, mat, coll):
    me = bpy.data.meshes.new("bridge_piers")
    bm = bmesh.new()
    for rd in roads:
        if not rd.bridge:
            continue
        zc, h = rd.bridge
        for dz in (-14, 0, 14):
            k = np.argmin(np.abs(rd.path[:, 1] - (zc + dz)))
            x, z = rd.path[k]
            r = bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.scale(bm, vec=(1.4, 1.4, h - 1.2), verts=r["verts"])
            bmesh.ops.translate(bm, vec=Vector(B(x, z, (h - 1.2) / 2)), verts=r["verts"])
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    coll.objects.link(bpy.data.objects.new("bridge_piers", me))


def boxes(name, items, mat, coll):
    """items: (centre x, centre z, width, depth, angle, base, height)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for cx, cz, w, d, ang, y0, hgt in items:
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w, d, hgt), verts=r["verts"])
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.radians(ang), 3, "Z"), verts=r["verts"])
        bmesh.ops.translate(bm, vec=Vector(B(cx, cz, y0 + hgt / 2)), verts=r["verts"])
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def walls_of(rect, height=2.4, t=0.3, gate=6.0):
    cx, cz, w, d, ang = rect
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    out = []
    for u, v, L, along in ((0, -d / 2, w, True), (0, d / 2, w, True), (-w / 2, 0, d, False), (w / 2, 0, d, False)):
        if v > 0 and along:  # a gate in the south wall
            for sgn in (-1, 1):
                seg = (L - gate) / 2
                uu = sgn * (gate / 2 + seg / 2)
                out.append((cx + uu * c - v * s, cz + uu * s + v * c, seg, t, ang, 0, height))
            continue
        out.append((cx + u * c - v * s, cz + u * s + v * c, L if along else t, t if along else L, ang, 0, height))
    return out


# ───────── vegetation (instanced with geometry nodes) ─────────
def bumpy_blob(bm, centre, radius, squash=0.6, detail=2, amount=0.25, seed=0):
    r = np.random.default_rng(seed)
    res = bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=radius)
    for v in res["verts"]:
        k = 1 + (r.random() - 0.5) * amount * 2
        v.co = Vector((v.co.x * k, v.co.y * k, v.co.z * k * squash)) + Vector(centre)
    return res["verts"]


def make_proto(name, build, mats, coll):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    groups = build(bm)  # list of (faces, material index)
    for faces, mi in groups:
        for f in faces:
            f.material_index = mi
            f.smooth = True
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def faces_of(bm, make):
    """Faces added to bm by make()."""
    before = set(bm.faces)
    make()
    return [f for f in bm.faces if f not in before]


def trunk(bm, base, top, r0, r1, sides=6):
    d = Vector(top) - Vector(base)
    res = bmesh.ops.create_cone(bm, cap_ends=False, segments=sides, radius1=r0, radius2=r1, depth=d.length)
    rot = d.to_track_quat("Z", "Y").to_matrix()
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=rot, verts=res["verts"])
    bmesh.ops.translate(bm, vec=(Vector(base) + Vector(top)) / 2, verts=res["verts"])
    return res["verts"]


def acacia(seed, height, spread):
    def build(bm):
        r = np.random.default_rng(seed)
        bark, leaf = [], []
        fork = Vector((0, 0, height * 0.45))
        bark += faces_of(bm, lambda: trunk(bm, (0, 0, 0), fork, 0.16, 0.11))
        for k in range(3):
            a = k * math.tau / 3 + r.uniform(-0.4, 0.4)
            tip = Vector((math.cos(a) * spread * 0.35, math.sin(a) * spread * 0.35, height * 0.82))
            bark += faces_of(bm, lambda: trunk(bm, fork, tip, 0.1, 0.05, 5))
            for j in range(2):
                c = tip + Vector((r.uniform(-1, 1) * spread * 0.18, r.uniform(-1, 1) * spread * 0.18, r.uniform(0, 0.35)))
                rr = spread * r.uniform(0.28, 0.36)
                leaf += faces_of(bm, lambda: bumpy_blob(bm, c, rr, 0.42, 2, 0.3, seed * 10 + k * 3 + j))
        return [(bark, 0), (leaf, 1)]
    return build


def ghaf(seed, height, spread):
    def build(bm):
        r = np.random.default_rng(seed)
        bark = faces_of(bm, lambda: trunk(bm, (0, 0, 0), (0, 0, height * 0.4), 0.2, 0.13))
        leaf = []
        for j in range(5):
            c = (r.uniform(-1, 1) * spread * 0.25, r.uniform(-1, 1) * spread * 0.25, height * r.uniform(0.55, 0.75))
            rr = spread * r.uniform(0.3, 0.42)
            leaf += faces_of(bm, lambda: bumpy_blob(bm, c, rr, 0.75, 2, 0.25, seed * 7 + j))
        return [(bark, 0), (leaf, 1)]
    return build


def shrub(seed, size):
    def build(bm):
        r = np.random.default_rng(seed)
        leaf = []
        for j in range(3):
            c = (r.uniform(-0.3, 0.3) * size, r.uniform(-0.3, 0.3) * size, size * 0.3)
            rr = size * r.uniform(0.4, 0.55)
            leaf += faces_of(bm, lambda: bumpy_blob(bm, c, rr, 0.6, 1, 0.3, seed * 5 + j))
        return [(leaf, 0)]
    return build


def palm(seed, height):
    def build(bm):
        r = np.random.default_rng(seed)
        lean = Vector((r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), 0))
        top = Vector((0, 0, height)) + lean
        bark = faces_of(bm, lambda: trunk(bm, (0, 0, 0), top, 0.3, 0.22, 8))
        fronds = []
        n = 18
        for k in range(n):
            a = k * math.tau / n + r.uniform(-0.15, 0.15)
            droop = r.uniform(0.15, 1.0)
            L = r.uniform(3.2, 4.2)
            rows = []
            for i in range(7):
                t = i / 6
                along = Vector((math.cos(a), math.sin(a), 0)) * L * t
                up = Vector((0, 0, L * (0.55 * t - droop * t * t)))
                side = Vector((-math.sin(a), math.cos(a), 0)) * (0.45 * math.sin(math.pi * min(1, t * 1.15)) + 0.05)
                c = top + along + up
                rows.append((bm.verts.new(c - side), bm.verts.new(c + side)))
            for i in range(6):
                fronds.append(bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1])))
        return [(bark, 0), (fronds, 1)]
    return build


def scatter_object(name, pts, rot, scale, variant, coll, proto_coll):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(pts))
    me.vertices.foreach_set("co", np.asarray(pts, np.float32).ravel())
    for nm, vals, typ in (("rot", rot, "FLOAT"), ("scale", scale, "FLOAT"), ("variant", variant, "INT")):
        at = me.attributes.new(nm, typ, "POINT")
        at.data.foreach_set("value", np.asarray(vals, np.int32 if typ == "INT" else np.float32))
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ng = bpy.data.node_groups.new(name + "_scatter", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = ng.nodes
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")
    iop = N.new("GeometryNodeInstanceOnPoints")
    ci = N.new("GeometryNodeCollectionInfo")
    ci.transform_space = "ORIGINAL"
    ci.inputs["Collection"].default_value = proto_coll
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    na = {}
    for nm, typ in (("rot", "FLOAT"), ("scale", "FLOAT"), ("variant", "INT")):
        na[nm] = N.new("GeometryNodeInputNamedAttribute")
        na[nm].data_type = typ
        na[nm].inputs["Name"].default_value = nm
    comb = N.new("ShaderNodeCombineXYZ")
    L = ng.links.new
    L(gi.outputs[0], iop.inputs["Points"])
    L(ci.outputs[0], iop.inputs["Instance"])
    iop.inputs["Pick Instance"].default_value = True
    L(na["variant"].outputs["Attribute"], iop.inputs["Instance Index"])
    L(na["rot"].outputs["Attribute"], comb.inputs["Z"])
    L(comb.outputs[0], iop.inputs["Rotation"])
    L(na["scale"].outputs["Attribute"], iop.inputs["Scale"])
    L(iop.outputs[0], go.inputs[0])
    mod = ob.modifiers.new("scatter", "NODES")
    mod.node_group = ng
    return ob


# ───────── materials ─────────
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")


def nd(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k.startswith("_"):
            setattr(n, k[1:], v)
        else:
            n.inputs[k.replace("_", " ")].default_value = v
    return n


def math_node(nt, op, a, b=None):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def madd(nt, a, mul, add):
    """a * mul + add"""
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = "MULTIPLY_ADD"
    nt.links.new(a, n.inputs[0])
    n.inputs[1].default_value = mul
    n.inputs[2].default_value = add
    return n.outputs[0]


def mix_rgb(nt, fac, a, b, blend="MIX"):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = blend
    for sock, v in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[2]


def terrain_material(site_img_path, gi):
    m, nt, out = new_mat("desert_ground")
    L = nt.links.new
    bsdf = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=0.96)
    tc = nd(nt, "ShaderNodeTexCoord")
    attr = nd(nt, "ShaderNodeAttribute", _attribute_name="ground")
    # fine variation: gravel speckle and soft mottling
    vor = nd(nt, "ShaderNodeTexVoronoi", Scale=5.0)
    L(tc.outputs["Object"], vor.inputs["Vector"])
    mot = nd(nt, "ShaderNodeTexNoise", Scale=0.05, Detail=4.0)
    L(tc.outputs["Object"], mot.inputs["Vector"])
    speck = madd(nt, vor.outputs["Distance"], 0.35, 0.8)
    mott = madd(nt, mot.outputs["Fac"], 0.5, 0.75)
    var = math_node(nt, "MULTIPLY", speck, mott)
    vc = nt.nodes.new("ShaderNodeCombineColor")
    L(var, vc.inputs[0]); L(var, vc.inputs[1]); L(var, vc.inputs[2])
    # the plan's ground surfaces, at true scale over the sheet, faded at its edges
    (gx0, gz0), (gx1, gz1) = gi["min"], gi["max"]
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    L(tc.outputs["Object"], sep.inputs[0])
    u = madd(nt, sep.outputs["X"], 1 / (gx1 - gx0), -gx0 / (gx1 - gx0))
    v = madd(nt, sep.outputs["Y"], 1 / (gz1 - gz0), gz1 / (gz1 - gz0))
    uvc = nt.nodes.new("ShaderNodeCombineXYZ")
    L(u, uvc.inputs[0]); L(v, uvc.inputs[1])
    img = nd(nt, "ShaderNodeTexImage", _interpolation="Cubic", _extension="CLIP")
    img.image = bpy.data.images.load(site_img_path)
    img.image.alpha_mode = "STRAIGHT"
    L(uvc.outputs[0], img.inputs["Vector"])
    # the same grain over both, so the sheet's edge cannot be seen
    col = mix_rgb(nt, 1.0, mix_rgb(nt, img.outputs["Alpha"], attr.outputs["Color"], img.outputs["Color"]), vc.outputs[0], "MULTIPLY")
    L(col, bsdf.inputs["Base Color"])
    bump = nd(nt, "ShaderNodeBump", Strength=0.25, Distance=0.05)
    L(vor.outputs["Distance"], bump.inputs["Height"])
    L(bump.outputs[0], bsdf.inputs["Normal"])
    L(bsdf.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*srgb(SAND), 1)
    return m, img.image


def road_material():
    """Asphalt with white edge lines and dashed lane lines, from UV (metres) and the road_w / lanes attributes."""
    m, nt, out = new_mat("desert_road")
    L = nt.links.new
    bsdf = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=0.85)
    uvn = nd(nt, "ShaderNodeUVMap", _uv_map="UVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    L(uvn.outputs[0], sep.inputs[0])
    w = nd(nt, "ShaderNodeAttribute", _attribute_name="road_w").outputs["Fac"]
    lanes = nd(nt, "ShaderNodeAttribute", _attribute_name="lanes").outputs["Fac"]
    s, v = sep.outputs["X"], sep.outputs["Y"]
    edge = math_node(nt, "LESS_THAN", math_node(nt, "MINIMUM", math_node(nt, "SUBTRACT", v, 0.35),
                                                math_node(nt, "SUBTRACT", math_node(nt, "SUBTRACT", w, v), 0.35)), 0.15)
    lw = math_node(nt, "DIVIDE", w, math_node(nt, "MAXIMUM", lanes, 1))
    t = math_node(nt, "DIVIDE", v, lw)
    off = math_node(nt, "MULTIPLY", math_node(nt, "ABSOLUTE", math_node(nt, "SUBTRACT", t, math_node(nt, "ROUND", t))), lw)
    inner = math_node(nt, "MULTIPLY", math_node(nt, "GREATER_THAN", t, 0.5),
                      math_node(nt, "LESS_THAN", t, math_node(nt, "SUBTRACT", lanes, 0.5)))
    dash = math_node(nt, "LESS_THAN", math_node(nt, "FRACT", math_node(nt, "DIVIDE", s, 12.0)), 0.4)
    lane = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", math_node(nt, "LESS_THAN", off, 0.07), inner), dash)
    paint = math_node(nt, "MULTIPLY", math_node(nt, "MAXIMUM", edge, lane), math_node(nt, "GREATER_THAN", w, 1.0))
    tc = nd(nt, "ShaderNodeTexCoord")
    noise = nd(nt, "ShaderNodeTexNoise", Scale=0.15, Detail=6.0)
    L(tc.outputs["Object"], noise.inputs["Vector"])
    asphalt = nd(nt, "ShaderNodeValToRGB")
    asphalt.color_ramp.elements[0].color = (*srgb((56, 56, 58)), 1)
    asphalt.color_ramp.elements[1].color = (*srgb((80, 78, 76)), 1)
    L(noise.outputs["Fac"], asphalt.inputs["Fac"])
    col = mix_rgb(nt, paint, asphalt.outputs["Color"], (*srgb((222, 222, 214)), 1))
    L(col, bsdf.inputs["Base Color"])
    L(bsdf.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*srgb((66, 66, 68)), 1)
    return m


def plain_mat(name, rgb, rough=0.8, translucent=0.0):
    m, nt, out = new_mat(name)
    b = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=rough)
    b.inputs["Base Color"].default_value = (*srgb(rgb), 1)
    if translucent:
        key = "Subsurface Weight" if "Subsurface Weight" in b.inputs else "Subsurface"
        b.inputs[key].default_value = translucent
    nt.links.new(b.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*srgb(rgb), 1)
    return m


def frond_material():
    """Palm fronds: leaflets cut out of the strip by a stripe pattern across its UV."""
    m, nt, out = new_mat("palm_frond")
    L = nt.links.new
    b = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=0.7)
    b.inputs["Base Color"].default_value = (*srgb((72, 86, 48)), 1)
    tc = nd(nt, "ShaderNodeTexCoord")
    wave = nd(nt, "ShaderNodeTexWave", Scale=9.0, Distortion=1.5)
    L(tc.outputs["Object"], wave.inputs["Vector"])
    alpha = math_node(nt, "GREATER_THAN", wave.outputs["Fac"], 0.35)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    L(alpha, mix.inputs[0])
    L(tr.outputs[0], mix.inputs[1])
    L(b.outputs[0], mix.inputs[2])
    L(mix.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*srgb((72, 86, 48)), 1)
    return m


def fog_material(density, color=(0.93, 0.88, 0.80)):
    m, nt, out = new_mat("fog")
    v = nd(nt, "ShaderNodeVolumePrincipled", Density=density, Anisotropy=0.3)
    v.inputs["Color"].default_value = (*color, 1)
    nt.links.new(v.outputs[0], out.inputs["Volume"])
    return m


# ───────── sky ─────────
def sky_and_sun(scene, az_deg=240, el_deg=26, strength=0.32, sun_energy=4.6, color=(1.0, 0.92, 0.82)):
    world = bpy.data.worlds.new("desert_sky")
    scene.world = world
    world.use_nodes = True
    wn = world.node_tree
    wn.nodes.clear()
    wout = wn.nodes.new("ShaderNodeOutputWorld")
    sky = wn.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "SINGLE_SCATTERING" if V5 else "NISHITA"
    sky.sun_disc = False
    sky.air_density = 1.0
    setattr(sky, "aerosol_density" if V5 else "dust_density", 2.2)  # desert haze
    sky.ozone_density = 1.0
    sky.sun_elevation = math.radians(el_deg)
    sky.sun_rotation = math.radians(az_deg)
    bg = wn.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    wn.links.new(sky.outputs[0], bg.inputs[0])
    wn.links.new(bg.outputs[0], wout.inputs[0])
    ld = bpy.data.lights.new("sun", "SUN")
    ld.energy = sun_energy
    ld.angle = math.radians(1.2)
    ld.color = color
    sun = bpy.data.objects.new("sun", ld)
    az, el = math.radians(az_deg), math.radians(el_deg)
    d = Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))  # towards the sun, from +y (north) clockwise
    sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun)
    return world


# ───────── build ─────────
def build(scene, plan_dir, plan, tmat, fog_density=0.00042, fog_color=(0.93, 0.88, 0.80), light=None, fog_height=420):
    """The desert round the site. `tmat` is the ground material shared with the site ground (terrain_material);
    `light` = keyword arguments for sky_and_sun (sun azimuth and elevation in degrees, sky strength, sun energy,
    colour). The fog fills a layer `fog_height` metres deep: a low sun shines through less of a shallow layer."""
    root = bpy.data.collections.new("Desert")
    scene.collection.children.link(root)
    sub = {}
    for nm in ("Terrain", "Roads", "Context buildings", "Vegetation", "Fog"):
        sub[nm] = bpy.data.collections.new(nm)
        root.children.link(sub[nm])
    proto = bpy.data.collections.new("vegetation_prototypes")
    scene.collection.children.link(proto)
    bpy.context.view_layer.layer_collection.children[proto.name].exclude = True

    roads = road_network()
    near, far = build_mask(roads)
    (gx0, gz0), (gx1, gz1) = plan["ground_image"]["min"], plan["ground_image"]["max"]
    build_terrain(near, far, tmat, sub["Terrain"], (gx0, gz0, gx1, gz1))

    rmat = road_material()
    concrete = plain_mat("concrete", (178, 172, 162), 0.85)
    ribbon_mesh("roads", [r for r in roads if r.kind == "road"], rmat, sub["Roads"])
    items = []
    for r in roads:
        if r.kind != "barrier":
            continue
        for a, b in zip(r.path, r.path[1:]):
            L = float(np.linalg.norm(b - a))
            ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
            items.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + 0.05, 0.5, ang, 0.0, 0.9))
    boxes("highway_barrier", items, concrete, sub["Roads"])
    bridge_piers(roads, concrete, sub["Roads"])

    # context buildings: farm walls and farmhouses, walled compounds, housing blocks
    ctx = plain_mat("context_buildings", (200, 186, 166), 0.85)
    items = []
    for f in FARMS:
        items += walls_of(f, 2.2, 0.25, 8)
        cx, cz, w, d, ang = f
        if rng.random() < 0.7:
            items.append((cx + w * 0.3 * math.cos(math.radians(ang)), cz + w * 0.3 * math.sin(math.radians(ang)), 12, 9, ang, 0, 6.5))
    for c in COMPOUNDS:
        items += walls_of(c, 2.6)
        cx, cz, w, d, ang = c
        items.append((cx, cz - d * 0.1, min(w * 0.45, 22), min(d * 0.4, 14), ang, 0, 7.0))
    for hblock in HOUSING:
        cx, cz, w, d, ang = hblock
        items.append((cx, cz, w, d, ang, 0, 10.5))
    boxes("context_buildings", items, ctx, sub["Context buildings"])

    # vegetation prototypes
    bark = plain_mat("bark", (96, 80, 64), 0.9)
    leaf = plain_mat("acacia_leaf", (70, 78, 46), 0.75, 0.05)
    ghaf_leaf = plain_mat("ghaf_leaf", (88, 98, 58), 0.75, 0.05)
    scrub = plain_mat("scrub", (118, 114, 80), 0.9)
    palm_bark = plain_mat("palm_bark", (120, 100, 78), 0.95)
    fr = frond_material()
    tree_coll = bpy.data.collections.new("trees")
    shrub_coll = bpy.data.collections.new("shrubs")
    palm_coll = bpy.data.collections.new("palms")
    for c in (tree_coll, shrub_coll, palm_coll):
        proto.children.link(c)
    for i in range(3):
        make_proto(f"acacia_{i}", acacia(i + 1, 4.5 + i * 0.7, 6.5 + i), [bark, leaf], tree_coll)
    for i in range(2):
        make_proto(f"ghaf_{i}", ghaf(i + 11, 6.0 + i, 7.0 + i), [bark, ghaf_leaf], tree_coll)
    for i in range(3):
        make_proto(f"shrub_{i}", shrub(i + 21, 1.0 + 0.3 * i), [scrub], shrub_coll)
    for i in range(3):
        make_proto(f"palm_{i}", palm(i + 31, 7.0 + i * 1.3), [palm_bark, fr], palm_coll)

    def height_at(x, z):
        return raw_height(x, z) * sample_mask(near, far, x, z)

    def ok_ground(x, z, clear):
        keep = sample_mask(near, far, x, z, "road") > clear
        keep &= ~in_rect(x, z, site_rect(), 25)[0]
        for r in FARMS + COMPOUNDS + HOUSING:
            keep &= ~in_rect(x, z, r, 6)[0]
        return keep

    # plain: trees and shrubs, densest near the site, thinning out into the fog
    def scatter(n, rmax, density, clear):
        ang = rng.uniform(0, math.tau, n)
        rad = rmax * np.sqrt(rng.uniform(0, 1, n))
        x, z = CENTRE[0] + rad * np.cos(ang), CENTRE[1] + rad * np.sin(ang)
        keep = ok_ground(x, z, clear) & (rng.uniform(0, 1, n) < density(rad))
        return x[keep], z[keep]

    x, z = scatter(60000, 3500, lambda r: 0.9 * (1 - smoothstep(1500, 3500, r)), 6)
    pts = np.stack([x, -z, height_at(x, z) - 0.15], 1)
    scatter_object("trees", pts, rng.uniform(0, math.tau, len(x)), rng.uniform(0.6, 1.25, len(x)),
                   rng.integers(0, 5, len(x)), sub["Vegetation"], tree_coll)
    x, z = scatter(260000, 2600, lambda r: 0.95 * (1 - smoothstep(900, 2600, r)), 3)
    pts = np.stack([x, -z, height_at(x, z) - 0.1], 1)
    scatter_object("shrubs", pts, rng.uniform(0, math.tau, len(x)), rng.uniform(0.6, 1.5, len(x)),
                   rng.integers(0, 3, len(x)), sub["Vegetation"], shrub_coll)
    # palm farms: rows on a 9 m grid inside each farm
    P = []
    for cx, cz, w, d, ang in FARMS:
        c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        for u in np.arange(-w / 2 + 6, w / 2 - 5, 9.0):
            for v in np.arange(-d / 2 + 6, d / 2 - 5, 9.0):
                if rng.random() < 0.88:
                    P.append((cx + u * c - v * s + rng.normal(0, 0.4), cz + u * s + v * c + rng.normal(0, 0.4)))
    P = np.array(P)
    pts = np.stack([P[:, 0], -P[:, 1], np.zeros(len(P))], 1)
    scatter_object("palms", pts, rng.uniform(0, math.tau, len(P)), rng.uniform(0.85, 1.15, len(P)),
                   rng.integers(0, 3, len(P)), sub["Vegetation"], palm_coll)

    # fog: a homogeneous volume over everything, thin enough near the site, closing in over kilometres
    me = bpy.data.meshes.new("fog")
    S = EXTENT + 500
    bm = bmesh.new()
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(2 * S, 2 * S, fog_height), verts=r["verts"])
    bmesh.ops.translate(bm, vec=Vector(B(CENTRE[0], CENTRE[1], fog_height / 2 - 10)), verts=r["verts"])
    bm.to_mesh(me)
    bm.free()
    me.materials.append(fog_material(fog_density, fog_color))
    fog = bpy.data.objects.new("fog", me)
    sub["Fog"].objects.link(fog)

    sky_and_sun(scene, **(light or {}))
    print(f"desert: {len(roads)} roads, palms {len(P)}", flush=True)
