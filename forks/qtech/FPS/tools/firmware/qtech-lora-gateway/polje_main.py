#!/usr/bin/env python3
"""
Polje entrypoint for qtech-lora-gateway.

Polje MQTT is ON by default. Firebase is opt-in (FIREBASE_ENABLED=1).

Usage (on lora.farm.lan):
  export MQTT_URL=mqtt://mqtt.farm.lan:1883
  export POLJE_FARM_ID=ivan-jovic
  python3 polje_main.py
"""

from __future__ import annotations

import os
import sys
import time

sys.path[0:0] = [""]

FIREBASE_ENABLED = os.environ.get("FIREBASE_ENABLED", "0") == "1"
POLJE_ENABLED = os.environ.get("POLJE_ENABLED", "1") != "0"


def main():
    import lib_fileAndDevicesData as fileFunction
    import lib_loraNetwork as loraNetworkFunction

    fileFunction.readFileData()
    fileFunction.showFileData()
    fileFunction.checkAvailableDevice()
    loraNetworkFunction.loraNetwork_begin()

    if POLJE_ENABLED:
        import lib_cloud_polje as polje
        polje.begin()
        print("Polje MQTT cloud: ON")
    else:
        print("Polje MQTT cloud: OFF")

    if FIREBASE_ENABLED:
        import lib_cloud_firebase as firebaseFunction
        firebaseFunction.firebase_admin_begin()
        print("Firebase cloud: ON (opt-in)")
    else:
        print("Firebase cloud: OFF (default)")

    # Keep process alive; LoRa + MQTT threads run in background
    while True:
        time.sleep(30)
        if POLJE_ENABLED:
            try:
                import lib_cloud_polje as polje
                polje.publish_health()
            except Exception as exc:
                print("polje health tick failed", exc)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("polje_main failed; reboot in 60s")
        time.sleep(60)
        os.system("sudo reboot")
