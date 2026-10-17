# Retail Park 3D: handoff

Where the accurate 3D model of Retail Park (Al Dhaid, Sharjah) stands, for whoever picks it up next: a person, a new Claude Code session or another assistant. Last updated 17 October 2026.

## The goal

The website's photoreal 3D page (`retail-park-3d.html`, rendered by `src/blender/retail_park.py`) was laid out by eye from marketing renders. The owner wants it rebuilt **step by step, with pin-point accuracy**, from the real drawings:

1. **Massing** from the drawings, in its real setting. **Done** (this handoff).
2. Facades and materials from the elevations. Not started.
3. Landscaping, shade sails, people and cars. Not started.
4. Photoreal render and export to the website. Not started. The live page still plays the old film.

## Where the work is

- Repo `cepsmyster/top-concept-website`, branch **`claude/loving-babbage-h6o4i7`** (no pull request yet).
- Commits: `8f6aff5` (massing from the plan), `adeab20` (.blend edge-line fix), `c7080bc` (section levels and desert setting).
- Claude Code session: https://claude.ai/code/session_01EWeF7S7Cmxq5E2Z8pY8YQv
- Everything for this lives in `src/blender/`. `README.md` there has the full reference; this file is the short version.

## Source documents (not in the repo; keep them)

| Document | Used for |
|---|---|
| `A-091-SITE_SETTING_OUT_PLAN_SHEET_02_OF_02-Model.pdf` (AutoCAD, vector) | All footprints, the ground surfaces, the sunken areas, the stairs |
| `elevations_and_sections.pdf` (17 sheets, A-200 to A-306, Illustrator export) | All levels and heights |
| Satellite screenshot of the site (shared in chat, not saved as a file) | Layout of the surroundings (roads, farms, housing) |
| BEEAH HQ aerial photo (shared in chat) | The look: white building, desert, distant haze |

To re-trace after a drawing revision: `pip install pymupdf shapely pillow numpy scipy`, then `python src/blender/plan/trace_plan.py "<plan>.pdf"`.

## Key facts

- **Scale of the plan PDF:** 6.3306 PDF points per metre (about 1:448; the sheet was plotted to fit, with no scale bar). It was confirmed several ways: bays 2.70 × 5.40 m, CAD fillets of exactly 2/3/4/5/6 m, doors 0.90/1.00 m, stair treads 0.30/0.40 m.
- **Axes:** plan x runs west → east, z from the rear road (north) to the main road (south), in metres. The origin is the Games hall's north-west outer corner. Blender coordinates are (x, −z, height). The plan is close to north-up: the owner confirmed the plot sits north-east of the Al Dhaid interchange.
- **Footprints:** the outer wall faces, snapped to the CAD vertices (about 2 cm). The check image is `src/blender/plan/check_overlay.webp`.
- **Levels** (datum 0.00 = gate level at the rear road), from the sections:

| Block | Bottom | Top |
|---|---|---|
| Spine (F&B and retail) | −1.95 | parapet +6.25 (roof SSL +4.80) |
| Covered mall corridor, west wing corridor | −1.95 | +2.60 |
| West wing | −1.95 | +6.25 (head rooms +7.65) |
| Games hall | −1.95 | +7.20 |
| Pavilion | −3.00 basement (FFL +0.45) | +7.20 |
| Pump and LV room | ground | +3.90 |
| Food trucks (16) | ground | +2.95 |
| WC blocks / yard units / court room | ground / ground / −1.95 | +3.90 / +3.20 / +2.60: **assumed**, not in the sections |

- **Sunken areas** at −1.95: the market court and the tree plaza, with retaining walls and railings. The plaza's terraces and the ramp beside the pavilion rise to the promenade, and there are two 16-riser stairs.
- **Surroundings** (`environment.py`): everything touching the site follows the plan. Things further out were read off the satellite image by eye (about 0.70 m a pixel, anchored on the west access road, rear road and main road), so they are approximate. The plan's main road is read as a one-way collector north of the highway, and the junction road as its slip road to the highway.

## Files (`src/blender/`)

| File | What it does |
|---|---|
| `plan/trace_plan.py` | PDF → `plan/retail_park_plan.json` (footprints, sunken ground meshes, walls, stairs), `plan/site_ground.png` (ground surfaces with road markings), `plan/site_plan.png` (the drawing), `plan/check_overlay.webp` |
| `massing.py` | Builds the Blender scene: `LEVELS`, buildings, sunken ground, 7 cameras. `--env desert` (default) or `--env plain` (grey card with edge lines) |
| `environment.py` | The desert: terrain 16 km across, roads and bridges, palm farms, compounds, housing, about 140,000 instanced trees and shrubs, hazy sky, fog volume |
| `RetailPark_massing.blend` | Ready to render, saved in Blender 5.1, images packed. Render > Render Animation: frames 1–7 = the 7 views → `renders/massing/` |
| `render_massing.bat` | Windows double-click: rebuilds the .blend and renders the 7 views on the graphics card (expects Blender 5.1 at the default path, or set `BLENDER`) |
| `retail_park.py`, `export_tour.mjs`, `RetailPark_day/night.blend` | The **old** photoreal pipeline behind the live page, not yet rebuilt on the accurate model |

Run: `blender -b --factory-startup -P src/blender/massing.py -- --gpu --out renders/massing`. Options: `--views 00,06`, `--samples`, `--res`, `--blend <file>`, `--env plain`. Building the scene takes about 10 s. On a CPU, a 1600×900 view at 48 samples takes a few minutes; on a graphics card it's much faster.

## Known limits and gotchas

- The outside ground is flat at 0.00. The promenade's real +0.30/+0.45 isn't modelled, so the sunken courts read about 0.4 m shallower than built.
- Through-passages in the spine are simplified: a walled room from −1.95 to +4.80, with the roof carried over.
- Freestyle edge lines are **off in the desert** setting: Freestyle loads every instanced tree and ran out of memory (14 GB). They're still on in `--env plain`.
- The plan's ground-surface classification uses seed points (`SEEDS`, `PAVER_BOXES` in `trace_plan.py`). If a drawing revision moves roads or plazas, check `site_ground.png`.
- Blender's `triangle_fill` dropped faces on polygons with holes. The site ground is triangulated in `trace_plan.py` with shapely's constrained Delaunay instead.
- The `.blend` was saved with Blender 5.1 because the owner renders on Blender 5.1 (RTX 5070). Older Blender: rebuild it from `massing.py` (4.2+ works).

## Next steps (suggested)

1. Owner review of the step 1 renders: levels, the corridor roof, the sunken court and plaza, the surroundings.
2. Confirm the assumed heights (WC blocks, yard units, court room) and the promenade level.
3. Step 2, facades from the elevations (A-200 to A-202 and the AR-500 enlarged elevations). The material legend: curtain walls, aluminium mullions and canopy, rusty paint, dark stone paint, lotus paint, terracotta brick, LED signage and screens, aluminium coping and C-channels.
4. Step 3, landscaping: trees at the plan's tree grates (1.63 m squares in the PDF), planting in the raised planters, shade sails over the market court, cars in the bays.
5. Step 4: rebuild the photoreal film from the accurate scene (camera tour, `export_tour.mjs`) and replace the live page's film.

## Continuing elsewhere

- **Claude Code on a PC:** open this session's menu in the Claude app and use "Open in CLI" (`claude --teleport …`) inside a clean local clone, or check out the branch and start `claude` with this file as context.
- **Another assistant:** give it this file, `src/blender/README.md` and the three scripts, plus the two PDFs if anything needs re-tracing.
