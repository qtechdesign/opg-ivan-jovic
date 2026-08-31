

import RPi.GPIO as GPIO
import time
import datetime
import pytz

from threading import Thread
import _thread
import serial

fanPin = 23

GPIO.setmode(GPIO.BCM)
GPIO.setup(fanPin, GPIO.OUT)

fanState = False
GPIO.output(fanPin, GPIO.LOW)

def turnOnFan():
    global fanState
    GPIO.output(fanPin, GPIO.HIGH)
    fanState = True   
    print("turn on fan") 
    
def turnOffFan():
    global fanState
    GPIO.output(fanPin, GPIO.LOW)
    fanState = False
    print("turn off fan") 


def get_cpu_temperature():
    try:
        tFile = open('/sys/class/thermal/thermal_zone0/temp')
        temp = float(tFile.read())
        tFile.close()
        tempC = temp/1000
        #print(tempC)
        return tempC
    except:
        tFile.close()
        GPIO.cleanup()


def fanAndTempLOOP():
    while True:
        if(fanState == False):
            if(get_cpu_temperature() > 50):
                turnOnFan()
        if(fanState == True):
            if(get_cpu_temperature() < 45):
                turnOffFan()
        time.sleep(1)
    
_thread.start_new_thread(fanAndTempLOOP, ())