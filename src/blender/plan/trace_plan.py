"""Retail Park: trace the massing from the site setting-out plan (A-091, sheet 02 of 02, AutoCAD PDF).

Reads the vector linework of the PDF and writes, next to this file:
    retail_park_plan.json   footprints in metres, read by massing.py
    site_plan.png           the drawing as a ground image, laid under the massing at true scale
    check_overlay.webp      the traced footprints drawn over the drawing, for checking

Run with ordinary Python 3 (not Blender):  pip install pymupdf shapely pillow
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

import pymupdf
from PIL import Image, ImageDraw
from shapely import make_valid, set_precision
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
# enclosed links across the mall street to the west wing and to the east end
LINK_W = [(243.08, 551.00), (264.68, 551.00), (264.68, 582.80), (243.08, 582.80)]
LINK_E = [(1159.40, 551.00), (1181.00, 551.00), (1181.00, 582.80), (1159.40, 582.80)]
# West wing: hall + corridor + angled knuckle; its south-east face is one straight line to the knuckle corner
_ww_sw = ((234.20, 716.12), (277.52, 762.56))
_ww_se = ((278.96, 761.12), (335.48, 708.56))
_ww_ne = ((314.12, 684.68), (335.48, 707.60))
WEST_WING = [(234.20, 582.80), (314.12, 582.80), (314.12, 684.68), meet(*_ww_ne, *_ww_se), meet(*_ww_sw, *_ww_se), (234.20, 716.12)]
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

# seed points (PDF) inside each raised planter drawn in the heavy kerb line
PLANTER_SEEDS = [(192.8, 668.9), (305.5, 748.6), (288.1, 854.2), (409.1, 600.1), (449.0, 769.0), (401.4, 850.2),
                 (601.7, 626.9), (536.1, 826.6), (661.4, 829.7), (931.3, 868.9), (1103.3, 823.2), (1083.9, 874.9),
                 (1241.8, 509.0), (1358.1, 587.8)]


def bez(v, t):
    x0, y0, x1, y1, x2, y2, x3, y3 = v
    s = 1 - t
    return (s ** 3 * x0 + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t ** 3 * x3,
            s ** 3 * y0 + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t ** 3 * y3)


def main(pdf_path):
    doc = pymupdf.open(pdf_path)
    page = doc[0]
    drawings = page.get_drawings()

    # kiosks (food containers, 2.45 x 6.08 m) and yard units (5.1 x 7.7 m, one is the LPG store)
    kiosks, yard = [], []
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
    buildings = [Polygon(p) for p in (SPINE_W, SPINE_M, SPINE_E, WEST_WING, GAMES, PAVILION, WC_WEST, WC_EAST)]
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
            {"id": "link_west", "kind": "link", "pts": [m(p) for p in LINK_W]},
            {"id": "link_east", "kind": "link", "pts": [m(p) for p in LINK_E]},
            {"id": "west_wing", "kind": "west_wing", "pts": [m(p) for p in WEST_WING]},
            {"id": "court_room", "kind": "court_room", "pts": [m(p) for p in COURT_ROOM]},
            {"id": "games_hall", "kind": "games_hall", "pts": [m(p) for p in GAMES]},
            {"id": "pavilion", "kind": "pavilion", "pts": [m(p) for p in PAVILION]},
            {"id": "west_pavilion", "kind": "west_pavilion", "pts": [m(p) for p in WEST_PAVILION]},
            {"id": "wc_west", "kind": "wc", "pts": [m(p) for p in WC_WEST]},
            {"id": "wc_east", "kind": "wc", "pts": [m(p) for p in WC_EAST]},
        ],
        "passages": [{"box": m(b[:2]) + m(b[2:]), "room_z": [m((0, b2[0]))[1], m((0, b2[1]))[1]]} for b, b2 in PASSAGES],
        "kiosks": [[m(p) for p in k] for k in sorted(kiosks, key=lambda k: k[0][0])],
        "yard_units": [{"pts": [m(p) for p in u["pts"]], "lpg": u["lpg"]} for u in sorted(yard, key=lambda u: u["pts"][0][0])],
        "planters": [[m(p) for p in pl] for pl in planters],
    }

    # ground image: the whole drawing inside its border, 8192 px wide (about 3.2 cm per pixel)
    fx0, fy0, fx1, fy1 = FRAME
    zoom = 8192 / (fx1 - fx0)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=pymupdf.Rect(*FRAME), alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img.convert("L").save(os.path.join(HERE, "site_plan.png"), optimize=True)
    out["ground_image"] = {"file": "site_plan.png", "min": m((fx0, fy0)), "max": m((fx1, fy1)), "px": [pix.width, pix.height]}

    with open(os.path.join(HERE, "retail_park_plan.json"), "w") as f:
        json.dump(out, f, indent=1)

    # check image: traced footprints over the drawing
    chk = img.copy()
    dr = ImageDraw.Draw(chk, "RGBA")
    to_px = lambda p: ((p[0] - fx0) * zoom, (p[1] - fy0) * zoom)
    for poly in (SPINE_W, SPINE_M, SPINE_E, LINK_W, LINK_E, WEST_WING, COURT_ROOM, GAMES, PAVILION, WEST_PAVILION, WC_WEST, WC_EAST):
        dr.polygon([to_px(p) for p in poly], fill=(255, 40, 40, 70), outline=(220, 0, 0, 255), width=3)
    for k in kiosks:
        dr.polygon([to_px(p) for p in k], fill=(255, 140, 0, 110), outline=(200, 90, 0, 255), width=2)
    for u in yard:
        dr.polygon([to_px(p) for p in u["pts"]], fill=(255, 140, 0, 110), outline=(200, 90, 0, 255), width=2)
    for pl in planters:
        dr.polygon([to_px(p) for p in pl], fill=(40, 170, 60, 90), outline=(20, 120, 40, 255), width=2)
    chk = chk.resize((4096, round(chk.height * 4096 / chk.width)), Image.LANCZOS)
    chk.save(os.path.join(HERE, "check_overlay.webp"), quality=86)
    print(f"{len(out['buildings'])} buildings, {len(kiosks)} kiosks, {len(yard)} yard units, {len(planters)} planters")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
