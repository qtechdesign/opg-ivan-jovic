# Optional container — prefer running polje_main.py on the Pi with host serial.
# Full radio needs RPi.GPIO + /dev/ttyS0; this image is MQTT-binding smoke only.
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir paho-mqtt
COPY forks/qtech/FPS/tools/firmware/qtech-lora-gateway/ /app/
ENV POLJE_ENABLED=1
ENV FIREBASE_ENABLED=0
CMD ["python3", "-c", "import lib_cloud_polje as p; p.begin(); import time;\nwhile True: time.sleep(60)"]
