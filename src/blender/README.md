# Retail Park in 3D: rendering

The 3D page (`retail-park-3d.html`) shows a photoreal turn of Retail Park, by day and by night, made in Blender from code only (no downloaded models, textures or HDRIs).

| File | What it is |
|---|---|
| `RetailPark_day.blend`, `RetailPark_night.blend` | Ready-to-render scenes. Frames 1–60 turn the camera once round the park (6° per frame, cars driving on); frames 61–108 are a 2-second traffic loop at the home view. Output: `renders/day/frame_0001.webp` … next to the .blend file. |
| `retail_park.py` | Builds the scene from scratch (layout from `src/model3d.mjs`). Regenerates the .blend files, or renders directly. |
| `render_all.bat` / `render_all.sh` | Render everything straight from `retail_park.py` on the graphics card (alternative to the .blend files). |
| `export_frames.sh` | Turns the renders into the files the page loads (`assets/rp3d/…`). |

**Rendering the .blend files:** Blender 4.2 or newer, including Blender 5 (tested in 4.5 and 5.0: 5.0 converts the sky automatically and the frames match). For an RTX 50-series card use Blender 4.5 or 5.x.
**Rebuilding the scene from `retail_park.py`:** Blender 4.2–4.5 only, because Blender 5 renamed parts of the Python API the script uses (compositor and sky).

## Render on your own PC (graphics card)

1. Pull the branch `claude/inspiring-gauss-hkkbay` (or `main` once merged).
2. In Blender: **Edit → Preferences → System → Cycles Render Devices**, pick OptiX (NVIDIA RTX), CUDA, HIP (AMD) or Metal (Mac) and tick your card. Save preferences.
3. Render both files. From a terminal at the top of the repo:

   ```
   blender -b src/blender/RetailPark_day.blend -a
   blender -b src/blender/RetailPark_night.blend -a
   ```

   On Windows `blender` is usually `"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"`.
   Or open each file in Blender and choose **Render → Render Animation**. Frames already on disk are skipped if you start again (Output Properties → Overwrite off).
4. You should get 108 images in `src/blender/renders/day/` and 108 in `src/blender/renders/night/`.
5. Commit and push `src/blender/renders/` to the branch. A cloud session then runs the export (step below), checks the result and merges.

Settings in the files: 1600 × 900, 128 samples with denoising, WebP output. Rough time on a recent RTX card: 5–20 s per frame by day, a little more by night.

## Export for the site

```
src/blender/export_frames.sh src/blender/renders        # needs ImageMagick (WebP) and ffmpeg
node src/build.mjs
```

This writes `assets/rp3d/{day,night}/f000…f059.webp` (1600 px), `…/md/` (960 px for phones), `{day,night}-loop.mp4` and `-loop-md.mp4`, and `assets/img/rp3d-og.jpg`. Then delete `src/blender/renders/` so the raw frames do not stay in the repository.

## Changing the scene

Edit `retail_park.py`, then regenerate the .blend files (works with the `bpy` 4.5 Python module too):

```
blender -b --factory-startup -P src/blender/retail_park.py -- --light day   --blend src/blender/RetailPark_day.blend
blender -b --factory-startup -P src/blender/retail_park.py -- --light night --blend src/blender/RetailPark_night.blend
```

Other options: `--res 1600x900`, `--samples 128`, `--orbit 60`, `--gpu`, `--format webp`, `--frames 0-59`, `--loop 48 --at 0`.

Notes on the scene: the connector between the buildings has a plain roof (no parking on it). Behind it runs the rear road at ground level, with a row of parking on its far side.
