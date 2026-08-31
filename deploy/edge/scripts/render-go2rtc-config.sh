#!/usr/bin/env bash
# Render go2rtc.yaml from CAMERA_*_RTSP env (never commit the output if it has URLs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/nvr/go2rtc.generated.yaml"
{
  echo "# Generated — do not commit if it contains RTSP URLs"
  echo "api:"
  echo '  listen: ":1984"'
  echo "streams:"
  if [[ -n "${CAMERA_YARD_RTSP:-}" ]]; then
    echo "  cam-yard:"
    echo "    - ${CAMERA_YARD_RTSP}"
  fi
  if [[ -n "${CAMERA_GARDEN_RTSP:-}" ]]; then
    echo "  cam-garden:"
    echo "    - ${CAMERA_GARDEN_RTSP}"
  fi
  if [[ -n "${CAMERA_HAY_RTSP:-}" ]]; then
    echo "  cam-hay:"
    echo "    - ${CAMERA_HAY_RTSP}"
  fi
} > "$OUT"
echo "wrote $OUT"
