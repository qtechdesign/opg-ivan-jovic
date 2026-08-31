# FPS hardware calibration and validation

Album (photos, setups, results)
- Google Photos: https://photos.app.goo.gl/msPYUroQLh4XpNES6

Scope
- Electrical bring‑up, sensor calibration, RF link checks, and environmental validation for the FPS controller (`WS_QTD_v4.0`) and `WS_MPPT_Board`.

References (design files)
- Controller: `FPS/tools/hardware/FPS_v3.0/WS_QTD_v4.0/WS_QTD_v4.0.PrjPcb`
- MPPT: `FPS/tools/hardware/FPS_v3.0/WS_MPPT_Board/WS_MPPT_Board.PrjPcb`
- Pin changes: `FPS/tools/hardware/FPS_v3.0/NOTE_CHANGE_PIN.txt`
- Datasheets: `FPS/tools/hardware/FPS_v3.0/Docs/` (ATmega2560, DS18B20, E32 LoRa, Air Pressure)

Bench setup
- Power via MPPT output or lab supply; verify polarity and fuse.
- Serial monitor on controller UART; log timestamps and measurements.
- Attach DS18B20 and air‑pressure sensors; connect LoRa module per schematic.

Checklist (bring‑up)
1) Power rails: 5 V and 3.3 V within tolerance; inrush < expected; steady‑state current noted.
2) Clock/reset: controller enumerates; boot banner visible on UART.
3) I/O pins: confirm any remaps per NOTE_CHANGE_PIN.txt.

Checklist (sensor calibration)
- DS18B20: compare to reference thermometer over 0–25 °C; accept ±0.5 °C; record offset if needed.
- Air pressure: compare to calibrated barometer; adjust slope/offset in firmware constants if drift observed.

Checklist (RF link)
- E32‑433T30S / E32‑868T20S: RSSI at 1–10 m line of sight; packet error rate under nominal conditions; antenna keep‑out respected.

Environmental validation
- Cold chamber / outdoor run: correlate measured temperature/humidity with album photos; confirm defog/frost behavior vs. expectations.

Artifacts
- Photos and setup notes: see album above.
- Logs: store alongside test date under project logs if available.


