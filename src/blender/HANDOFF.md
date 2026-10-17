# Retail Park 3D: handoff

Where the accurate 3D model of Retail Park (Al Dhaid, Sharjah) stands, for whoever picks it up next: a person, a new Claude Code session or another assistant. Last updated 17 October 2026.

## The goal

The website's photoreal 3D page (`retail-park-3d.html`, rendered by `src/blender/retail_park.py`) was laid out by eye from marketing renders. The owner wants it rebuilt **step by step, with pin-point accuracy**, from the real drawings:

1. **Massing** from the drawings. **Done.**
2. **Environment**: the desert round the site from the satellite view, with fog at the far end. **Done.**
3. **Visualisation**: the material schedule's finishes, the facades from the elevations, landscape, shade sails, food trucks, golden-hour light. No cars (the owner's call). **Done, awaiting the owner's review.**
4. Export to the website (camera tour, `export_tour.mjs`). Not started. The live page still plays the old film.

## Where the work is

- Repo `cepsmyster/top-concept-website`, branch **`claude/loving-babbage-h6o4i7`** (no pull request yet).
- Commits: `8f6aff5` (massing from the plan), `adeab20` (.blend edge-line fix), `c7080bc` (section levels and desert setting), `6618999` (the visualisation), and the commit after it (docs, `RetailPark_visual.blend`).
- Claude Code session: https://claude.ai/code/session_01EWeF7S7Cmxq5E2Z8pY8YQv
- Everything for this lives in `src/blender/`. `README.md` there has the full reference; this file is the short version.

## Source documents (not in the repo; keep them)

| Document | Used for |
|---|---|
| `A-091-SITE_SETTING_OUT_PLAN_SHEET_02_OF_02-Model.pdf` (AutoCAD, vector) | All footprints, the ground surfaces, the sunken areas, the stairs |
| `elevations_and_sections.pdf` (17 sheets, A-200 to A-306, Illustrator export) | All levels and heights |
| Satellite screenshot of the site (shared in chat, not saved as a file) | Layout of the surroundings (roads, farms, housing) |
| BEEAH HQ aerial photo (shared in chat) | The look of the desert setting: desert, distant haze |
| `MATERIALSHEETS-RETAIL_PARK.pdf` (material schedule, 13 finishes) | Every finish of the visualisation: PT01/PT02/PT03 paints, GL, AL, TC01, TC02, CC01, ITN01, RP01/RP02, SHD01 |
| 5 reference renders (shared in chat): two aerials, the food-truck pods, the market court under sails, a shopfront | The look of step 3. Not drawings, so used only where the drawings say nothing |
| `Hard_Finishes_Cutsheets.pdf` | **Not used**: it is for a different project |

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
- **Visualisation** (`visual.py`): finishes per the material schedule (table in `README.md`). Trees on the plan's 82 tree pits; the plan's sand inside the site boundary is landscape beds (about 60 trees, 4,100 shrubs and grasses); 15 SHD01 sails, 24 masts and 8 stalls in the market court; the 16 food trucks as pink and white pods; 19 café tables. Sun from 290° (west-north-west), 16° up; per-view exposure keyframed on each view's frame. Not in the drawings, so taken from the references or assumed: sail layout and colours, stall and table positions, tenant signs, the pods' look, the west wing in Rusty, the trail in red RP01 (the schedule also lists a blue RP02 jogging path), the plant species.
- **Surroundings** (`environment.py`): everything touching the site follows the plan. Things further out were read off the satellite image by eye (about 0.70 m a pixel, anchored on the west access road, rear road and main road), so they are approximate. The plan's main road is read as a one-way collector north of the highway, and the junction road as its slip road to the highway.

## Files (`src/blender/`)

