#  python3 "/home/pi/mqtt_firebase/lib_loraNetwork.py"


import const as CONST
import lib_fileAndDevicesData as fileFunction
import lib_cloud_firebase as firebaseFunction

from threading import Thread
import _thread
import time
import serial
import sys
import random
import sys
sys.path[0:0] = [""]
import os
import os.path

# set pin of lora module
import RPi.GPIO as GPIO
GPIO.setwarnings(False)
PinM0 = 27
PinM1 = 17
AUXPin = 4
GPIO.setmode(GPIO.BCM)
GPIO.setup(PinM0, GPIO.OUT)
GPIO.setup(PinM1, GPIO.OUT)
GPIO.setup(AUXPin, GPIO.IN)
GPIO.output(PinM0, 1)    # M0 M1 = LOW 
GPIO.output(PinM1, 0)
# set pin of lora module



lora_chanel = CONST.Str_HUB_lora_chanel
endMessSymbol = CONST.Str_endMessSymbol
HUB_LORA_ID = CONST.Str_HUB_LORA_ID

enable_add_device = False

pingQueue = list()

loraSerial = serial.Serial(  
   port='/dev/ttyS0',
   baudrate = 9600,
   parity=serial.PARITY_NONE,
   stopbits=serial.STOPBITS_ONE,
   bytesize=serial.EIGHTBITS,
   timeout=1
)



def parse_json_object(data, obj):
    prefix = "\"%s\":\"" % obj
    prefix2 = '\'%s\':' % obj
    data.find(prefix)
    if (data.find(prefix) != -1):        
        index_prefix = data.find(prefix)
        index1 = data.find('\"', (len(prefix) + index_prefix - 1)) + 1
        index2 = data.find('\"', index1)
        dataOUT = data[index1:index2]
        return dataOUT
    elif (data.find(prefix2) != -1):        
        index_prefix = data.find(prefix2)
        index1 = data.find('\'', (len(prefix2) + index_prefix - 1)) + 1
        index2 = data.find('\'', index1)
        dataOUT = data[index1:index2]
        return dataOUT
    else:
        return ''
        
        

def send_lora_mess(AH, AL, chan, mess):
    ADDR_H = AH
    ADDR_L = AL
    Lora_chanel = chan
    SendBuf =  ADDR_H + ADDR_L + Lora_chanel + HUB_LORA_ID + "\0\0\0\0\0\0" + mess +  endMessSymbol
    print("SendBuf: %s\n" % SendBuf)    
    loraSerial.write(SendBuf.encode(encoding = 'cp855', errors='strict'))
    return;
    
def changeDeviceState(deviceID, newState):    
    deviceIndex = fileFunction.getDeviceByDeviceID(deviceID)    
    print('')
    print(deviceID)
    print(newState)
    print(deviceIndex)
    if(deviceIndex != -1):
        if(newState == True):
            action = 'setOn'
        elif(newState == False):
            action = 'setOff'
        else:
            return;
        action2Send = "%s%s\n" %(CONST.Str_actionToNodeHeader, action)
        print("action2Send : %s\n" %action2Send)
        send_lora_mess(fileFunction.dataList[deviceIndex].ADDH, fileFunction.dataList[deviceIndex].ADDL, CONST.Str_HUB_lora_chanel, action2Send);    
           
def sendConfigLoraRequest(device_private_key, ADD_H, ADD_L):  
    ff_ID = (bytes.fromhex("ff")).decode(encoding = 'cp855', errors='strict')  
    configData = "%s%s%s%c%c%c\n" %(CONST.Str_configLoraIDHeader, device_private_key, CONST.netKey, ADD_H, ADD_L, CONST.Str_HUB_lora_chanel)
    print("configData : %s\n" %configData)
    send_lora_mess(ff_ID, ff_ID, CONST.Str_HUB_lora_chanel, configData);    
    
def sendConfigTimerRequest(timer):  
    ff_ID = (bytes.fromhex("ff")).decode(encoding = 'cp855', errors='strict')  
    configTimerData = "%s%s%c\n" %(CONST.netKey, CONST.Str_configTimerUpdateHeader, timer)
    print("configTimerData : %s\n" %configTimerData)
    send_lora_mess(ff_ID, ff_ID, CONST.Str_HUB_lora_chanel, configTimerData);  
    
