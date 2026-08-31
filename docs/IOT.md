# IoT MQTT topics (M2)

Broker: `mqtt.farm.lan:1883` (see `deploy/edge`).

```
polje/{farm_id}/dev/{device_id}/stat/#     readings, online
polje/{farm_id}/dev/{device_id}/cmnd/#     commands (later)
polje/{farm_id}/sys/edge/health
polje/{farm_id}/sys/starlink               up | down
```

Payload (tiny):

```json
{ "ts": "2026-08-31T09:59:50Z", "t": 1.2, "rh": 97.4, "soil": 0.28, "vbat": 12.4 }
```

Mapped metrics: `t`/`temp_c` → `temp_c`, `soil`/`moisture` → `moisture`, `rh` → `rh`.

Seed devices: `soil-n-1`, `temp-yard-1`, `edge-1`.
