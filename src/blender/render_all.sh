#!/bin/bash
# Renders the Retail Park 3D page with Blender 4.5 on this machine's graphics card (macOS / Linux).
# BLENDER=/path/to/blender src/blender/render_all.sh   — output: renders/ at the top of the repo; finished frames are skipped.
set -e
cd "$(dirname "$0")/../.."
if [ -z "$BLENDER" ]; then
  if [ -x /Applications/Blender.app/Contents/MacOS/Blender ]; then BLENDER=/Applications/Blender.app/Contents/MacOS/Blender; else BLENDER=blender; fi
fi
S=src/blender/retail_park.py
"$BLENDER" -b --factory-startup -P $S -- --gpu --format webp --light day   --orbit 60 --samples 128 --out renders/day
"$BLENDER" -b --factory-startup -P $S -- --gpu --format webp --light night --orbit 60 --samples 128 --out renders/night
"$BLENDER" -b --factory-startup -P $S -- --gpu --format webp --light day   --orbit 60 --loop 48 --at 0 --samples 96 --out renders/day_loop
"$BLENDER" -b --factory-startup -P $S -- --gpu --format webp --light night --orbit 60 --loop 48 --at 0 --samples 96 --out renders/night_loop
echo "Done. Upload the renders folder (see src/blender/README.md)."
