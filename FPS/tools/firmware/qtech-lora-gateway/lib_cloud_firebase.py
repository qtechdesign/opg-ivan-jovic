# python3 "/home/pi/WeatherStation_UWP/lib_cloud_firebase.py"

'''
    firebase_admin.db.reference(path).get()                    : get data of path
    firebase_admin.db.reference(path).push(JsonData)           : create new data
    firebase_admin.db.reference(path).update(JsonData)         : change data 
    get  : doc du lieu
    post : them du lieu moi
    put  : cap nhat 1 truong da co
'''



import lib_loraNetwork as loraNetworkFunction
import lib_fileAndDevicesData as fileFunction
from firebase_admin import auth
import time
import datetime
import json
import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import const as CONST
from threading import Thread
import _thread

import sys
sys.path[0:0] = [""]
import os
import os.path


hubID = CONST.hubID 
      
#firebase config  
databaseURL =  CONST.databaseURL
firebaseCertFile = CONST.firebaseCertFile
checkByReSubcribeCMD = 0

if (not len(firebase_admin._apps)):
    cred = credentials.Certificate(firebaseCertFile)    
    firebase_admin.initialize_app(cred, {'databaseURL': databaseURL})

checkProcess = 0 

    
#function
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

def updateValveStatus(FB_DID, valve_stt, message):
    ts = int(time.time())
    data = {'data':message, 'TS': ts}
    ts_data = {'on':valve_stt, 'TS': ts}
    print(data)
    firebase_admin.db.reference(('/devices/%s/current_data/' %(FB_DID))).update(data)
    firebase_admin.db.reference(('/gateways/%s/devices/%s/' %(hubID, FB_DID))).update(ts_data)
    result = firebase_admin.db.reference('device_logs/%s/' %(FB_DID)).push(data)
    print(result.key)

def updateData(FB_DID, message):
    ts = int(time.time())
    data = {'data':message, 'TS': ts}
    ts_data = {'TS': ts}
    print(data)
    firebase_admin.db.reference(('/devices/%s/current_data/' %(FB_DID))).update(data)
    firebase_admin.db.reference(('/gateways/%s/devices/%s/' %(hubID, FB_DID))).update(ts_data)
    result = firebase_admin.db.reference('device_logs/%s/' %(FB_DID)).push(data)
    print(result.key)
   
def get_device_list():
    result = firebase_admin.db.reference(('/gateways/%s/devices' %hubID)).get()
    print(result)     
    return result
    
def debugFirebase(ID_Lora, mess):
    result = firebase_admin.db.reference('/gateways/%s/debugMess' %hubID).push({'Lora_ID':ID_Lora, 'mess':mess, 'TS': int(time.time())})
    print(result.key)  
    
    
def creatANewHub():
    result = firebase_admin.db.reference(('/gateways/%s' %hubID)).get()
    #print('|%s|' %result)
    if (len(str(result)) <= 10):
        result = firebase_admin.db.reference('gateways/%s' %hubID).update({"owner":"", 'name':('%s...%s' %(hubID[0:8],hubID[16:20])), 'command': ''})
        print("creat NewHub done.")  
    IP = str(os.popen('hostname -I').read())
    TVInformation = str(os.popen('teamviewer info').read())
    TVID = TVInformation[(TVInformation.find('\n', (TVInformation.find('ID:')+4))-11):(TVInformation.find('\n', (TVInformation.find('ID:')+4))-1)]
    firebase_admin.db.reference('admin/gateways/%s' %hubID).update({"last_login" : {"TS":int(time.time()), "IP": IP[0:(IP.find('\n')-1)], "TVID":TVID}})     
      
def pull_request():
    os.chdir('/home/pi/qtech-lora-gateway/')
    resp = str(os.popen('git pull "https://user:pass@github.com/vnvansi/qtech-lora-gateway.git"').read())
    print("resp")
    print(resp)
    firebase_admin.db.reference('admin/gateways/%s' %hubID).update({"update_source_status" : {"TS":int(time.time()), "resp":resp}})    
               
def updateSourceRequest(command):
    if(command.find(hubID) >= 0):
        pull_request()
        
def removeRequest(deviceID):
    if(deviceID.find(hubID) >= 0):
        loraNetworkFunction.sendLeaveNetworkRequest("gatewayDeleted")
    else:
        loraNetworkFunction.sendLeaveNetworkRequest(deviceID)    
    fileFunction.checkAvailableDevice()
        
def rebootRequest(command):
    if(command.find(hubID) >= 0):
        result = firebase_admin.db.reference('gateways/%s' %hubID).update({'command': ""}) 
        print ("Received Reboot request. Reboot gateway in 10s.")
        time.sleep(10)
        os.system('sudo reboot')
    else:
        loraNetworkFunction.sendRebootRequest(command)
    
       
def updateDeviceInformation(command):
    dataDevice = command[(command.find(':')+ 1):len(command)]
    did = parse_json_object(dataDevice, "key")
    loraID = parse_json_object(dataDevice, "lora_ID")
    print(did)
    print(loraID)
    print(loraID[2:4])
    print(loraID[4:6])
    AH = (bytes.fromhex(loraID[2:4])).decode(encoding = 'cp855', errors='strict')
    AL = (bytes.fromhex(loraID[4:6])).decode(encoding = 'cp855', errors='strict')    
    data = "ADDR: %c -- %c -- '%s'\n" %(AH, AL, did) 
    print(data)
    deviceIndex = fileFunction.getDeviceByDeviceID(did)
    print('deviceIndex = ', deviceIndex)
    if (deviceIndex == -1):
        print('add new device')
        fileFunction.addNewDeviceToDataFile(AH, AL, did)
        fileFunction.showFileData()
    else:
        print('update device')
        fileFunction.dataList[deviceIndex].ADDH = AH
        fileFunction.dataList[deviceIndex].ADDL = AL
        fileFunction.refreshDataFile()
        fileFunction.readFileData()       
        fileFunction.showFileData()
    loraNetworkFunction.sendConfigLoraRequest(did, AH, AL)
 
       