| File | What it does |
|---|---|
| `plan/trace_plan.py` | PDF → `plan/retail_park_plan.json` (footprints, sunken ground meshes, walls, stairs, tree pits, landscape positions), `plan/site_ground.png` (ground surfaces with road markings), `plan/site_zones.png` (surface classes for the visual shaders), `plan/site_plan.png` (the drawing), `plan/check_overlay.webp` |
| `massing.py` | Builds the Blender scene: `LEVELS`, buildings, sunken ground, cameras. `--look visual` (default) or `--look massing`; `--env desert` (default) or `--env plain` (grey card with edge lines) |
| `visual.py` | Step 3: materials, facades, landscape, sails, food trucks, furniture |
| `RetailPark_visual.blend` | The visualisation, ready to render (Blender 5.1, about 14 MB, self-contained). Render > Render Animation: frames 1–9 = the 9 views |
| `render_visual.bat` | Windows double-click: rebuilds `RetailPark_visual.blend` and renders the 9 views at 256 samples into `renders/visual` |
| `environment.py` | The desert: terrain 16 km across, roads and bridges, palm farms, compounds, housing, about 140,000 instanced trees and shrubs, hazy sky, fog volume |
| `RetailPark_massing.blend` | Ready to render, saved in Blender 5.1, self-contained (the one image is packed in; everything else is procedural). Render > Render Animation: frames 1–7 = the 7 views → a `renders` folder next to the .blend |
| `render_massing.bat` | Windows double-click: rebuilds the massing .blend and renders the 7 views on the graphics card (expects Blender 5.1 at the default path, or set `BLENDER`) |
| `retail_park.py`, `export_tour.mjs`, `RetailPark_day/night.blend` | The **old** photoreal pipeline behind the live page, not yet rebuilt on the accurate model |

Run: `blender -b --factory-startup -P src/blender/massing.py -- --gpu --out renders/visual` (add `--look massing` for the white massing). Options: `--views 00,06`, `--samples`, `--res`, `--blend <file>`, `--env plain`. Building the scene takes about 10 s. On a CPU, a 1600×900 view at 40 samples takes several minutes; on a graphics card it's much faster.

## Known limits and gotchas

- The outside ground is flat at 0.00. The promenade's real +0.30/+0.45 isn't modelled, so the sunken courts read about 0.4 m shallower than built.
- Through-passages in the spine are simplified: a walled room from −1.95 to +4.80, with the roof carried over.
- Freestyle edge lines are **off in the desert** setting: Freestyle loads every instanced tree and ran out of memory (14 GB). They're still on in `--env plain`.
- The plan's ground-surface classification uses seed points (`SEEDS`, `PAVER_BOXES` in `trace_plan.py`). If a drawing revision moves roads or plazas, check `site_ground.png`.
- Blender's `triangle_fill` dropped faces on polygons with holes. The site ground is triangulated in `trace_plan.py` with shapely's constrained Delaunay instead.
- The `.blend` files were saved with Blender 5.1 because the owner renders on Blender 5.1 (RTX 5070) at home. Blender 4.4 and older can't open 5.x files (the owner's work PC has 4.3; they said a 4.3 copy isn't needed for now). If one is wanted later, rebuild it there from `massing.py`; the scripts target 4.2+, but the visualisation has only been run on 5.1 and 5.2.
- Eye-level views stand in the buildings' shade at this low sun, so their exposure is lifted per frame (`LIFT` in `massing.py`). Change the sun and you may want to retune it.
- Bay numbers and arrows painted on the asphalt are the drawing's own text, carried into the road markings.

## Next steps (suggested)

1. Owner review of the step 3 renders: finishes, the sails, the planting, the light.
2. Confirm the assumed heights (WC blocks, yard units, court room) and the promenade level, and the open choices listed under Visualisation above.
3. Step 4: rebuild the photoreal film from the accurate scene (camera tour, `export_tour.mjs`) and replace the live page's film.
4. Still open: the repo is **public**, so the plan-derived files (`site_plan.png`, the plan JSON, the zones) are visible to anyone. The owner was offered their removal; nothing has been decided.

## Continuing elsewhere

- **Claude Code on a PC:** open this session's menu in the Claude app and use "Open in CLI" (`claude --teleport …`) inside a clean local clone, or check out the branch and start `claude` with this file as context.
- **Another assistant:** give it this file, `src/blender/README.md` and the four scripts (`trace_plan.py`, `massing.py`, `environment.py`, `visual.py`), plus the PDFs if anything needs re-tracing.
