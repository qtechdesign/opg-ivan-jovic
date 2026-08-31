# IoT MQTT topics (M2–M6)

Broker: `mqtt.farm.lan:1883` (see `deploy/edge`).

```
polje/{farm_id}/dev/{device_id}/stat/#     readings, online, valve/heater state
polje/{farm_id}/dev/{device_id}/cmnd/#     commands (irrigation valve, heater ON/OFF)
polje/{farm_id}/fps/{node_id}/stat         raw LoRa decoded (FPS)
polje/{farm_id}/gw/{gw_id}/health          LoRa gateway health
polje/{farm_id}/sys/edge/health
polje/{farm_id}/sys/starlink               up | down
```

Payload (tiny, LoRa-friendly):

```json
{ "ts": "2026-08-31T09:59:50Z", "t": 1.2, "rh": 97.4, "lux": 0, "soil": 0.28, "vbat": 12.4 }
```

Irrigation valve command (`cmnd`) and status echo (`stat`):

```json
{ "on": true, "duration_sec": 600, "timeout_sec": 600, "ts": "2026-08-31T10:00:00Z" }
```

```json
{ "on": false, "ts": "2026-08-31T10:10:00Z" }
```

Heater command (`cmnd`) — Edge local timeout + battery lockout:

```json
{ "state": "ON", "timeout_sec": 1800, "reason": "below_heat_setpoint" }
```

```json
{ "state": "OFF", "timeout_sec": 0, "reason": "heat_lockout" }
```

Edge publishes OFF on boot (failsafe) and after `timeout_sec`. Hard cap 3600s.

Mapped metrics (Edge ingest): `t`/`temp_c` → `temp_c`, `soil`/`moisture` → `moisture`, `rh` → `rh`, `lux` → `lux`, **`vbat` → `battery_v`** (volts, not percent), `battery_pct`/`bat` → `battery_pct`, `w` → `w`, `kwh` → `kwh`, `kwh_today` → `kwh_today`, valve `on` → `valve_open`.

Inverter/UPS stubs (`inv-1`, `ups-1`) publish `w` / `kwh` / `kwh_today` / `battery_pct`. A later SunSpec or Modbus driver is a swap on `inv-1` — same metric names, no new API.

Cloud automations (M9) do **not** invent a new MQTT schema. They enqueue `commands` / `jobs` rows; Edge still polls `GET /v1/commands?status=sent` and ACKs. Unknown actuator actions stay unacked until the matching module implements the driver. Climate: poll `action=setpoint.set`.

## Drivers

| Driver | Kind | Protocol |
|---|---|---|
| `mqtt-generic` | sensor / gateway / actuator / inverter / battery | mqtt |
| `fps-sensor-node` | lora-node | lora |
| `fps-valve` | actuator | lora |
| `fps-lora-gw` | gateway | lora |
| `shelly` / `tasmota` | actuator (later LAN HTTP) | mqtt / http |

## Seed devices (ivan-jovic)

OTS: `soil-n-1`, `temp-yard-1`, `edge-1`  
Irrigation: `valve-garden-drip`, `valve-hay-frost`  
FPS: `fps-sn-1`, `fps-valve-1`, `fps-gw-1` (when M4 seeded)  
Cameras: `cam-yard`, `cam-garden`, `cam-hay`  
Climate + energy: `temp-house-1`, `heater-house-1`, `inv-1`, `ups-1`
