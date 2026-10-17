"""Retail Park: trace the massing from the site setting-out plan (A-091, sheet 02 of 02, AutoCAD PDF).

Reads the vector linework of the PDF and writes, next to this file:
    retail_park_plan.json   footprints in metres, read by massing.py
    site_plan.png           the drawing as a ground image, laid under the massing at true scale
    site_ground.png         the ground surfaces read from the drawing (asphalt, paving, pavers, sand, planting,
                            jogging track) with the road markings, for the desert environment
    site_zones.png          the same surfaces as class numbers (red = class x 30) with the drawn lines (green),
                            for the material shaders of the visualisation; the sand inside the site boundary is
                            class 7, the landscape beds
    check_overlay.webp      the traced footprints drawn over the drawing, for checking

Run with ordinary Python 3 (not Blender):  pip install pymupdf shapely pillow numpy scipy
    python src/blender/plan/trace_plan.py "path/to/A-091-SITE_SETTING_OUT_PLAN_SHEET_02_OF_02-Model.pdf"

Scale. The sheet was plotted to fit the paper (no scale bar), so the scale is measured from the drawing:
6.3306 PDF points per metre (about 1:448 on the A2 sheet). Every check agrees:
  parking bays 2.70 m pitch x 5.40 m deep, measured over runs of 8-26 bays (17.093 pt and 34.2 pt);
  CAD fillet radii 2.00, 3.00, 4.00, 5.00 and 6.00 m; doors 0.90 and 1.00 m; WC cubicle doors 0.50 m;
  internal stair treads 0.30 m, external steps 0.40 m, accessible-bay hatched zones 1.20 m.

Axes (same as the photoreal scene): x runs west -> east, z from the back of the site (rear road) towards
the main road. Origin: the north-west outer corner of the Games hall. 1 PDF point = 0.15796 m.

Building outlines are the outer wall faces, read off the black wall linework and snapped to the CAD
vertices (to the 0.12 pt grid of the PDF, about 2 cm). Kiosks, yard units and planters are picked up
from the drawing automatically.
"""
import json
import math
import os
import sys

import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from scipy import ndimage
from shapely import constrained_delaunay_triangles, make_valid, set_precision
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
PTS_PER_M = 6.3306
ORIGIN = (617.72, 582.80)  # Games hall, north-west outer corner (PDF points)
FRAME = (14.0, 149.48, 1669.28, 1163.0)  # drawing border (PDF points)


def m(p):
    """PDF point (x, y) -> plan metres (x east, z towards the main road)."""
    return [round((p[0] - ORIGIN[0]) / PTS_PER_M, 3), round((p[1] - ORIGIN[1]) / PTS_PER_M, 3)]


def meet(a, b, c, d):
    """Intersection of line a-b with line c-d."""
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = a, b, c, d
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def fillet(poly, r):
    """Round every corner of a convex polygon with radius r (same units)."""
    out = []
    n = len(poly)
    for i in range(n):
        p, a, b = poly[i], poly[i - 1], poly[(i + 1) % n]
        u = ((a[0] - p[0]), (a[1] - p[1]))
        v = ((b[0] - p[0]), (b[1] - p[1]))
        lu, lv = math.hypot(*u), math.hypot(*v)
        u, v = (u[0] / lu, u[1] / lu), (v[0] / lv, v[1] / lv)
        ang = math.acos(max(-1, min(1, u[0] * v[0] + u[1] * v[1])))
        t = r / math.tan(ang / 2)  # distance from corner to tangent points
        p0 = (p[0] + u[0] * t, p[1] + u[1] * t)
        p1 = (p[0] + v[0] * t, p[1] + v[1] * t)
        bis = (u[0] + v[0], u[1] + v[1])
        lb = math.hypot(*bis)
        c = (p[0] + bis[0] / lb * r / math.sin(ang / 2), p[1] + bis[1] / lb * r / math.sin(ang / 2))
        a0 = math.atan2(p0[1] - c[1], p0[0] - c[0])
        a1 = math.atan2(p1[1] - c[1], p1[0] - c[0])
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        for k in range(7):
            ak = a0 + da * k / 6
            out.append((c[0] + r * math.cos(ak), c[1] + r * math.sin(ak)))
    return out


