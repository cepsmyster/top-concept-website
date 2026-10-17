# Retail Park in 3D: rendering

The 3D page (`retail-park-3d.html`) is a fly-round of Retail Park, rendered in Blender from code only (no downloaded models, textures or HDRIs). It moves view to view like [belgradearbor.rs/en/3d](https://belgradearbor.rs/en/3d): the section is pinned and each slice of the page scroll is one of 8 views round the park. Scrolling into the next slice plays a film on to that view, a 2-second glide at 60 fps that eases in and out of every view, and stops exactly on it. Scrolling back plays a reversed copy of the film. The two only swap at a view, where they show the same frame. The pointer leans the picture slightly.

The camera sits low and close (about 25° down, 26 mm lens, horizon in view). Trees are open, branching street trees with loose leaf clumps. The main road stops at the site edges and there is no moving traffic; parked cars stay.

| File | What it is |
|---|---|
| `retail_park.py` | Builds the scene from scratch (layout from `src/model3d.mjs`) and renders the film (`--tour 8 --path 120 --ease --no-traffic`) or saves a .blend file. Blender 4.2 or newer, including 5.x. |
| `RetailPark_day.blend`, `RetailPark_night.blend` | The scene with an earlier tour animation (traffic loops and flights, frames 1–768, long main road). Useful for looking round or test renders; the page uses the film render below. |
| `render_all.bat` / `render_all.sh` | Render the day and night films on the graphics card. |
| `export_tour.mjs` | Turns the renders into the files the page loads (`assets/rp3d/…`). |

Settings: 1600 × 900, 64 samples with denoising, WebP frames, 841 frames per light (7 glides × 120 frames + 1). On an RTX 5070 about 3.3 s per frame, so about 45 minutes for each light.

## Render

From a terminal at the top of the repo (Windows: `render_all.bat`, or use the full path to `blender.exe`):

```
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light day   --tour 8 --path 120 --ease --no-traffic --samples 64 --out renders/day
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light night --tour 8 --path 120 --ease --no-traffic --samples 64 --out renders/night
```

Frames go to `renders/<light>/film/0000.webp` … Finished frames are skipped, so you can stop and start again; `--frames 0,300` renders a subset. To check the framing of the 8 views first: `--tour 8 --clips s0,s1,s2,s3,s4,s5,s6,s7 --still --res 800x450 --samples 32`.

## Export for the site

```
node src/blender/export_tour.mjs renders [path/to/ffmpeg]     # ffmpeg with libx264, libvpx-vp9, libwebp (npx ffmpeg-static works); LIGHTS=day for one light
node src/build.mjs
```

This writes `assets/rp3d/<light>/film.mp4` and `film-rev.mp4` (1600 px, about 7 MB each), `-md` copies at 960 px for phones (about 2.5 MB each), VP9 `.webm` copies for browsers without H.264, `poster.webp` / `poster-md.webp`, and `assets/img/rp3d-og.jpg`. Every view starts a keyframe, so the page can land on any view at once. Don't commit the raw renders. The Day / Night switch on the page appears only once `assets/rp3d/night/` has been exported (then run `node src/build.mjs` again).

## Changing the scene

Edit `retail_park.py`, render, export. The tour camera is `place_tour()` (`TOUR_RX`, `TOUR_RY`, `TOUR_H`, `TOUR_LOOK`, `--lens`); the view names on the page are `VIEWS` in `src/build.mjs`, in the same order. The glide length is `--path` (frames at 60 fps) and must match `data-step` (seconds) in `src/build.mjs` and `STEP` in `export_tour.mjs`. To refresh the .blend files:

```
blender -b --factory-startup -P src/blender/retail_park.py -- --light day   --tour 8 --blend src/blender/RetailPark_day.blend
blender -b --factory-startup -P src/blender/retail_park.py -- --light night --tour 8 --blend src/blender/RetailPark_night.blend
```

Notes on the scene: the connector between the buildings has a plain roof (no parking on it). Behind it runs the rear road at ground level, with a row of parking on its far side.

## Accurate model, step 1: massing from the setting-out plan

The photoreal scene above was laid out by eye from the renders. The accurate model is being rebuilt in steps from the drawings, starting with the massing traced from the site setting-out plan (A-091, sheet 02 of 02).

| File | What it is |
|---|---|
| `plan/trace_plan.py` | Reads the plan PDF's vector linework and writes the three files below. Ordinary Python: `pip install pymupdf shapely pillow`, then `python src/blender/plan/trace_plan.py "<plan>.pdf"`. |
| `plan/retail_park_plan.json` | Every footprint in metres: the retail spine (3 parts, 2 covered through-passages), the 2 links across the mall street, the west wing, the court room, the Games hall, the pavilion, the west pavilion, 2 WC blocks, 16 food kiosks, 6 yard units (one is the LPG store) and 14 raised planters. |
| `plan/site_plan.png` | The drawing itself, 8192 px wide (about 3 cm a pixel), laid under the massing at true scale, so roads, bays, kerbs and the jogging trail are exact. |
| `plan/check_overlay.webp` | The traced footprints drawn over the drawing, for checking. |
| `massing.py` | Builds the massing in Blender (4.2 or newer) from the JSON: white blocks on the plan, 6 cameras. |
| `RetailPark_massing.blend` | The massing, ready to render (the plan image is packed in). Open it and press Render > Render Animation: frames 1–6 are the 6 views, written to `renders/massing/` at the top of the repo. Uses the graphics card set in Preferences > System > Cycles Render Devices. |
| `render_massing.bat` | Double-click on Windows: rebuilds the .blend and renders the 6 views on the graphics card into `renders/massing/`. |

**Scale.** The PDF was plotted to fit the sheet, with no scale bar, so the scale was measured from the drawing: 6.3306 PDF points per metre (about 1:448 on A2). Everything agrees with it: parking bays 2.70 × 5.40 m (measured over runs of up to 26 bays), CAD fillet radii of exactly 2, 3, 4, 5 and 6 m, doors 0.90 and 1.00 m, internal stair treads 0.30 m, external steps 0.40 m and accessible-bay zones 1.20 m.

**Accuracy.** Building outlines are the outer wall faces, snapped to the CAD vertices (the PDF stores them to about 2 cm). Kiosks, yard units and planters are read from the drawing automatically.

**Axes.** As in `retail_park.py`: x runs west to east, z from the rear road towards the main road, in metres. The origin is the north-west outer corner of the Games hall.

**Heights are not on the plan.** `HEIGHTS` at the top of `massing.py` holds the heights used for now, carried over from the photoreal scene (spine 9.4 m, west wing 10.5 m, Games hall 10.8 m, pavilion 9.4 m, kiosks 2.9 m, planters 0.45 m). Everything stands on one flat ground level. The plan does show level changes: 16-riser stairs and long ramps from the promenade up to the market court and plaza, and escalators in the Games hall. Sections, elevations or a levels plan will fix both the heights and the ground levels in the next step.

| View (frame) | Camera |
|---|---|
| 1 | Aerial from the south-west |
| 2 | Aerial from the south-east |
| 3 | Aerial from the rear (north-west) |
| 4 | From the main road |
| 5 | Eye level along the mall street between the spine and the Games hall |
| 6 | Straight down over the whole drawing (orthographic), to check the massing against the plan |

To render here instead of opening the .blend: `blender -b --factory-startup -P src/blender/massing.py -- --gpu --out renders/massing` (`--views 01,06` for a subset, `--samples`, `--res`, `--no-lines` to leave out the edge lines).
