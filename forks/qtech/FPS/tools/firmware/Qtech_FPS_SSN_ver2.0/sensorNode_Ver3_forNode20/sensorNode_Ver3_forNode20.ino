#include "LowPower.h"
#include "UDOpenLora.h"
#include <EEPROM.h>
#include <Arduino.h>
#include <avr/wdt.h>

/**************************
 * define EPPROM address
**************************/
const int networkState_EEP = 0;         //1 bytes
const int networkAddrH_EEP = 1;         //1 bytes
const int networkAddrL_EEP = 2;         //1 bytes
const int networkChanel_EEP = 3;        //1 bytes
const int timeSendDataLoop_MIN_EEP = 4; //1 bytes
const int secondUploadFirmware_EEP = 5; //1 bytes
const int networkKey_EEP = 20;          //3 bytes

/**************************
 * config for device
**************************/
bool enableDebugPort = false;
bool reWriteEEPROM = false;
int secondUploadFirmware = 0;


const char markMess_SensorNode[4] = {0xD2, 0xD3, 0xD3, '\0'};
const String device_serial_key = "SENOqGEkdiyGhj3ROp0S";

/**************************
 * setup for lora
**************************/
#define lora_power TSMT_PWR_30DB
#define loraSerial Serial2
UDOpenLora loraBoard(&loraSerial);
const int loraUAXPin = 3;
const int M0Pin = 7;
const int M1Pin = 6;

int networkState = 0;
int networkAddrH = 0x14;
int networkAddrL = 0x12;
int networkChanel = 0x19;  
char networkKey[4];  

char data_buf[128];
char send_buf[128];
uint8_t data_len;
byte ADDR_H, ADDR_L;

const char configLoraIDHeader[4] = {0xA2, 0xA1, 0xA3, '\0'};
const char leaveNetworkHeader[4] = {0xA2, 0xA1, 0xA2, '\0'};
const char configTimerUpdateHeader[4] = {0xA2, 0xA4, 0xA3, '\0'};
const char updateDataHeader[4] = {0xB2, 0xB1, 0xB0, '\0'};
const char UpdateDataHeader_ACK[4] = {0xB2, 0xB2, 0xB2, '\0'};
const char actionToNodeHeader[4] = {0xB9, 0xB8, 0xB9, '\0'};
const char requestToRebootHeader[4] = {0xB2, 0xB0, 0xB3, '\0'};

/**************************
 * config for lora mess loop
**************************/
bool gotACK = false;
char ACKValue = 0;
int updateStateTimeout_Sec = 5;
unsigned long lastMessageTime = 0;
int timeSendDataLoop_MIN = 0;

/**************************
 * config PINS
**************************/
const int led_R = 38; // turn on : 0; turn off : 1;
const int led_G = 37;

const int buttonPin = 2;


unsigned long timeCheckReset = 0;
unsigned long timeForReset_DAY = 1; //max in 5 days
int timesWakeup = 0;
bool isLoraWakeup = false;
bool isButtonWakeup = false;
bool isTimerWake = true;


/**************************
 * MAIN
**************************/
void setup()
{
  if(enableDebugPort == true)
  {
    Serial.begin(9600);
    Serial.print("device_serial_key: "); 
    Serial.println(device_serial_key); 
  }  
  setupLora();
  setupSensors();
  setupForDevice(); // empty funtion
  turnOnInterrupt();
  setupLedDebug();
  blinkDebugLed(2, 500);
}

void loop() 
{    
  loopBegin:
  gotoSleepMode();  
  if(enableDebugPort == true)
  {
    Serial.println("//************"); 
    Serial.println("wake up\n"); 
  }
  checkLoraWakeUp();
  checkButtonWakeUp();
  if(isTimerWake == false)
  {
    isTimerWake = true;
    if(loraSerial.available() > 0)
    {  
      while(loraSerial.available() > 0)
      {
        if(enableDebugPort == true)      
        {
          Serial.write(loraSerial.read());
        }
      }
    }  
    goto loopBegin;
  }
  checkTimerWakeUp(); 
  if(enableDebugPort == true)
  {
    delay(200);
  }
  else
  {
    delay(10);
  }
}
//********************************************************


