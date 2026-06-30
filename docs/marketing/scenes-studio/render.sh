#!/usr/bin/env bash
# Transcode scene webm → mp4 + gif. Usage: render.sh <in.webm> <outDir> <base> [gifSecs] [start] [speed]
set -euo pipefail

IN="$1"; OUTDIR="$2"; BASE="$3"; GIFSECS="${4:-6}"; START="${5:-0}"; SPEED="${6:-1.4}"; POSTER_SS="${7:-}"
mkdir -p "$OUTDIR"

PTS="setpts=PTS/${SPEED}"
GIFIN="$(awk -v g="$GIFSECS" -v s="$SPEED" 'BEGIN{printf "%.2f", g*s}')"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found — install ffmpeg to build GIFs"
  exit 1
fi

ffmpeg -y -ss "$START" -i "$IN" \
  -vf "${PTS},scale='min(1920,iw)':'-2':flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset fast -movflags +faststart \
  -an "$OUTDIR/$BASE.mp4"

PAL="$(mktemp --suffix=.png)"
ffmpeg -y -ss "$START" -t "$GIFIN" -i "$IN" \
  -vf "${PTS},fps=15,scale=900:-1:flags=lanczos,palettegen=stats_mode=full" "$PAL"
ffmpeg -y -ss "$START" -t "$GIFIN" -i "$IN" -i "$PAL" \
  -lavfi "${PTS},fps=15,scale=900:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 "$OUTDIR/$BASE.gif"
rm -f "$PAL"

# Poster frame from video (optional). Pass POSTER_SS=0 to skip — capture-flow writes its own poster.
if [[ -n "$POSTER_SS" && "$POSTER_SS" != "0" ]]; then
  ffmpeg -y -i "$IN" -ss "$POSTER_SS" -frames:v 1 "$OUTDIR/poster-$BASE.png" 2>/dev/null || true
fi
echo "wrote $OUTDIR/$BASE.gif (+ $BASE.mp4)"