# ───────── buildings: outer wall faces, PDF points ─────────
# Retail spine (F&B units facing the rear road), in three parts split by two covered through-passages.
SPINE_W = [(205.04, 504.80), (264.68, 504.80), (264.68, 516.56), (295.40, 516.56), (295.40, 513.08), (424.76, 513.08),
           (424.76, 504.80), (487.52, 504.80), (487.52, 551.00), (205.04, 551.00)]
SPINE_M = [(535.04, 504.20), (819.08, 504.20), (819.08, 513.08), (976.88, 513.08), (976.88, 551.00), (535.04, 551.00)]
SPINE_E = [(1004.96, 513.08), (1069.40, 513.08), (1069.40, 504.80), (1187.36, 504.80), (1187.48, 551.00), (1004.96, 551.00)]
# the two through-passages: walled rooms across the middle, open recesses north and south, roof over all
PASSAGES = [((487.52, 504.80, 535.04, 551.00), (523.76, 545.36)), ((976.88, 513.08, 1004.96, 551.00), (523.76, 545.36))]
# The covered mall corridor between the spine and the buildings to the south, from the west link to the east
# link (sections D-D to I-I: corridor under the lower roof at +2.60)
CORRIDOR = [(243.08, 551.00), (1181.00, 551.00), (1181.00, 582.80), (243.08, 582.80)]
# West wing: hall and angled knuckle, with its corridor (x 281-314) under the lower roof; the south-east face is
# one straight line to the knuckle corner
_ww_sw = ((234.20, 716.12), (277.52, 762.56))
_ww_se = ((278.96, 761.12), (335.48, 708.56))
_ww_ne = ((314.12, 684.68), (335.48, 707.60))
_ww_k = meet(*_ww_ne, *_ww_se)
WEST_WING = [(234.20, 582.80), (281.12, 582.80), (281.12, 684.68), (314.12, 684.68), _ww_k, meet(*_ww_sw, *_ww_se), (234.20, 716.12)]
WEST_WING_CORRIDOR = [(281.12, 582.80), (314.12, 582.80), (314.12, 684.68), (281.12, 684.68)]
# small room on the west edge of the market court
COURT_ROOM = [(314.12, 608.12), (331.28, 608.12), (331.28, 636.20), (314.12, 636.20)]
# Games hall: slanted east wall
_gh_e = ((773.12, 778.28), (843.80, 584.00))
GAMES = [(617.72, 582.80), (meet(*_gh_e, (0, 582.80), (1, 582.80))), (773.12, 778.28), (617.72, 778.28)]
# Pavilion: slanted west face, 0.5 m fillets on all four corners
_pv_w = ((1109.12, 598.88), (1041.80, 806.84))
_pv = [meet(*_pv_w, (0, 596.72), (1, 596.72)), (1193.72, 596.72), (1193.72, 810.92), meet(*_pv_w, (0, 810.92), (1, 810.92))]
PAVILION = fillet(_pv, 0.5 * PTS_PER_M)
# south promenade: west pavilion and the two WC blocks (outer faces of the drawn rectangles)
WEST_PAVILION = [(181.88, 795.80), (252.32, 795.80), (252.32, 880.16), (181.88, 880.16)]
WC_WEST = [(271.28, 795.92), (309.92, 795.92), (309.92, 842.24), (271.28, 842.24)]
WC_EAST = [(1181.84, 847.40), (1220.48, 847.40), (1220.48, 893.84), (1181.84, 893.84)]

