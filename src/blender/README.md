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