/**************************
 * LORA functions
**************************/
void setupLora()
{     
  handleEPPROMReader();
  if(enableDebugPort == true)
  {
    HardwareSerial* debugSerial = &Serial;
    loraBoard.setDebugPort(debugSerial); 
  }
  loraSerial.begin(9600);  
  readNetworkConfig();
  loraBoard.setIOPin(M0Pin, M1Pin, loraUAXPin);
  delay(1000);
  loraBoard.LoraBegin((byte)(networkAddrH), (byte)(networkAddrL), (byte)(networkChanel), lora_power);  
  delay(1000);
  while(loraSerial.available() > 0)
  {       
    if(enableDebugPort == true)
    {
      Serial.println(loraSerial.read(), DEC);
    }
    else
    {
      loraSerial.read();
    }
  }  
  if(enableDebugPort == true)
  {
    sendMessageToGateway("Setup done.");
  }
}

void handleEPPROMReader()
{
  if(reWriteEEPROM == true)
  {   
    if(enableDebugPort == true)
    { 
      Serial.println("re Write EEPROM secondUploadFirmware = 0");
    }
    EEPROM.write(secondUploadFirmware_EEP, 0);
  }   
  secondUploadFirmware = EEPROM.read(secondUploadFirmware_EEP);  
  if(secondUploadFirmware == 0)
  {
    if(enableDebugPort == true)
    { 
      Serial.println("first Upload Firmware");
    }
    EEPROM.write(networkState_EEP, networkState);
    EEPROM.write(networkAddrH_EEP, networkAddrH);
    EEPROM.write(networkAddrL_EEP, networkAddrL);
    EEPROM.write(networkChanel_EEP, networkChanel);
    EEPROM.write(timeSendDataLoop_MIN_EEP, 3);
    EEPROM.write(secondUploadFirmware_EEP, 1); // variable for write epprom again or not
  }
}

void sendMessageToGateway(String mess)
{
  turnOffInterrupt();  
  memset(send_buf, '\0', 128);
  mess.toCharArray(send_buf, 256);
  loraBoard.SendMessage(0x00, 0x00, send_buf);
  blinkDebugLed(2, 150);
  turnOnInterrupt();
}

void configLoraID(char data_buf[], int data_len)
{  
  char serial_key[21];
  strncpy(serial_key, data_buf + 3, 20);
  serial_key[20] = '\0';
  char netKey[3];
  strncpy(netKey, data_buf + 23, 3);
  networkAddrH = data_buf[26];
  networkAddrL = data_buf[27];
  networkChanel = data_buf[28];   
  if(enableDebugPort == true)
  {          
    Serial.print("NEW serial_key: ");  
    Serial.println(serial_key);    
    Serial.println(netKey);
    Serial.print("NEW ID: 0x");  
    Serial.print(networkAddrH, HEX);    
    Serial.println(networkAddrL, HEX);
    Serial.print("NEW networkChanel: 0x");  
    Serial.println(networkChanel, HEX);
  }
  if(String(serial_key) == device_serial_key)
  {
    saveNetworkData(networkAddrH, networkAddrL, networkChanel, netKey); 
    delay(200);
    loraBoard.LoraBegin((byte)(networkAddrH), (byte)(networkAddrL), (byte)(networkChanel), lora_power);
    delay(1500);
    if(loraSerial.available() > 0)
    {       
      if(enableDebugPort == true)
      {
        Serial.println(loraSerial.read(), DEC);
      }
      else
      {
        loraSerial.read();
      }
    }  
    delay(1500);
    if(enableDebugPort == true)
    {
      sendMessageToGateway("Setup new ID done.");
    }
  }
}

void processingLoraMessage(char data_buf[], int data_len)
{
  clearDataBuf();
  if(strstr(data_buf, configLoraIDHeader))
  {
    configLoraID(data_buf, data_len);
  }
  else
  {  
    if(networkState == 1)
    {
      if(strstr(data_buf, networkKey))
      {
        if(strstr(data_buf, updateDataHeader))
        {
          sendDataToCloud();
        }
        else if(strstr(data_buf, UpdateDataHeader_ACK))
              {                
                receiveACK();
              }
              else if(strstr(data_buf, configTimerUpdateHeader))
                    {
                      configTimerUpdate();
                    }
                    else if(strstr(data_buf, requestToRebootHeader))
                        {
                          rebootDevice();
                        }
                        else if(strstr(data_buf, leaveNetworkHeader))
                            {
                              leaveNetwork();
                            }
      }
    }
  }
}