# ───────── ground levels (elevations and sections A-200 to A-306) ─────────
# Datum 0.00 = gate level (rear road). The buildings stand on the lower ground, FFL -1.95; the promenade and the
# food trucks are at +0.30 / +0.45 (here the outside ground is kept at 0.00). Sunk to the lower ground: the market
# court, the tree plaza with its terraces stepping up to the promenade, and the ramp down beside the pavilion.
LOWER_GROUND, UPPER_GROUND = -1.95, 0.30
_gh_y = lambda y: 844.24 + (y - 582.80) * (773.12 - 844.24) / (778.28 - 582.80)  # Games hall east wall
SUNKEN = [
    ("market_court", [(314.12, 582.80), (617.72, 582.80), (617.72, 778.28), (565.0, 778.28), (565.0, 730.76),
                      (543.0, 730.76), (543.0, 754.0), (348.7, 754.0), _ww_k, (314.12, 684.68)], None),
    ("tree_plaza", [(844.24, 582.80), (1003.0, 582.80), (1003.0, 598.0), (978.4, 700.0), (_gh_y(700.0), 700.0)], None),
    ("plaza_terraces", [(_gh_y(700.0), 700.0), (978.4, 700.0), (960.0, 800.0), (790.0, 800.0), (773.12, 778.28)], (700.0, 800.0)),
    ("ramp", [(1003.0, 582.80), (1215.0, 582.80), (1215.0, 597.0), _pv[0], _pv[3], (960.0, 800.0), (978.4, 700.0),
              (1003.0, 598.0)], (610.0, 810.0)),
]
# stairs from the lower ground up to the promenade: x range, bottom and top step edge (PDF points), risers
STAIRS = [((543.0, 565.0), (730.76, 776.36), 16), ((1194.0, 1212.0), (599.48, 644.48), 16)]


def ground_height(y, slope):
    """Height of a sunken area at PDF y: lower ground, or rising to the promenade over `slope` = (y0, y1)."""
    if not slope:
        return LOWER_GROUND
    t = min(1.0, max(0.0, (y - slope[0]) / (slope[1] - slope[0])))
    return LOWER_GROUND + (UPPER_GROUND - LOWER_GROUND) * t


def ring(pts, step):
    """Closed outline resampled every `step` PDF points (corners kept)."""
    out = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n = max(1, math.ceil(math.dist(a, b) / step))
        out += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n)]
    return out


def triangulate(poly, height):
    """Triangle mesh of a polygon with holes: {"verts": [[x, z, height], ...], "tris": [[i, j, k], ...]} in metres."""
    verts, index, tris = [], {}, []
    for t in constrained_delaunay_triangles(poly).geoms:
        tri = []
        for q in list(t.exterior.coords)[:3]:
            key = (round(q[0], 4), round(q[1], 4))
            if key not in index:
                index[key] = len(verts)
                verts.append(m(q) + [round(height(q), 3)])
            tri.append(index[key])
        tris.append(tri)
    return {"verts": verts, "tris": tris}


def sunken_ground(buildings):
    """Floors of the sunken areas (outlines and triangle meshes, with heights), the retaining walls round them and
    the base ground: the sheet with the sunken areas cut out."""
    step = 3 * PTS_PER_M
    floors, polys = [], []
    for name, pts, slope in SUNKEN:
        r = ring(pts, step)
        floors.append({"id": name, "pts": [m(p) + [round(ground_height(p[1], slope), 3)] for p in r],
                       "mesh": triangulate(Polygon(r), lambda q, sl=slope: ground_height(q[1], sl))})
        polys.append((Polygon(pts), slope))
    union = unary_union([p for p, _ in polys]).buffer(0.05).buffer(-0.05)
    covered = unary_union([Polygon(b) for b in buildings]).buffer(0.3)
    walls = []
    for geom in getattr(union, "geoms", [union]):
        for rng_ in [geom.exterior] + list(geom.interiors):
            r = ring(list(rng_.coords)[:-1], step / 3)
            for a, b in zip(r, r[1:] + r[:1]):
                mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                if covered.contains(Point(mid)):
                    continue
                h = [min((ground_height(q[1], sl) for poly, sl in polys if poly.buffer(0.2).contains(Point(q))), default=0.0)
                     for q in (a, b)]
                if max(h) < -0.05:
                    walls.append([m(a) + [round(h[0], 3)], m(b) + [round(h[1], 3)]])
    fx0, fy0, fx1, fy1 = FRAME
    base = Polygon([(fx0, fy0), (fx1, fy0), (fx1, fy1), (fx0, fy1)]).difference(union)
    holes = [[m(p) for p in ring(list(h.coords)[:-1], step)] for h in base.interiors]
    base = Polygon(base.exterior.coords, [ring(list(h.coords)[:-1], step) for h in base.interiors])
    stairs = [{"x": [m((x0, 0))[0], m((x1, 0))[0]], "z": [m((0, y0))[1], m((0, y1))[1]], "risers": n,
               "h": [LOWER_GROUND, UPPER_GROUND]} for (x0, x1), (y0, y1), n in STAIRS]
    return {"floors": floors, "walls": walls, "base_holes": holes, "base": triangulate(base, lambda q: 0.0), "stairs": stairs}

