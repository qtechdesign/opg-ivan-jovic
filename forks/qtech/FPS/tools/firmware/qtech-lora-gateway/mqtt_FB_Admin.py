#!/usr/bin/env python3


import sys
sys.path[0:0] = [""]
import os
import os.path

try:
    import time
    import requests
    from requests import get
    time.sleep(5)
    
    def check_internet():
        url='http://www.google.com/'
        timeout=5
        print("check_internet")
        while True:
            try:
                _ = requests.get(url, timeout=timeout)
                print("Internet is OK.")
                return True
            except requests.ConnectionError:	
                time.sleep(5)
                print("try again.")
    
    check_internet()
    
    
    import const as CONST
    import lib_loraNetwork as loraNetworkFunction
    import lib_fileAndDevicesData as fileFunction
    import lib_cloud_firebase as firebaseFunction
    import lib_fanAndTemp as FanAndTemp
    
    from threading import Thread
    import time
    import _thread
    
    import firebase_admin
    from firebase_admin import credentials
    from firebase_admin import db
    
    fileFunction.readFileData()        
    fileFunction.showFileData()
    fileFunction.checkAvailableDevice()
    loraNetworkFunction.loraNetwork_begin()
    firebaseFunction.firebase_admin_begin()
    
except:
    print("Can't check the problem, log at main. Reboot in 60s")
    time.sleep(60)
    os.system('sudo reboot')
