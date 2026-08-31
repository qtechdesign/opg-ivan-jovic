---
title: Starlink
description: Snapshots through the cloud. Live video stays on the farm LAN.
---

# Starlink bandwidth (M3)

Starlink is the uplink. Edge is the muscle.

## Snapshots: yes

- Interval **5–15 min** (default Edge `SNAPSHOT_INTERVAL_SEC=600` = 10 min).
- One JPEG per camera, overwrite `latest.jpg` in R2 — no clip history through the Worker.
- Typical still ≈ 50–200 KB. Three cameras × 6/hour ≈ small.

## Live video: not in M3

- No HLS, no Cloudflare Stream, no 24/7 RTSP through the Worker.
- 4K continuous would burn Starlink quota and latency budget.
- When you need live: watch on farm LAN (`go2rtc` :1984), not through the cloud.

## Secrets

- Never commit `CAMERA_*_RTSP` URLs. Put them in `deploy/edge/.env` (gitignored).
- Cloud never dials a camera IP — Edge grabs locally, uploads with `INGEST_TOKEN`.

## go2rtc / Frigate

- `go2rtc` always-on in compose (empty streams = placeholders).
- Frigate: `docker compose --profile cameras up` when you have real cams + config.