# seed points (PDF) inside each raised planter drawn in the heavy kerb line
PLANTER_SEEDS = [(192.8, 668.9), (305.5, 748.6), (288.1, 854.2), (409.1, 600.1), (449.0, 769.0), (401.4, 850.2),
                 (601.7, 626.9), (536.1, 826.6), (661.4, 829.7), (931.3, 868.9), (1103.3, 823.2), (1083.9, 874.9),
                 (1241.8, 509.0), (1358.1, 587.8)]


# ───────── ground surfaces ─────────
# The drawing splits the ground into closed regions; each region gets a surface. Seeds (PDF points) pick the
# roads, the pedestrian areas and the parking aisles; parking bays are found by size; everything else is sand.
ASPHALT, PAVING, PAVERS, SAND, PLANTING, TRACK, LANDSCAPE = 1, 2, 3, 4, 5, 6, 7  # LANDSCAPE: site_zones.png only
SURFACE_RGB = {ASPHALT: (66, 66, 68), PAVING: (198, 190, 176), PAVERS: (160, 150, 138), SAND: (206, 184, 150),
               PLANTING: (98, 106, 74), TRACK: (164, 94, 80)}
LINE_RGB = {ASPHALT: (228, 228, 222), PAVING: (150, 144, 134), PAVERS: (120, 112, 104), SAND: (170, 150, 120),
            PLANTING: (70, 76, 52), TRACK: (220, 214, 204)}  # road markings and kerb lines on each surface
SEEDS = {
    ASPHALT: [(700, 425), (700, 447), (400, 1001), (400, 1026), (600, 915), (1260, 770), (1388, 770), (1470, 770),
              (200, 300), (246, 330), (1110, 1100), (430, 965), (1150, 975)],
    PAVING: [(620, 800), (700, 567), (450, 700), (900, 640), (700, 498), (700, 502.5), (180, 520), (1220, 700),
             (228, 650), (1400, 545)],
}
PAVER_BOXES = [(113, 455, 163, 998), (1502, 455, 1552, 998), (1276, 603, 1500, 662), (1276, 912, 1342, 988)]  # hatched paving
TERRACE_BOX = (780, 660, 1100, 810)  # stepped terraces and ramps of the plaza: paving
TRACK_BOX = (380, 177, 1600, 372)    # rear landscape: narrow bands here are the jogging trail


