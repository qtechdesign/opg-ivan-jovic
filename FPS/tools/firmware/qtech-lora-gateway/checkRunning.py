import sys
sys.path[0:0] = [""]
import os
import os.path
import subprocess
import time
import datetime
import pytz

cmd = ['ps aux | grep -i python3']

while True: 
    time.sleep(10)  
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, 
    stderr=subprocess.PIPE)
    my_pid, err = process.communicate()
    #print(my_pid)
    if (str(my_pid)).find("mqtt_FB_Admin.py") >=0:
        print("")
    else:
        print("main.py not running. reboot in 45s")
        time.sleep(45)
        os.system('sudo reboot')
