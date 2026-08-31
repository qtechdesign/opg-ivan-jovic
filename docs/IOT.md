# IoT MQTT topics (M2–M5)

Broker: `mqtt.farm.lan:1883` (see `deploy/edge`).

```
polje/{farm_id}/dev/{device_id}/stat/#     readings, online, valve state
polje/{farm_id}/dev/{device_id}/cmnd/#     commands (irrigation valve ON/OFF)
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

Edge publishes OFF on boot (failsafe) and after `timeout_sec`. Hard cap 3600s.

Mapped metrics: `t`/`temp_c` → `temp_c`, `soil`/`moisture` → `moisture`, `rh` → `rh`, `lux` → `lux`, `vbat` → `battery_pct`, valve `on` → `valve_on`.

Cloud automations (M9) do **not** invent a new MQTT schema. They enqueue `commands` / `jobs` rows; Edge still polls `GET /v1/commands?status=sent` and ACKs. Unknown actuator actions stay unacked until the matching module implements the driver.

## Drivers

| Driver | Kind | Protocol |
|---|---|---|
| `mqtt-generic` | sensor / gateway / actuator | mqtt |
| `fps-sensor-node` | lora-node | lora |
| `fps-valve` | actuator | lora |
| `fps-lora-gw` | gateway | lora |
| `shelly` / `tasmota` | actuator (later LAN HTTP) | mqtt / http |

## Seed devices (ivan-jovic)

OTS: `soil-n-1`, `temp-yard-1`, `edge-1`  
Irrigation: `valve-garden-drip`, `valve-hay-frost`  
FPS: `fps-sn-1`, `fps-valve-1`, `fps-gw-1` (when M4 seeded)  
Cameras: `cam-yard`, `cam-garden`, `cam-hay`