def ground_surfaces(gray, zoom, boundary, planters):
    """Surface map of the drawing: `gray` is the rendered sheet (inside FRAME), `zoom` pixels per PDF point."""
    fx0, fy0 = FRAME[0], FRAME[1]
    px = lambda p: ((p[0] - fx0) * zoom, (p[1] - fy0) * zoom)
    px_m = zoom * PTS_PER_M
    lines = gray < 215
    bar = Image.new("1", (gray.shape[1], gray.shape[0]), 0)
    ImageDraw.Draw(bar).line([px(p) for p in boundary], fill=1, width=4)  # the dash-dot site boundary as a wall
    lines |= np.array(bar)
    lab, n = ndimage.label(~lines)
    area = np.bincount(lab.ravel(), minlength=n + 1) / px_m ** 2
    com = np.array(ndimage.center_of_mass(np.ones_like(lab), lab, range(1, n + 1)))
    cx, cy = com[:, 1] / zoom + fx0, com[:, 0] / zoom + fy0
    inside = lambda box: (cx > box[0]) & (cx < box[2]) & (cy > box[1]) & (cy < box[3])
    cls = np.zeros(n + 1, np.uint8)
    for k, pts in SEEDS.items():
        for p in pts:
            c, r = px(p)
            cls[lab[int(round(r)), int(round(c))]] = k
    cls[0] = 0
    for i, sl in enumerate(ndimage.find_objects(lab)):  # parking bays: closed cells of bay size and shape
        h, w = (sl[0].stop - sl[0].start) / px_m, (sl[1].stop - sl[1].start) / px_m
        lo, hi = sorted((w, h))
        if not cls[i + 1] and 10.5 < area[i + 1] < 16.5 and 1.6 < hi / max(lo, 1e-3) < 2.4 and area[i + 1] / (w * h) > 0.75:
            cls[i + 1] = ASPHALT
    free = np.r_[False, cls[1:] == 0]
    for box in PAVER_BOXES:
        cls[free & np.r_[False, inside(box) & (area[1:] < 60)]] = PAVERS
    pm = Image.new("L", bar.size, 0)
    for pl in planters:
        ImageDraw.Draw(pm).polygon([px((x * PTS_PER_M + ORIGIN[0], z * PTS_PER_M + ORIGIN[1])) for x, z in pl], fill=1)
    share = np.r_[0, ndimage.mean(np.array(pm), lab, range(1, n + 1))]
    cls[(cls == 0) & (share > 0.6)] = PLANTING
    half_width = np.r_[0, ndimage.maximum(ndimage.distance_transform_edt(~lines), lab, range(1, n + 1))] / px_m
    cls[(cls == 0) & np.r_[False, inside(TRACK_BOX)] & (area > 20) & (half_width < 2.3)] = TRACK
    cls[(cls == 0) & np.r_[False, inside(TERRACE_BOX)] & (area < 400)] = PAVING
    small = (cls == 0) & (area < 4)  # text, arrows and hatch slivers take the surface around them
    cls[(cls == 0) & ~small] = SAND
    cls[0] = 0
    surf = cls[lab]
    surf[lines] = 0
    idx = ndimage.distance_transform_edt(surf == 0, return_distances=False, return_indices=True)
    surf = surf[idx[0], idx[1]]
    rgb = np.zeros(surf.shape + (3,), np.uint8)
    drawn = lines & (gray < 200)
    for k in SURFACE_RGB:
        rgb[surf == k] = SURFACE_RGB[k]
        rgb[(surf == k) & drawn] = LINE_RGB[k]
    # fade out over the last 12 m of the sheet, where the surroundings take over
    yy, xx = np.mgrid[0:surf.shape[0], 0:surf.shape[1]]
    edge = np.minimum(np.minimum(xx, surf.shape[1] - 1 - xx), np.minimum(yy, surf.shape[0] - 1 - yy)) / px_m
    alpha = (np.clip(edge / 12.0, 0, 1) * 255).astype(np.uint8)
    # zones: the sand inside the site boundary is the landscape beds
    site = Image.new("1", bar.size, 0)
    ImageDraw.Draw(site).polygon([px(p) for p in boundary], fill=1)
    surf[(surf == SAND) & np.array(site)] = LANDSCAPE
    zones = np.dstack([surf.astype(np.uint8) * 30, drawn.astype(np.uint8) * 255, np.zeros_like(alpha)])
    return np.dstack([rgb, alpha]), zones


