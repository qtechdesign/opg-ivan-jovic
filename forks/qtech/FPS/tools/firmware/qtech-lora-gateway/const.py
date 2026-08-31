import json
import random

mainpath = "/home/pi/qtech-lora-gateway/"

#Log file
logPath = ("%sLOG.CSV" %mainpath)

# data file
logPath = ("%sLOG.CSV" %mainpath)
fileName = ("%sDATA.CSV" %mainpath)
maxData = 256     # num of end device can join to lora mesh


configFilePath = "/home/pi/qtech-lora-gateway/config.json"
try:
    with open(configFilePath) as f:
        data = json.load(f)
except:
    print('CREATE NEW config.json FILE')
    f = open(configFilePath,"w+") 
    f.write("{\n\"hubID\": \"GATE_COOR_123457890\"\n}")
    with open(configFilePath) as f:
        data = json.load(f)

hubID = str(data['hubID'])
netKey = hubID[10:13]
print(hubID)
print(netKey)

databaseURL =  'https://qtech-protection-system.firebaseio.com/'
firebaseCertFile = ("%sDB_Token.json" %mainpath)

print('databaseURL', databaseURL)
print('firebaseCertFile', firebaseCertFile)




timeLimit2PING = 60
timeLimit2SendPING = 1.5
offlineTimeout = 5
timeLimitAcceptJoin = 30

# define the special symbol in Lora messages 
# define the special symbol in Lora messages 
HUB_LORA_ID                   = '0000'
HUB_lora_chanel               = '19'
endMessSymbol                 = 'AB'

leaveNetworkHeader            = 'A2A1A2'
configLoraIDHeader            = 'A2A1A3'
configTimerUpdateHeader       = 'A2A4A3'
sendUpdateHeader              = 'B0B1B0'
UpdateDataHeader_ACK          = 'B2B2B2'
requestToUpdateDataHeader     = 'B2B1B0'

requestToRebootHeader         = 'B2B0B3'
actionToNodeHeader            = 'B9B8B9'
# mark
markMess_ValvesController     = 'D1D3D2'
markMess_SensorNode           = 'D2D3D3'

#firebase Header
controlDevice_firebaseCommand     = 'controlDevice'
refresh_firebaseCommand           = 'F5_Data'
configTimerUpdate_firebaseCommand = 'configTimer'
updateDevice_firebaseCommand      = 'UPDevice'
removeDeivce_firebaseCommand      = 'removeDevice'
updateSourceCode_firebaseCommand  = 'upSource'
rebootRequest_firebaseCommand     = 'reboot'


# convert from string to bytes
Str_HUB_LORA_ID                = (bytes.fromhex(HUB_LORA_ID)).decode(encoding = 'cp855', errors='strict')
Str_HUB_lora_chanel            = (bytes.fromhex(HUB_lora_chanel)).decode(encoding = 'cp855', errors='strict')
Str_endMessSymbol              = (bytes.fromhex(endMessSymbol)).decode(encoding = 'cp855', errors='strict')

Str_leaveNetworkHeader         = (bytes.fromhex(leaveNetworkHeader)).decode(encoding = 'cp855', errors='strict')
Str_configLoraIDHeader         = (bytes.fromhex(configLoraIDHeader)).decode(encoding = 'cp855', errors='strict')
Str_configTimerUpdateHeader    = (bytes.fromhex(configTimerUpdateHeader)).decode(encoding = 'cp855', errors='strict')
Str_sendUpdateHeader           = (bytes.fromhex(sendUpdateHeader)).decode(encoding = 'cp855', errors='strict')
Str_UpdateDataHeader_ACK       = (bytes.fromhex(UpdateDataHeader_ACK)).decode(encoding = 'cp855', errors='strict')
Str_requestToUpdateDataHeader  = (bytes.fromhex(requestToUpdateDataHeader)).decode(encoding = 'cp855', errors='strict')
Str_requestToRebootHeader      = (bytes.fromhex(requestToRebootHeader)).decode(encoding = 'cp855', errors='strict')
Str_actionToNodeHeader         = (bytes.fromhex(actionToNodeHeader)).decode(encoding = 'cp855', errors='strict')

Str_markMess_ValvesController  = (bytes.fromhex(markMess_ValvesController)).decode(encoding = 'cp855', errors='strict')
Str_markMess_SensorNode        = (bytes.fromhex(markMess_SensorNode)).decode(encoding = 'cp855', errors='strict')