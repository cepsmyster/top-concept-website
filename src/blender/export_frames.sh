#!/bin/bash
# Turn the Blender renders into the files the 3D page loads.
#   src/blender/export_frames.sh <render dir> [ffmpeg binary]
# <render dir> holds day/ night/ (orbit frames f000.png …) and day_loop/ night_loop/ (l000_000.png …).
# Writes assets/rp3d/{day,night}/f000.webp (1600 px), …/md/f000.webp (960 px), {day,night}-loop(.md).mp4
# and assets/img/rp3d-og.jpg. Needs ImageMagick (with WebP) and ffmpeg.
set -euo pipefail
SRC=${1:?render dir}
FFMPEG=${2:-ffmpeg}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$ROOT/assets/rp3d
mkdir -p "$OUT"
for set in day night; do
  [ -d "$SRC/$set" ] || continue
  mkdir -p "$OUT/$set/md"
  for f in "$SRC/$set"/f*.png; do
    n=$(basename "$f" .png)
    [ -f "$OUT/$set/$n.webp" ] || convert "$f" -quality 74 -define webp:method=6 "$OUT/$set/$n.webp"
    [ -f "$OUT/$set/md/$n.webp" ] || convert "$f" -resize 960x -quality 72 -define webp:method=6 "$OUT/$set/md/$n.webp"
  done
  loop="$SRC/${set}_loop"
  if [ -d "$loop" ] && [ "$(ls "$loop"/*.png 2>/dev/null | wc -l)" -gt 1 ]; then
    first=$(ls "$loop"/*.png | head -1); at=$(basename "$first" | cut -d_ -f1)
    "$FFMPEG" -y -loglevel error -framerate 24 -i "$loop/${at}_%03d.png" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -an "$OUT/$set-loop.mp4"
    "$FFMPEG" -y -loglevel error -framerate 24 -i "$loop/${at}_%03d.png" -vf scale=960:-2 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -an "$OUT/$set-loop-md.mp4"
  fi
done
[ -f "$SRC/day/f000.png" ] && convert "$SRC/day/f000.png" -resize 1200x630^ -gravity center -extent 1200x630 -quality 82 "$ROOT/assets/img/rp3d-og.jpg"
du -sh "$OUT"/* 2>/dev/null