def sendLeaveNetworkRequest(deviceID):  
    ff_ID = (bytes.fromhex("ff")).decode(encoding = 'cp855', errors='strict')  
    leaveNetworkMessageData = "%s%s\n" %(CONST.netKey, CONST.Str_leaveNetworkHeader)
    print("request leave with leaveNetworkMessageData: %s\n" %(leaveNetworkMessageData))
    if(deviceID == "gatewayDeleted"):
        send_lora_mess(ff_ID, ff_ID, CONST.Str_HUB_lora_chanel, leaveNetworkMessageData);   
    else:       
        deviceIndex = fileFunction.getDeviceByDeviceID(deviceID)            
        print(deviceID)
        print(deviceIndex)
        if(deviceIndex != -1):    
            send_lora_mess(fileFunction.dataList[deviceIndex].ADDH, fileFunction.dataList[deviceIndex].ADDL, CONST.Str_HUB_lora_chanel, leaveNetworkMessageData);     
       
def sendControlDeviceRequest(deviceID, status):    
    deviceIndex = fileFunction.getDeviceByDeviceID(deviceID)    
    print('')
    print(deviceID)
    print(deviceIndex)
    if(deviceIndex != -1):        
        if(status == "ON"):
            controlRequest = "%s%s%c\n" %(CONST.netKey, CONST.Str_actionToNodeHeader, 1)
        else:
            controlRequest = "%s%s%c\n" %(CONST.netKey, CONST.Str_actionToNodeHeader, 0)
        print("turn %s with controlRequest: %s\n" %(status, controlRequest))
        send_lora_mess(fileFunction.dataList[deviceIndex].ADDH, fileFunction.dataList[deviceIndex].ADDL, CONST.Str_HUB_lora_chanel, controlRequest);  
          
def sendRefreshDataRequest(deviceID):    
    deviceIndex = fileFunction.getDeviceByDeviceID(deviceID)    
    print('')
    print(deviceID)
    print(deviceIndex)
    if(deviceIndex != -1):        
        RefreshRequest = "%s%s\n" %(CONST.netKey, CONST.Str_requestToUpdateDataHeader)
        print("refresh data with RefreshRequest : %s\n" %RefreshRequest)
        send_lora_mess(fileFunction.dataList[deviceIndex].ADDH, fileFunction.dataList[deviceIndex].ADDL, CONST.Str_HUB_lora_chanel, RefreshRequest);    
           
def sendRebootRequest(deviceID):    
    deviceIndex = fileFunction.getDeviceByDeviceID(deviceID)    
    print('')
    print(deviceID)
    print(deviceIndex)
    if(deviceIndex != -1):        
        RebootRequest = "%s%s\n" %(CONST.netKey, CONST.Str_requestToRebootHeader)
        print("RebootRequest : %s\n" %RebootRequest)
        send_lora_mess(fileFunction.dataList[deviceIndex].ADDH, fileFunction.dataList[deviceIndex].ADDL, CONST.Str_HUB_lora_chanel, RebootRequest);

def updateValvesStatus(mess, LORA_Mess_len):    
    ADDR_H = mess[0]
    ADDR_L = mess[1]    
    ack = CONST.netKey + CONST.Str_UpdateDataHeader_ACK + mess[len(mess)-2]
    send_lora_mess(ADDR_H, ADDR_L , lora_chanel , ack)
    status = mess[8]
    print(status)
    deviceIndex = fileFunction.getDeviceByLoraID(ADDR_H, ADDR_L)
    print('deviceIndex: ' , deviceIndex)
    if (deviceIndex != -1):
        if((status == "1")):
            print('status == 1')
            valve_stt = True
            #firebaseFunction.updateValveStatus(fileFunction.dataList[deviceIndex].deviceID, "ON")
        elif(status == "0"):
            print('status == 0')
            valve_stt = False
            #firebaseFunction.updateValveStatus(fileFunction.dataList[deviceIndex].deviceID, "OFF")
        pressure_Air = int(mess[9:13])/100
        pressure_Water = int(mess[13:17])/100
        temp1 = int(mess[18:21])/10
        if(mess[17] == "-"):
            temp1 = temp1 * (-1)
        temp2 = int(mess[22:25])/10
        if(mess[21] == "-"):
            temp2 = temp2 * (-1)            
        battery = int(mess[25:28])/10
        print('valve_stt: ' , valve_stt)
        print('pressure_Air: ' , pressure_Air)
        print('pressure_Water: ' , pressure_Water)
        print('temp1: ' , temp1)
        print('temp2: ' , temp2)
        print('battery: ' , battery)
        data = {'on': valve_stt, 'prA': pressure_Air, 'prW': pressure_Water, 'tp1': temp1, 'tp2': temp2, 'bat': battery}    
        firebaseFunction.updateValveStatus(fileFunction.dataList[deviceIndex].deviceID, valve_stt, data)

