#!/bin/bash
# Renders the Retail Park 3D tour on this machine's graphics card (macOS / Linux), Blender 4.2 or newer.
# BLENDER=/path/to/blender src/blender/render_all.sh   — output: renders/ at the top of the repo; finished frames are skipped.
set -e
cd "$(dirname "$0")/../.."
if [ -z "$BLENDER" ]; then
  if [ -x /Applications/Blender.app/Contents/MacOS/Blender ]; then BLENDER=/Applications/Blender.app/Contents/MacOS/Blender; else BLENDER=blender; fi
fi
S=src/blender/retail_park.py
"$BLENDER" -b --factory-startup -P $S -- --gpu --format webp --light day   --tour 8 --path 24 --no-traffic --samples 128 --out renders/day
"$BLENDER" -b --factory-startup -P $S -- --gpu --format webp --light night --tour 8 --path 24 --no-traffic --samples 128 --out renders/night
echo "Done. Next: node src/blender/export_tour.mjs renders (see src/blender/README.md)."
