#!/bin/bash
# Turn the Blender renders into the files the 3D page loads.
#   src/blender/export_frames.sh <render dir> [ffmpeg binary]
# <render dir> holds day/ night/ (orbit frames f000.png …) and day_loop/ night_loop/ (l000_000.png …),
# or day/ night/ with frame_0001.webp … as rendered from RetailPark_day.blend / RetailPark_night.blend.
# Writes assets/rp3d/{day,night}/f000.webp (1600 px), …/md/f000.webp (960 px), {day,night}-loop(-md).mp4/.webm
# and assets/img/rp3d-og.jpg. Needs ImageMagick (with WebP) and ffmpeg.
set -euo pipefail
SRC=${1:?render dir}
FFMPEG=${2:-ffmpeg}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$ROOT/assets/rp3d
ORBIT=${ORBIT:-60}
mkdir -p "$OUT"
# Renders from the .blend files (frame_0001 …): frames 1–ORBIT are the turn, the rest the traffic loop.
if ls "$SRC"/day/frame_0001.* >/dev/null 2>&1 || ls "$SRC"/night/frame_0001.* >/dev/null 2>&1; then
  TMP=$(mktemp -d)
  for set in day night; do
    [ -d "$SRC/$set" ] || continue
    mkdir -p "$TMP/$set" "$TMP/${set}_loop"
    for f in "$SRC/$set"/frame_*; do
      n=$((10#$(basename "${f%.*}" | sed 's/frame_//'))); ext=${f##*.}
      if [ $n -le $ORBIT ]; then ln -s "$(realpath "$f")" "$TMP/$set/$(printf 'f%03d' $((n - 1))).$ext"
      else ln -s "$(realpath "$f")" "$TMP/${set}_loop/$(printf 'l000_%03d' $((n - ORBIT - 1))).$ext"; fi
    done
  done
  SRC=$TMP
fi
for set in day night; do
  [ -d "$SRC/$set" ] || continue
  mkdir -p "$OUT/$set/md"
  for f in "$SRC/$set"/f*.png "$SRC/$set"/f*.webp; do
    [ -e "$f" ] || continue
    n=$(basename "${f%.*}")
    [ -f "$OUT/$set/$n.webp" ] || convert "$f" -quality 74 -define webp:method=6 "$OUT/$set/$n.webp"
    [ -f "$OUT/$set/md/$n.webp" ] || convert "$f" -resize 960x -quality 72 -define webp:method=6 "$OUT/$set/md/$n.webp"
  done
  loop="$SRC/${set}_loop"
  if [ -d "$loop" ] && [ "$(ls "$loop"/l* 2>/dev/null | wc -l)" -gt 1 ]; then
    first=$(ls "$loop"/l* | head -1); at=$(basename "$first" | cut -d_ -f1); ext=${first##*.}
    "$FFMPEG" -y -loglevel error -framerate 24 -i "$loop/${at}_%03d.$ext" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -an "$OUT/$set-loop.mp4"
    "$FFMPEG" -y -loglevel error -framerate 24 -i "$loop/${at}_%03d.$ext" -vf scale=960:-2 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -an "$OUT/$set-loop-md.mp4"
    # VP9 copies for browsers without H.264 (some Linux builds of Chromium and Firefox)
    "$FFMPEG" -y -loglevel error -framerate 24 -i "$loop/${at}_%03d.$ext" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 -pix_fmt yuv420p -an "$OUT/$set-loop.webm"
    "$FFMPEG" -y -loglevel error -framerate 24 -i "$loop/${at}_%03d.$ext" -vf scale=960:-2 -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -pix_fmt yuv420p -an "$OUT/$set-loop-md.webm"
  fi
done
og=$(ls "$SRC"/day/f000.* 2>/dev/null | head -1)
[ -n "$og" ] && convert "$og" -resize 1200x630^ -gravity center -extent 1200x630 -quality 82 "$ROOT/assets/img/rp3d-og.jpg"
du -sh "$OUT"/* 2>/dev/null
