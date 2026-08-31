# Hardware lineage — FPS + farm IoT

Hardware files live in the fork: [`forks/qtech/FPS/tools/hardware`](../forks/qtech/FPS/tools/hardware). Polje does **not** redesign PCBs in M4.

## FPS boards (Qtech)

| Item | Notes |
|---|---|
| SensorNode | Multisensor: temp, RH, light/soil; ~3 min sample; solar 12 V / logic 5 V |
| ValveController | Frost spray valves; **local timeout required** |
| SSN ver 2.0 | Sensor node variant under `Qtech_FPS_SSN_ver2.0` |
| FPS v2.0 / v3.0 | Controller + MPPT Altium under `FPS_v2.0`, `FPS_v3.0` |
| PIP 2.0 | Pulsating sprayer: ~5 m @ 1 bar, 1.2–2.0 mm/m²/h, 1–4 bar uniform flow — model as frost emitters |
| Calibration | See fork `Calibration.md` / hardware README |

## Procurement filter (bible §3)

Allowed: open-source firmware **or** documented **local** API (HTTP / MQTT / Modbus / RTSP / LoRa) from Linux. No vendor-cloud-only SKUs.

## Buy now / build later

| Phase | Approach |
|---|---|
| Now | OTS: Shelly *local* / Tasmota, cheap temp/RH MQTT, RTSP cameras — equal to FPS behind `DeviceDriver` |
| Operating cash | Extend gateway → Polje MQTT; map real node IDs |
| Surplus / grant | Next SensorNode / ValveController / MPPT revision |

Never block a planting season on custom PCB work.
