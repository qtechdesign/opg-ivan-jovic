"""
Polje cloud binding for qtech-lora-gateway.

Publishes decoded LoRa telemetry to mqtt.farm.lan (Polje topic tree).
Firebase remains optional via FIREBASE_ENABLED=1.

Env:
  POLJE_FARM_ID   default ivan-jovic
  POLJE_GW_ID     default fps-gw-1
  MQTT_URL        default mqtt://mqtt.farm.lan:1883
  POLJE_ENABLED   default 1
"""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone

try:
    import paho.mqtt.client as mqtt
except ImportError:  # pragma: no cover
    mqtt = None

FARM_ID = os.environ.get("POLJE_FARM_ID", "ivan-jovic")
GW_ID = os.environ.get("POLJE_GW_ID", "fps-gw-1")
MQTT_URL = os.environ.get("MQTT_URL", "mqtt://mqtt.farm.lan:1883")
ENABLED = os.environ.get("POLJE_ENABLED", "1") != "0"

_client = None
_packet_count = 0
_nodes_seen = set()
_lock = threading.Lock()


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_mqtt_url(url: str):
    # mqtt://host:port
    u = url.replace("mqtt://", "").replace("mqtts://", "")
    host, _, port_s = u.partition(":")
    port = int(port_s) if port_s else 1883
    return host or "127.0.0.1", port


def _ensure_client():
    global _client
    if not ENABLED or mqtt is None:
        return None
    if _client is not None:
        return _client
    host, port = _parse_mqtt_url(MQTT_URL)
    c = mqtt.Client(client_id=f"fps-gw-polje-{GW_ID}")
    c.on_connect = _on_connect
    c.on_message = _on_message
    try:
        c.connect(host, port, 60)
        c.loop_start()
        _client = c
        print(f"[polje] MQTT connected {host}:{port} farm={FARM_ID}")
    except Exception as exc:  # pragma: no cover
        print(f"[polje] MQTT connect failed: {exc}")
        return None
    return _client


def _on_connect(client, userdata, flags, rc):
    topic = f"polje/{FARM_ID}/dev/+/cmnd/#"
    client.subscribe(topic)
    print(f"[polje] subscribed {topic}")


def _on_message(client, userdata, msg):
    """Valve cmnd: polje/{farm}/dev/{valve_id}/cmnd/..."""
    try:
        parts = msg.topic.split("/")
        # polje / farm / dev / id / cmnd / ...
        if len(parts) < 5 or parts[2] != "dev" or parts[4] != "cmnd":
            return
        valve_id = parts[3]
        payload = json.loads(msg.payload.decode("utf-8"))
        state = str(payload.get("state", "")).upper()
        timeout_sec = int(payload.get("timeout_sec") or 0)
        if state not in ("ON", "OFF"):
            return
        try:
            import lib_loraNetwork as lora
            lora.sendControlDeviceRequest(valve_id, state)
            if state == "ON" and timeout_sec > 0:
                def _off():
                    time.sleep(timeout_sec)
                    lora.sendControlDeviceRequest(valve_id, "OFF")
                threading.Thread(target=_off, daemon=True).start()
            print(f"[polje] valve cmnd {valve_id} {state} timeout={timeout_sec}")
        except Exception as exc:
            print(f"[polje] valve cmnd failed: {exc}")
    except Exception as exc:
        print(f"[polje] cmnd parse error: {exc}")


def map_device_id(fb_did: str) -> str:
    """Map legacy Firebase device keys to Polje device ids when known."""
    # Prefer explicit map via env POLJE_DEVICE_MAP='{"SENOxxx":"fps-sn-1"}'
    raw = os.environ.get("POLJE_DEVICE_MAP", "")
    if raw:
        try:
            m = json.loads(raw)
            if fb_did in m:
                return m[fb_did]
        except json.JSONDecodeError:
            pass
    # Heuristic: keep short ids; otherwise prefix
    if fb_did.startswith("fps-") or fb_did in ("fps-sn-1", "fps-valve-1"):
        return fb_did
    if "VACO" in fb_did.upper() or fb_did.upper().startswith("VAL"):
        return os.environ.get("POLJE_DEFAULT_VALVE", "fps-valve-1")
    if "SENO" in fb_did.upper() or fb_did.upper().startswith("SEN"):
        return os.environ.get("POLJE_DEFAULT_SENSOR", "fps-sn-1")
    return fb_did


def publish_sensor(fb_did: str, data: dict):
    """data keys from gateway: wsp, wdr, prA, prW, soi, hum, tp1, tp2, bat"""
    global _packet_count
    c = _ensure_client()
    if c is None:
        return
    device_id = map_device_id(fb_did)
    with _lock:
        _packet_count += 1
        _nodes_seen.add(device_id)
    soil = data.get("soi")
    # soil often 0–100 from firmware; normalize to 0–1 for Polje
    if isinstance(soil, (int, float)) and soil > 1:
        soil = soil / 100.0
    payload = {
        "ts": _now_iso(),
        "t": data.get("tp1"),
        "rh": data.get("hum"),
        "soil": soil,
        "vbat": data.get("bat"),
        "lux": data.get("lux", 0),
        "wsp": data.get("wsp"),
        "wdr": data.get("wdr"),
    }
    # drop Nones
    payload = {k: v for k, v in payload.items() if v is not None}
    body = json.dumps(payload)
    c.publish(f"polje/{FARM_ID}/fps/{device_id}/stat", body)
    c.publish(f"polje/{FARM_ID}/dev/{device_id}/stat", body)
    publish_health()


def publish_valve(fb_did: str, valve_on: bool, data: dict):
    global _packet_count
    c = _ensure_client()
    if c is None:
        return
    device_id = map_device_id(fb_did)
    with _lock:
        _packet_count += 1
        _nodes_seen.add(device_id)
    payload = {
        "ts": _now_iso(),
        "on": 1 if valve_on else 0,
        "t": data.get("tp1"),
        "vbat": data.get("bat"),
        "prA": data.get("prA"),
        "prW": data.get("prW"),
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    body = json.dumps(payload)
    c.publish(f"polje/{FARM_ID}/fps/{device_id}/stat", body)
    c.publish(f"polje/{FARM_ID}/dev/{device_id}/stat", body)
    publish_health()


def publish_health():
    c = _ensure_client()
    if c is None:
        return
    with _lock:
        packets = _packet_count
        nodes = len(_nodes_seen)
    body = json.dumps(
        {
            "ts": _now_iso(),
            "ok": True,
            "packets": packets,
            "nodes": nodes,
            "gw": GW_ID,
        }
    )
    c.publish(f"polje/{FARM_ID}/gw/{GW_ID}/health", body, retain=True)
    c.publish(
        f"polje/{FARM_ID}/dev/{GW_ID}/stat",
        json.dumps({"ts": _now_iso(), "packets": packets, "nodes": nodes}),
        retain=True,
    )


def begin():
    """Start MQTT client (call from polje_main)."""
    _ensure_client()
    publish_health()