def commandProcessing(event):
    #checkByReSubcribeCMD = 0
    global checkProcess
    checkProcess = 1
    if (str(event.path).find('/') >= 0): 
        if (len(str(event.data)) == 0):
            #print('FB_DID == NULL')
            return ''           
        #cases
        if (str(event.data).find(CONST.updateDevice_firebaseCommand) >= 0):
            #UPDevice: {'key':'SENO5pZ594wmJ0a0l4LN','lora_ID':'0x4A5D'}        #UPDevice: {'key':'SENOW0m2O0ua6lXuVOGb','lora_ID':'0x4547'}
            updateDeviceInformation(event.data)
        elif (str(event.data).find(CONST.refresh_firebaseCommand) >= 0):
            #F5_Data: {'key':'SENO5pZ594wmJ0a0l4LN'}
            loraNetworkFunction.sendRefreshDataRequest(parse_json_object(event.data, "key"))
            print("refresh_firebaseCommand")  
        elif (str(event.data).find(CONST.configTimerUpdate_firebaseCommand) >= 0): 
            #configTimer: {'timer':'3'}
            loraNetworkFunction.sendConfigTimerRequest(int(parse_json_object(event.data, "timer")))
            print("configTimerUpdate_firebaseCommand")  
        elif (str(event.data).find(CONST.controlDevice_firebaseCommand) >= 0): 
            #controlDevice: {'key':'VACOCjhFzKPPnh36dLBd', 'status':'ON'}      #controlDevice: {'key':'VACOCjhFzKPPnh36dLBd', 'status':'OFF'}
            loraNetworkFunction.sendControlDeviceRequest(parse_json_object(event.data, "key"), parse_json_object(event.data, "status"))
            print("controlDevice_firebaseCommand")  
        elif (str(event.data).find(CONST.removeDeivce_firebaseCommand) >= 0):
            #removeDevice: {'key':'SENO5pZ594wmJ0a0l4LN'}
            removeRequest(parse_json_object(event.data, "key"))
            print("removeDeivce_firebaseCommand")  
        elif (str(event.data).find(CONST.updateSourceCode_firebaseCommand) >= 0):            
            #upSource: {'key':'GATEEiZgoDIMnGQctbKs'}
            updateSourceRequest(event.data)
            print("updateSourceCode_firebaseCommand")  
        elif (str(event.data).find(CONST.rebootRequest_firebaseCommand) >= 0):            
            #reboot: {'key':'GATEEiZgoDIMnGQctbKs'}
            rebootRequest(parse_json_object(event.data, "key"))
            print("rebootRequest_firebaseCommand")  
        else:
            print("New function")  
        result = firebase_admin.db.reference('gateways/%s' %hubID).update({'command': ""}) 
    else:
        print("not change status")        
        print(event.path)      
        print(event.data)    


def testSUB():
    while True:  
        try:
            global checkProcess
            if (checkProcess > -1): 
                checkProcess = checkProcess - 1  
                result = firebase_admin.db.reference('gateways/%s' %hubID).update({'command': "check sub"})            
            elif (checkProcess <= -1): 
                print("(checkProcess <= -2): open new sub")
                firebase_admin.db.reference('gateways/%s/command/' %hubID).listen(commandProcessing)
        except:
            print ("Error in testSUB(). Skip!")    
        time.sleep(30)       

        
def firebase_admin_begin():
    try:
        time.sleep(3)      
        _thread.start_new_thread(testSUB, ())  
        creatANewHub() 
        print("Trying subribe refreshData")
        firebase_admin.db.reference('gateways/%s/command/' %hubID).listen(commandProcessing)
        print("Done subribe commandProcessing")
    except:
        print ("Error: unable to start thread at firebase_admin_begin 1")        
        time.sleep(10)
        try:
            time.sleep(5)
            firebase_admin.db.reference('gateways/%s/command/' %hubID).listen(commandProcessing)
            print("Done subribe commandProcessing")
        except:
            print ("Error: unable to start thread at firebase_admin_begin 2")
            time.sleep(20)
            try:
                time.sleep(5)
                firebase_admin.db.reference('gateways/%s/command/' %hubID).listen(commandProcessing)
                print("Done subribe commandProcessing")
            except:
                print ("Error: unable to start thread at firebase_admin_begin 3")
                time.sleep(35)
                try:
                    time.sleep(5)
                    firebase_admin.db.reference('gateways/%s/command/' %hubID).listen(commandProcessing)
                    print("Done subribe commandProcessing")
                except:
                    print ("Error: unable to start thread at firebase_admin_begin 4")
                    time.sleep(50)
                    try:
                        time.sleep(5)
                        firebase_admin.db.reference('gateways/%s/command/' %hubID).listen(commandProcessing)
                        print("Done subribe commandProcessing")
                    except:
                        print ("Error: unable to start thread at firebase_admin_begin 5")
                        time.sleep(20)
                        os.system('sudo reboot')

print('exit')