void clearDataBuf()
{
  int idx = 0;
  for(int i = 0; i < data_len; i++)
  {
    if(data_buf[i] != '\0')
    {
      idx = i;
      if(enableDebugPort == true)
      { 
        Serial.print("idx: ");
        Serial.println(idx);
      }
      break;
    }
  }
  for(int i = 0; i < data_len; i++)
  {
    data_buf[i] = data_buf[i+idx];
  }
  printLoraMess(data_buf, data_len);
}

void leaveNetwork()
{
  networkState = 0;
  if(enableDebugPort == true)
  {   
    Serial.println("leaveNetwork...");
    Serial.print("networkState: ");
    Serial.println(networkState);
  }
  EEPROM.write(networkState_EEP, networkState);
}

void rebootDevice()
{
  if(enableDebugPort == true)
  {
    Serial.println("Reseting...");
    delay(100);
//    wdt_enable(WDTO_30MS);
//    delay(10000);
  }
}


void configTimerUpdate()
{
  timeSendDataLoop_MIN = int(data_buf[6]);
  EEPROM.write(timeSendDataLoop_MIN_EEP, timeSendDataLoop_MIN);
  if(enableDebugPort == true)
  {
    Serial.println("configTimerUpdate");
    Serial.println(timeSendDataLoop_MIN);
  }
}

void receiveACK()
{
  if(enableDebugPort == true)
  {
    Serial.println("receiveACK");
  }
  if(gotACK == false)
  {
    char ACK_Receive = data_buf[6];
    if(enableDebugPort == true)
    {
      Serial.print("ACK_Receive: ");
      Serial.println(ACK_Receive, HEX);
      Serial.print("ACKValue: ");
      Serial.println(ACKValue, HEX);
    }
    if(ACK_Receive == ACKValue)
    {
      gotACK = true;
      if(enableDebugPort == true)
      {
        Serial.print("gotACK: ");
        Serial.println(gotACK);
      }
    }
  }
  
}

void sendDataToCloud()
{  
  if(enableDebugPort == true)
  {
    Serial.println("sendDataToCloud");
  }
  sendSensorMessData();
  gotACK = false;  
  if(enableDebugPort == true)
  {
    Serial.print("gotACK: ");
    Serial.println(gotACK);
  }
  timesWakeup = 0;
}

void printLoraMess(char data_buf[], int data_len)
{  
  if(enableDebugPort == true)
  {
    Serial.print("message: ");
    for(int idx=0;idx<data_len;idx++)
    {
      Serial.print(char(data_buf[idx]));
    } 
    Serial.println("");
    Serial.print("HEX: ");
    for(int idx=0;idx<data_len;idx++)
    {
      Serial.print(byte(data_buf[idx]), HEX);
      Serial.print(":");
    } 
    Serial.println("");
  }
}

void saveNetworkData(uint8_t AH, uint8_t AL, uint8_t CN, char netKey[])
{
  networkState = 1;
  networkKey[0] = netKey[0];
  networkKey[1] = netKey[1];
  networkKey[2] = netKey[2];
  networkKey[3] = '\0';
  EEPROM.write(networkState_EEP, 1);
  EEPROM.write(networkAddrH_EEP, AH);
  EEPROM.write(networkAddrL_EEP, AL);
  EEPROM.write(networkChanel_EEP, CN);
  for(int i = 0; i <= 3; i++)
  {
    EEPROM.write((networkKey_EEP + i), networkKey[i]);
  }
  if(enableDebugPort == true)
  { 
    Serial.print("networkState: ");
    Serial.println(networkState);
  }
}

void readNetworkConfig()
{  
  networkState = EEPROM.read(networkState_EEP);    
  networkAddrH = EEPROM.read(networkAddrH_EEP);
  networkAddrL = EEPROM.read(networkAddrL_EEP);
  networkChanel = EEPROM.read(networkChanel_EEP);  
  timeSendDataLoop_MIN = EEPROM.read(timeSendDataLoop_MIN_EEP);  
  for(int i = 0; i <= 3; i++)
  {
    networkKey[i] = EEPROM.read(networkKey_EEP + i); 
  }
  if(enableDebugPort == true)
  {
    Serial.print("networkState: ");    
    Serial.println(networkState);
    Serial.print("networkAddrH: ");    
    Serial.println(networkAddrH, HEX);
    Serial.print("networkAddrL: ");    
    Serial.println(networkAddrL, HEX);
    Serial.print("timeSendDataLoop_MIN: ");    
    Serial.println(timeSendDataLoop_MIN);
    Serial.print("networkKey: ");    
    Serial.println(networkKey);
  }
}


