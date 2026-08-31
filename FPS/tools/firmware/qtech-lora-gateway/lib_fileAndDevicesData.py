# Variables for read and write file Data


import const as CONST
import lib_cloud_firebase as firebaseFunction

fileName = CONST.fileName
maxData = CONST.maxData

class fileDataStruct:   
  def __init__(self):
   self.ADDH = '\xff'
   self.ADDL = '\xff'
   self.deviceID = ''
   

def create_array_structs(length):
    asList = list()
    for i in range(0,length):
        asList.append(fileDataStruct())
    return asList
   

dataList = create_array_structs(maxData)


def addNewDeviceToDataFile(AH, AL, did):  
    i = 0
    for j in range(0,maxData):
        if (len(dataList[j].deviceID) == 0):
            i = j
            break
    dataList[i].ADDH = AH
    dataList[i].ADDL = AL
    dataList[i].deviceID = did
    Fdata = "%c,%c,\"%s\"\n" %(AH[0],AL[0],did)
    f = open(fileName,"a+")
    f.write(Fdata)
    f.close()
    checkAvailableDevice();
    return
  

def refreshDataFile():  
    fData = ''  
    global dataList
    f = open(fileName,"w+")
    for i in range(0,maxData):
        if (len(dataList[i].deviceID) == 0):
            #print("stop at i=", i, "\n")
            break
        Fdata = "%c,%c,\"%s\"\n" %(dataList[i].ADDH, dataList[i].ADDL, dataList[i].deviceID)
        f.write(Fdata)
    f.close()
    return


def readFileData():  
    try:
        f = open(fileName, "r", encoding="utf-8", errors='strict')
    except:
        print('CREATE NEW DATA FILE')
        f = open(fileName,"w+") 
    global dataList
    print('readFileData')
    for i in range(0,maxData):
        line = ''
        line = f.readline()
        if (len(line) < 5):
            if (len(line) > 0):
                if (i == 0):
                    f.close()
                    f = open(fileName, "w", encoding="utf-8", errors='strict')
            #print("stop at i=", i, "\n")
            break
        dataList[i].ADDH = line[0]
        dataList[i].ADDL = line[2]
        dataList[i].deviceID = line[5:(len(line)-2)]  
    f.close()
    return

def showFileData():  
    print('showFileData')
    global dataList
    for i in range(0,maxData):
        if (len(dataList[i].deviceID) == 0):
            #print("stop at i=", i, "\n")
            break    
        data = "ADDR: %c -- %c -- '%s'\n" %(dataList[i].ADDH, dataList[i].ADDL, dataList[i].deviceID) 
        print(data)
    return

def checkEqual2DataList(AvailableDeviceList):  
    global dataList
    for i in range(0,maxData):
        if (len(dataList[i].deviceID) == 0):
            #print("stop at i=", i, "\n")
            break    
        if (dataList[i].ADDH != AvailableDeviceList[i].ADDH):
        	  return 0;
        if (dataList[i].ADDL != AvailableDeviceList[i].ADDL):
            return 0;
        if (dataList[i].deviceID != AvailableDeviceList[i].deviceID):
            print("%s --- %s \n" % dataList[i].deviceID , AvailableDeviceList[i].deviceID)
            return 0;
    return 1;
  

def checkAvailableDevice(): 
  global dataList
  AvailableDeviceList = create_array_structs(maxData)
  numOfDevice = 0
  resData = ''
  resData = str(firebaseFunction.get_device_list()) 
  global dataList
  #if(resData.find('\'count\':') != -1):
  for i in range(0,maxData):
    if(len(dataList[i].deviceID) == 0):
        print("stop at i=", i, "\n")
        break    
    if(resData.find(dataList[i].deviceID) != -1):
        AvailableDeviceList[numOfDevice].ADDH = dataList[i].ADDH
        AvailableDeviceList[numOfDevice].ADDL = dataList[i].ADDL
        AvailableDeviceList[numOfDevice].deviceID = dataList[i].deviceID
        numOfDevice = numOfDevice + 1
  if(checkEqual2DataList(AvailableDeviceList) != 1):
      print('new file\n')
      dataList = create_array_structs(maxData)
      for j in range(0,numOfDevice):
          dataList[j].ADDH = AvailableDeviceList[j].ADDH
          dataList[j].ADDL = AvailableDeviceList[j].ADDL
          dataList[j].deviceID = AvailableDeviceList[j].deviceID
      refreshDataFile()
      dataList.clear()
      dataList = create_array_structs(maxData)
      readFileData()
      showFileData()    
  return

def getDeviceByLoraID(AH, AL):  
    global dataList
    for i in range(0,maxData):
        if (len(dataList[i].deviceID) == 0):
            #print("stop at i=", i, "\n")
            break    
        if ((dataList[i].ADDH == AH) & (dataList[i].ADDL == AL)):
            return i;
    return -1;

def getDeviceByDeviceID(deviceID):  
    global dataList
    for i in range(0,maxData): 
        if (len(dataList[i].deviceID) == 0):
            #print("stop at i=", i, "\n")
            break    
        if (dataList[i].deviceID == deviceID):
            return i;
    return -1;
    
