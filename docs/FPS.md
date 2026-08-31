# FPS — Frost Protection System (M4)

Living fork: [`forks/qtech`](../forks/qtech) from [qtechdesign/qtech](https://github.com/qtechdesign/qtech) (MIT).

FPS keeps a crop near **100% RH** and uses irrigation (latent heat / ice layer **0–2 °C**) on frost nights. That is **not** summer drip (M5). Zone kinds stay distinct: `frost` vs `drip`.

## What we inherit

| Piece | Path under `forks/qtech` |
|---|---|
| Multisensor node | `FPS/tools/firmware/Qtech_FPS_SensorNode` (+ SSN 2.0) |
| Valve controller | `FPS/tools/firmware/Qtech_FPS_ValveController` |
| LoRa gateway | `FPS/tools/firmware/qtech-lora-gateway` |
| Hardware v2 / v3 + MPPT | `FPS/tools/hardware/FPS_v2.0`, `FPS_v3.0` |
| Mobile apps | `FPS/tools/app/` (later → Polje API) |

See [`HARDWARE.md`](HARDWARE.md) for PIP 2.0 / BOM notes. New PCBs are a funded milestone, not an M4 gate.

## Polje binding

Gateway publishes to Mosquitto (`mqtt.farm.lan`) via `lib_cloud_polje.py`. Firebase stays **opt-in** (`FIREBASE_ENABLED=1`).

Topics (also in [`IOT.md`](IOT.md)):

```
polje/{farm_id}/fps/{node_id}/stat
polje/{farm_id}/gw/{gw_id}/health
polje/{farm_id}/dev/{device_id}/stat
polje/{farm_id}/dev/{valve_id}/cmnd/#
```

No LoRaWAN join-server in M4 — wrap the existing Qtech packet format (marks `D2D3D3` sensor, `D1D3D2` valve).

## Local frost program

Runs on **Polje Edge** (write-leader). States: `idle` → `watch` → `armed` → `spraying`.

- Armed + temp below threshold → valve cmnd with `timeout_sec` (safe default OFF)
- Works with Starlink / Cloudflare down
- Cloud `POST /v1/fps/arm` and valve open need `confirm: true` + `reason` (or return proposal only)
- Exception: when already `armed` and live temp below threshold, Edge may spray without a second cloud confirm (still audited)

## Drivers

Equal citizens in `@polje/drivers`: `fps-sensor-node`, `fps-valve`, `fps-lora-gw`, `mqtt-generic`.

## Run without radio

```bash
cd deploy/edge
docker compose up -d mosquitto edge
docker compose --profile sim up -d sim   # publishes fps-sn-1 + fps-gw-1
```

Physical gateway: [`deploy/gateway`](../deploy/gateway) (profile `radio` when hardware is present).

## Pull upstream

```bash
git subtree pull --prefix=forks/qtech https://github.com/qtechdesign/qtech.git master --squash
```