def updateSensorNode(mess, LORA_Mess_len):  
    try:
        ADDR_H = mess[0]
        ADDR_L = mess[1]    
        ack = CONST.netKey + CONST.Str_UpdateDataHeader_ACK + mess[len(mess)-2]    
        #print('mess[len(mess)-2]: ' , mess[len(mess)-2])
        send_lora_mess(ADDR_H, ADDR_L , lora_chanel , ack)
        status = mess[5]
        deviceIndex = fileFunction.getDeviceByLoraID(ADDR_H, ADDR_L)
        print('deviceIndex: ' , deviceIndex)
        if (deviceIndex != -1):
            #(FB_DID, wind_speed, wind_direct, pressure, soil_mois, humi, temp1, temp2)
            mess = mess[3:]
            wind_speed = int(mess[5:9])/100
            wind_direct = int(mess[9:12])
            pressure_Air = int(mess[12:16])/100
            pressure_Water = int(mess[16:20])/100
            soil_mois = int(mess[20:23])
            humi = int(mess[23:26])
            temp1 = int(mess[27:30])/10
            if(mess[26] == "-"):
                temp1 = temp1 * (-1)
            temp2 = int(mess[31:34])/10
            if(mess[30] == "-"):
                temp2 = temp2 * (-1)            
            #battery = int(mess[30:34])/100   
            battery = int(mess[34:37])/10
            print('wind_speed: ' , wind_speed)
            print('wind_direct: ' , wind_direct)
            print('pressure_Air: ' , pressure_Air)
            print('pressure_Water: ' , pressure_Water)
            print('soil_mois: ' , soil_mois)
            print('humi: ' , humi)
            print('temp1: ' , temp1)
            print('temp2: ' , temp2)
            print('battery: ' , battery)
            data = {'wsp': wind_speed, 'wdr': wind_direct, 'prA': pressure_Air, 'prW': pressure_Water, 'soi': soil_mois, 'hum': humi, 'tp1': temp1, 'tp2': temp2, 'bat': battery}
            firebaseFunction.updateData(fileFunction.dataList[deviceIndex].deviceID, data)
    except:
        print("BAD REQUEST: updateSensorNode")
  
    
def receive_Lora_Message(buf):
    LORA_Mess = buf
    #print("Mess from : 0x%.2X%.2X\n" % LORA_Mess[0], LORA_Mess[1])
    #firebaseFunction.debugFirebase(LORA_Mess[0:2], LORA_Mess[2:])    
    print("LORA_Mess : %s\n" % LORA_Mess[2:])
    if(LORA_Mess.find(CONST.netKey) != -1):    
        print("Found NET Key")
        if(LORA_Mess.find(CONST.Str_markMess_SensorNode) != -1):
            print("LORA_Mess = update SensorNode data\n")
            updateSensorNode(LORA_Mess, len(LORA_Mess))	
        elif(LORA_Mess.find(CONST.Str_markMess_ValvesController) != -1):
            print("LORA_Mess = ValvesController update\n")        
            updateValvesStatus(LORA_Mess, len(LORA_Mess))	
    else:    
        print("No NET Key")
    return;



def check_lora_mess_receive_Loop():
    while True:      
        if(loraSerial.inWaiting() > 0):
            lora_mess = bytes()
            char = bytes()
            while True:
                char = loraSerial.read()
                lora_mess = lora_mess + char
                if (char == bytes.fromhex(CONST.endMessSymbol)):   
                    break      
            message = (lora_mess).decode(encoding = 'cp855', errors='strict')
            receive_Lora_Message(message)            
        time.sleep(0.1)




def loraNetwork_begin():
    try:
        _thread.start_new_thread(check_lora_mess_receive_Loop, ())
    except:
        print ("Error: unable to start thread")
        time.sleep(10)
        os.system('sudo reboot')