/**************************
 * Sleep handle function
**************************/
void checkButtonWakeUp()
{ 
  if(isButtonWakeup == true)
  {     
    delay(50);
    if(digitalRead(buttonPin) == LOW)
    {
      while(digitalRead(buttonPin) == LOW);
    }
    else
    {
      return;
    }
    sendDataToCloud();
    isButtonWakeup = false;
    isTimerWake = false;
    turnOnInterrupt();
  }
}

void checkLoraWakeUp()
{   
  if(isLoraWakeup == true)
  {     
    delay(100);
    while(digitalRead(buttonPin) == LOW){};
    while(loraSerial.available() < 0)
    {    
      delay(50);
      if(enableDebugPort == true)
      {
        Serial.println(".");
      }
    }
    delay(100);
    if(loraBoard.ReceiveMsg(&ADDR_H, &ADDR_H, data_buf, &data_len)==RET_SUCCESS)
    {  
      blinkDebugLed(2, 200);
      printLoraMess(data_buf, data_len);
      processingLoraMessage(data_buf, data_len);        
    }  
    delay(500);
    isLoraWakeup = false;
    isTimerWake = false;
    turnOnInterrupt();
  }
}

void processingTimerLoop()
{  
  delay(50);
  if(loraSerial.available() > 0)
  {  
    while(loraSerial.available() > 0)
    {
      Serial.write(loraSerial.read());
    }
  }  
  timesWakeup++;
  timeCheckReset++;
  if(enableDebugPort == true)
  {
    Serial.println(timesWakeup);
  }  
//  if((timeCheckReset) >= (timeForReset_DAY*(60*60/8))) //change to reset every 3h
////  if((timeCheckReset) >= (timeForReset_DAY*(30/8))) //change to reset every 3h
//  {    
//    blinkDebugLed(5, 50);
//    rebootDevice();
//  }
  if(networkState == 1)
  {
    if((timesWakeup*8) >= (timeSendDataLoop_MIN*60))
    {    
      sendDataToCloud();
    }
    else if(((timesWakeup*8) >= updateStateTimeout_Sec) && (gotACK == false))
          {    
            sendDataToCloud();
          }
  }
}

void checkTimerWakeUp()
{
  turnOffInterrupt();
  processingTimerLoop();
  turnOnInterrupt();
}

void wakeUpByButton()
{
  turnOffInterrupt();
  if(enableDebugPort == true)
  {
    Serial.println("Wake up by Button.");
  } 
  isButtonWakeup = true;     
}

void wakeUpByLora()
{
  turnOffInterrupt();   
  if(enableDebugPort == true)
  {
    Serial.println("Wake up by lora.");
  }   
  delay(50);
  isLoraWakeup = true;
}

void gotoSleepMode()
{  
  turnOffInterrupt(); 
  if(enableDebugPort == true)
  {
    Serial.println("Sleep\n");
    delay(80);
  }
  turnOnInterrupt();
  LowPower.powerDown(SLEEP_8S, ADC_OFF, BOD_OFF);  
}

void turnOffInterrupt()
{
  detachInterrupt(0);
  detachInterrupt(1);
}

void turnOnInterrupt()
{  
  attachInterrupt(0, wakeUpByButton, LOW);
  attachInterrupt(1, wakeUpByLora, LOW);
}


/**************************
 * function per device
**************************/
char SensorData = "";

void setupForDevice()
{  
}

void sendSensorMessData()
{
  if(networkState == 1)
  {
    char SendBuf[128];
    memset(SendBuf, '\0', 128);
    int lengthMess = 0;    
    String messSend = networkKey + String(markMess_SensorNode) + getAllSensorData_String();
    ACKValue = messSend.length();
    messSend = messSend + char(ACKValue);
    sendMessageToGateway(messSend);
  }
  lastMessageTime = millis();
}


/**************************
 * Support TEST functions
**************************/
void setupLedDebug()
{
  pinMode(led_R, OUTPUT);
  pinMode(led_G, OUTPUT);

  digitalWrite(led_R, HIGH);
  digitalWrite(led_G, HIGH);

}

void blinkDebugLed(int times, int timeDelay)
{
  for(int i = 0; i < times; i++)
  {          
    digitalWrite(led_R, LOW);
    delay(timeDelay/2);
    digitalWrite(led_R, HIGH);
    delay(timeDelay/2);
    digitalWrite(led_G, LOW);
    delay(timeDelay/2);
    digitalWrite(led_G, HIGH);
    delay(timeDelay/2);
  }     
}