def landscape_points(zones, zoom, boundary, keep_out):
    """Planting for the soft landscape: the sand areas inside the site boundary, clear of the buildings, the sunken
    ground, the kiosks and the planters (`keep_out`, a shapely geometry in metres). Trees on a jittered 6.5 m grid,
    shrubs and grasses on a 1.2 m grid in drifts (a smooth random field), both kept back from the paved edges."""
    fx0, fy0 = FRAME[0], FRAME[1]
    k = 4  # work at a quarter of the image resolution (about 13 cm a pixel)
    sand = zones[::k, ::k, 0] == LANDSCAPE * 30
    px_m = zoom * PTS_PER_M / k
    clear = ndimage.distance_transform_edt(sand) / px_m  # metres to the nearest other surface
    site = Polygon([m(p) for p in boundary]).buffer(0)
    rng = np.random.default_rng(20261017)
    drift = ndimage.gaussian_filter(rng.random((sand.shape[0] // 40 + 2, sand.shape[1] // 40 + 2)), 1.2)
    drift = (drift - drift.mean()) / drift.std()

    def sample(x, z):
        c = ((x * PTS_PER_M + ORIGIN[0] - fx0) * zoom) / k
        r = ((z * PTS_PER_M + ORIGIN[1] - fy0) * zoom) / k
        if not (0 <= r < sand.shape[0] and 0 <= c < sand.shape[1]):
            return 0.0, 0.0
        return clear[int(r), int(c)], drift[int(r) // 40, int(c) // 40]

    x0, z0, x1, z1 = site.bounds
    trees, shrubs = [], []
    for spacing, out, margin, keep in ((6.5, trees, 2.2, 0.15), (1.2, shrubs, 0.6, -0.6)):
        for x in np.arange(x0, x1, spacing):
            for z in np.arange(z0, z1, spacing):
                x_, z_ = x + rng.uniform(-0.4, 0.4) * spacing, z + rng.uniform(-0.4, 0.4) * spacing
                d, f = sample(x_, z_)
                if d < margin or f + rng.normal(0, 0.5) < keep:
                    continue
                p = Point(x_, z_)
                if site.contains(p) and not keep_out.contains(p):
                    out.append([round(x_, 2), round(z_, 2)])
    return {"trees": trees, "shrubs": shrubs}


def bez(v, t):
    x0, y0, x1, y1, x2, y2, x3, y3 = v
    s = 1 - t
    return (s ** 3 * x0 + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t ** 3 * x3,
            s ** 3 * y0 + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t ** 3 * y3)


def main(pdf_path):
    doc = pymupdf.open(pdf_path)
    page = doc[0]
    drawings = page.get_drawings()

    # kiosks (food containers, 2.45 x 6.08 m), yard units (5.1 x 7.7 m, one is the LPG store) and tree pits
    # (grey squares of 1.3 and 1.6 m)
    kiosks, yard, trees = [], [], []
    seen = set()
    for d in drawings:
        col = d.get("color") or (0, 0, 0)
        for it in d["items"]:
            if it[0] != "qu":
                continue
            q = it[1]
            pts = [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            w, h = (max(xs) - min(xs)) / PTS_PER_M, (max(ys) - min(ys)) / PTS_PER_M
            key = (round(min(xs)), round(min(ys)))
            if key in seen:
                continue
            short, long_ = sorted((w, h))
            if abs(col[0] - 0.5) < 0.03 and 1.2 < w < 2.6 and 1.2 < h < 2.6:
                c = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
                if all(math.dist(c, t) > 2 for t in trees):
                    trees.append(c)
                continue
            if abs(col[0] - 0.47) < 0.02 and abs(short - 2.45) < 0.03 and abs(long_ - 6.075) < 0.03:
                seen.add(key)
                kiosks.append(pts)
            elif 5.0 < w < 5.3 and 7.6 < h < 7.8 and min(ys) < 320 and \
                    all(abs(min(xs) - min(p[0] for p in u["pts"])) > 5 for u in yard):  # the LPG store is drawn four times, nested
                seen.add(key)
                yard.append({"pts": pts, "lpg": col[0] > 0.9 and col[1] < 0.1})

    # planters: union of the heavy (0.6-0.84 pt) black kerb lines, outer outline of each closed shape
    lines = []
    for d in drawings:
        col = d.get("color") or (0, 0, 0)
        w = d.get("width") or 0
        if max(col) > 0.05 or not 0.5 <= w < 1.6:
            continue
        for it in d["items"]:
            if it[0] == "l":
                pts = [(it[1].x, it[1].y), (it[2].x, it[2].y)]
            elif it[0] == "c":
                v = (it[1].x, it[1].y, it[2].x, it[2].y, it[3].x, it[3].y, it[4].x, it[4].y)
                pts = [bez(v, i / 12) for i in range(13)]
            else:
                continue
            if LineString(pts).length > 0:
                lines.append(LineString(pts))
    merged = unary_union([ln.buffer(0.5, cap_style=1) for ln in lines])
    shapes = [Polygon(g.exterior).buffer(0) for g in getattr(merged, "geoms", [merged])]
    buildings = [Polygon(p) for p in (SPINE_W, SPINE_M, SPINE_E, CORRIDOR, WEST_WING, WEST_WING_CORRIDOR, GAMES, PAVILION, WC_WEST, WC_EAST)]
    planters = []
    for s in PLANTER_SEEDS:
        hit = [g for g in shapes if g.contains(Point(s))]
        if not hit:
            sys.exit(f"no planter outline found at {s}")
        g = set_precision(make_valid(max(hit, key=lambda g: g.area).buffer(-0.5)), 0.01)  # outer kerb face
        for b in buildings:
            g = g.difference(b)
        g = max(getattr(g, "geoms", [g]), key=lambda x: x.area).simplify(0.06)
        planters.append(list(g.exterior.coords)[:-1])

    out = {
        "source": "A-091 Site Setting Out Plan, sheet 02 of 02 (AutoCAD PDF)",
        "units": "metres; x west->east, z rear road->main road; origin = Games hall north-west outer corner",
        "pts_per_m": PTS_PER_M,
        "origin_pdf": ORIGIN,
        "buildings": [
            {"id": "spine_west", "kind": "spine", "pts": [m(p) for p in SPINE_W]},
            {"id": "spine_mid", "kind": "spine", "pts": [m(p) for p in SPINE_M]},
            {"id": "spine_east", "kind": "spine", "pts": [m(p) for p in SPINE_E]},
            {"id": "mall_corridor", "kind": "corridor", "pts": [m(p) for p in CORRIDOR]},
            {"id": "west_wing", "kind": "west_wing", "pts": [m(p) for p in WEST_WING]},
            {"id": "west_wing_corridor", "kind": "corridor", "pts": [m(p) for p in WEST_WING_CORRIDOR]},
            {"id": "court_room", "kind": "court_room", "pts": [m(p) for p in COURT_ROOM]},
            {"id": "games_hall", "kind": "games_hall", "pts": [m(p) for p in GAMES]},
            {"id": "pavilion", "kind": "pavilion", "pts": [m(p) for p in PAVILION]},
            {"id": "west_pavilion", "kind": "west_pavilion", "pts": [m(p) for p in WEST_PAVILION]},
            {"id": "wc_west", "kind": "wc", "pts": [m(p) for p in WC_WEST]},
            {"id": "wc_east", "kind": "wc", "pts": [m(p) for p in WC_EAST]},
        ],
        "passages": [{"box": m(b[:2]) + m(b[2:]), "room_z": [m((0, b2[0]))[1], m((0, b2[1]))[1]]} for b, b2 in PASSAGES],
        "kiosks": [[m(p) for p in k] for k in sorted(kiosks, key=lambda k: k[0][0])],
        "tree_pits": [m(t) for t in sorted(trees)],
        "yard_units": [{"pts": [m(p) for p in u["pts"]], "lpg": u["lpg"]} for u in sorted(yard, key=lambda u: u["pts"][0][0])],
        "planters": [[m(p) for p in pl] for pl in planters],
        "ground": sunken_ground([SPINE_W, SPINE_M, SPINE_E, CORRIDOR, WEST_WING, WEST_WING_CORRIDOR, COURT_ROOM, GAMES, PAVILION]),
    }

    # ground image: the whole drawing inside its border, 8192 px wide (about 3.2 cm per pixel)
    fx0, fy0, fx1, fy1 = FRAME
    zoom = 8192 / (fx1 - fx0)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=pymupdf.Rect(*FRAME), alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img.convert("L").save(os.path.join(HERE, "site_plan.png"), optimize=True)
    out["ground_image"] = {"file": "site_plan.png", "min": m((fx0, fy0)), "max": m((fx1, fy1)), "px": [pix.width, pix.height]}
    boundary = []
    for d in drawings:  # the site boundary: heavy red dash-dot line, its dashes in drawing order
        col = d.get("color") or (0, 0, 0)
        if col[0] > 0.9 and col[1] < 0.1 and abs((d.get("width") or 0) - 1.68) < 0.01:
            for it in d["items"]:
                if it[0] == "l":
                    boundary += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
    surf, zones = ground_surfaces(np.array(img.convert("L")), zoom, boundary, planters)
    Image.fromarray(surf, "RGBA").save(os.path.join(HERE, "site_ground.png"), optimize=True)
    Image.fromarray(zones, "RGB").save(os.path.join(HERE, "site_zones.png"), optimize=True)

    out["ground_surfaces"] = {"file": "site_ground.png", "fade_m": 12.0, "zones": "site_zones.png",
                              "classes": {"asphalt": ASPHALT, "paving": PAVING, "pavers": PAVERS, "sand": SAND,
                                          "planting": PLANTING, "track": TRACK, "landscape": LANDSCAPE}, "scale": 30}
    keep_out = unary_union([Polygon(b["pts"]).buffer(1.5) for b in out["buildings"]]
                           + [Polygon(f["pts"]).buffer(1.0) for f in out["ground"]["floors"]]
                           + [Polygon(k).buffer(1.2) for k in out["kiosks"]]
                           + [Polygon(u["pts"]).buffer(1.2) for u in out["yard_units"]]
                           + [Polygon(pl).buffer(0.5) for pl in out["planters"]]
                           + [Point(t).buffer(3.0) for t in out["tree_pits"]])
    out["landscape"] = landscape_points(zones, zoom, boundary, keep_out)

    with open(os.path.join(HERE, "retail_park_plan.json"), "w") as f:
        json.dump(out, f, indent=1)

    # check image: traced footprints over the drawing
    chk = img.copy()
    dr = ImageDraw.Draw(chk, "RGBA")
    to_px = lambda p: ((p[0] - fx0) * zoom, (p[1] - fy0) * zoom)
    for poly in (SPINE_W, SPINE_M, SPINE_E, CORRIDOR, WEST_WING, WEST_WING_CORRIDOR, COURT_ROOM, GAMES, PAVILION, WEST_PAVILION, WC_WEST, WC_EAST):
        dr.polygon([to_px(p) for p in poly], fill=(255, 40, 40, 70), outline=(220, 0, 0, 255), width=3)
    for k in kiosks:
        dr.polygon([to_px(p) for p in k], fill=(255, 140, 0, 110), outline=(200, 90, 0, 255), width=2)
    for u in yard:
        dr.polygon([to_px(p) for p in u["pts"]], fill=(255, 140, 0, 110), outline=(200, 90, 0, 255), width=2)
    for pl in planters:
        dr.polygon([to_px(p) for p in pl], fill=(40, 170, 60, 90), outline=(20, 120, 40, 255), width=2)
    chk = chk.resize((4096, round(chk.height * 4096 / chk.width)), Image.LANCZOS)
    chk.save(os.path.join(HERE, "check_overlay.webp"), quality=86)
    print(f"{len(out['buildings'])} buildings, {len(kiosks)} kiosks, {len(yard)} yard units, {len(planters)} planters, "
          f"{len(trees)} tree pits, {len(out['landscape']['trees'])} landscape trees, {len(out['landscape']['shrubs'])} shrubs")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
