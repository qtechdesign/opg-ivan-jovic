#include <OneWire.h>
#include <DallasTemperature.h>
#include "QT_SHT3x.h"


/**************************
 * config 
**************************/
const int sensorsPowerPin = 35;
int timesReadSensor = 25;

#define DS18B20_1_DATAPIN 32
#define DS18B20_2_DATAPIN 33
OneWire Temperature_1(DS18B20_1_DATAPIN);
OneWire Temperature_2(DS18B20_2_DATAPIN);
DallasTemperature Temperature_Sensor_1(&Temperature_1);
DallasTemperature Temperature_Sensor_2(&Temperature_2);

// Specify data and clock connections and instantiate SHT3x object
#define soil_Moisture_clockPin  42
#define soil_Moisture_dataPin   43

#define SHT30_Air_clockPin     44
#define SHT30_Air_dataPin      45

SHT3x Air_Humidity_Sensor;
SHT3x soil_Moisture_Sensor;

#define win_Direction_Pin A3
#define win_Speed_Pin A2
#define battery_Value_Pin A6
#define air_pressure_Data_pin A0
#define water_pressure_Data_pin A1

#define deviationAngle 0.00

#define enLevelPin 41
/**************************
 * setup sensor
**************************/
void setupSensors()
{
  pinMode(sensorsPowerPin, OUTPUT);
  digitalWrite(sensorsPowerPin, HIGH);
  pinMode (enLevelPin,OUTPUT);
  digitalWrite(enLevelPin,HIGH);
  Temperature_Sensor_1.begin();
  Temperature_Sensor_2.begin();
  soil_Moisture_Sensor.Begin(soil_Moisture_dataPin, soil_Moisture_clockPin);
  Air_Humidity_Sensor.Begin(SHT30_Air_dataPin, SHT30_Air_clockPin);
}

void turnOnSensorPower()
{
  digitalWrite(sensorsPowerPin, LOW);
}

void turnOffSensorPower()
{
  digitalWrite(sensorsPowerPin, HIGH);
}


/**************************
 * getdata (nunber)
**************************/
float get_Soil_Moisture_Data()
{
  float soilMoistureData;
  soil_Moisture_Sensor.UpdateData();
  soilMoistureData = soil_Moisture_Sensor.GetRelHumidity();
  if (soilMoistureData > 100)
  {
    soilMoistureData = 100;
  }
  if (soilMoistureData < 0)
  {
    soilMoistureData = 0;
  }
  if (enableDebugPort == true)
  {
    Serial.print("soilMoistureData : ");
    Serial.print(soilMoistureData);
    Serial.println("%");
  }
  return soilMoistureData;
}

float get_Temperature_Data_1()
{
  Temperature_Sensor_1.requestTemperatures();
  float temp = Temperature_Sensor_1.getTempCByIndex(0);
  if (temp > 99)
  {
    temp = 99;
  }
  if (temp < -99)
  {
    temp = -99;
  }
  if (enableDebugPort == true)
  {
    Serial.print("Temp 1: ");
    Serial.println(temp);
  }
  return temp;
}

float get_Temperature_Data_2()
{
  Temperature_Sensor_2.requestTemperatures();
  float temp = Temperature_Sensor_2.getTempCByIndex(0);
  if (temp > 99)
  {
    temp = 99;
  }
  if (temp < -99)
  {
    temp = -99;
  }
  if (enableDebugPort == true)
  {
    Serial.print("Temp 2: ");
    Serial.println(temp);
  }
  return temp;
}

float get_Humidity_Data()
{
  float humidity;
  Air_Humidity_Sensor.UpdateData();
  humidity = Air_Humidity_Sensor.GetRelHumidity();
  if (humidity > 100)
  {
    humidity = 100;
  }
  if (humidity < 0)
  {
    humidity = 0;
  }
  if (enableDebugPort == true)
  {
    Serial.print("Air Humidity: ");
    Serial.print(humidity);
    Serial.println("%");
  }
  return humidity;
}

float get_Win_Direction_Data()
{
  int analogData = 0;
  for (int i = 0; i < timesReadSensor; i++)
  {
    analogData += analogRead(win_Direction_Pin);
  }
  analogData = analogData / timesReadSensor;
  analogData = (analogData > 512) ? 512 : analogData;
  float winDirectionData = (map(analogData, 0, 512, 0, 36000)) / 100.0;
  winDirectionData = (winDirectionData >= deviationAngle) ? (winDirectionData - deviationAngle) : ((360 - deviationAngle) + winDirectionData);
  if (winDirectionData > 360)
  {
    winDirectionData = 360;
  }
  if (winDirectionData < 0)
  {
    winDirectionData = 0;
  }
  if (enableDebugPort == true)
  {
    Serial.print("winDirectionData : ");
    Serial.println(winDirectionData);
  }
  return winDirectionData;
}

float get_Win_Speed_Data()
{
  int analogData = 0;
  for (int i = 0; i < timesReadSensor; i++)
  {
    analogData += analogRead(win_Speed_Pin);
  }
  analogData = analogData / timesReadSensor;
  analogData = (analogData > 512) ? 512 : analogData;
  float winSpeedData = (map(analogData, 0, 512, 0, 7000)) / 100.00;
  if (winSpeedData > 99)
  {
    winSpeedData = 99;
  }
  if (winSpeedData < 0)
  {
    winSpeedData = 0;
  }
  if (enableDebugPort == true)
  {
    Serial.print("winSpeedData : ");
    Serial.print(winSpeedData);
    Serial.println(" :m/s ");
  }
  return winSpeedData;
}

float get_battery_Value()
{
  int analogData = 0;
  for (int i = 0; i < timesReadSensor; i++)
  {
    analogData += analogRead(battery_Value_Pin);
  }
  analogData = analogData / timesReadSensor;
  float batteryValue = float(analogData) * 5 / 1023 / 4.7 * 14.7; //ressistor = 1/4 VCC
  if (batteryValue > 99)
  {
    batteryValue = 99;
  }
  if (batteryValue < 0)
  {
    batteryValue = 0;
  }
  if (enableDebugPort == true)
  {
    Serial.print("batteryValue : ");
    Serial.println(batteryValue);
  }
  return batteryValue;
}

float get_Air_Pressure_Data()
{
  int analogData = 0;
  for (int i = 0; i < timesReadSensor; i++)
  {
    analogData += analogRead(air_pressure_Data_pin);
  }
  analogData = analogData / timesReadSensor;
  analogData = (analogData > 923) ? 923 : analogData;
  float pressureData = (map(analogData, 102, 923, 0, 2500000)) / 100000.00; // mPa to Bar
  pressureData = (pressureData <= 0) ? 0 : pressureData;
  if (pressureData > 99)
  {
    pressureData = 99;
  }
  if (enableDebugPort == true)
  {
    Serial.print("air pressureData : ");
    Serial.println(pressureData);
  }
  return pressureData;
}

float get_Water_Pressure_Data()
{
  int analogData = 0;
  for (int i = 0; i < timesReadSensor; i++)
  {
    analogData += analogRead(water_pressure_Data_pin);
  }
  analogData = analogData / timesReadSensor;
  analogData = (analogData > 923) ? 923 : analogData;
  float pressureData = (map(analogData, 102, 923, 0, 1200000)) / 100000.00; // mPa to Bar
  pressureData = (pressureData <= 0) ? 0 : pressureData;
  if (pressureData > 99)
  {
    pressureData = 99;
  }
  if (enableDebugPort == true)
  {
    Serial.print(" water pressureData : ");
    Serial.println(pressureData);
  }
  return pressureData;
}

/**************************
 * getdata (string)
**************************/
String getWindSpeed_String()
{
  String dataMess = "";
  String data = String(int(get_Win_Speed_Data() * 100));
  for (int i = data.length(); i < 4; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getWindDirect_String()
{
  String dataMess = "";
  String data = String(int(get_Win_Direction_Data()));
  for (int i = data.length(); i < 3; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getAirPressure_String()
{
  String dataMess = "";
  String data = String(int(get_Air_Pressure_Data() * 100));
  for (int i = data.length(); i < 4; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getWaterPressure_String()
{
  String dataMess = "";
  String data = String(int(get_Water_Pressure_Data() * 100));
  for (int i = data.length(); i < 4; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getSoilMois_String()
{
  String dataMess = "";
  String data = String(int(get_Soil_Moisture_Data()));
  for (int i = data.length(); i < 3; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getHumi_String()
{
  String dataMess = "";
  String data = String(int(get_Humidity_Data()));
  for (int i = data.length(); i < 3; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getTemp1_String()
{
  String dataMess = "";
  float temp = get_Temperature_Data_1();
  if (temp > 0)
  {
    dataMess = dataMess + "+";
  }
  else
  {
    dataMess = dataMess + "-";
    temp = temp * (-1);
  }
  String data = String(int(temp * 10));
  for (int i = data.length(); i < 3; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getTemp2_String()
{
  String dataMess = "";
  float temp = get_Temperature_Data_2();
  if (temp > 0)
  {
    dataMess = dataMess + "+";
  }
  else
  {
    dataMess = dataMess + "-";
    temp = temp * (-1);
  }
  String data = String(int(temp * 10));
  for (int i = data.length(); i < 3; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getBattery_String()
{
  String dataMess = "";
  String data = String(int(get_battery_Value() * 100));
  for (int i = data.length(); i < 4; i++)
  {
    dataMess = dataMess + "0";
  }
  dataMess = dataMess + data;
  return dataMess;
}

String getAllSensorData_String()
{
  turnOnSensorPower();
  blinkDebugLed(2, 150);
  getTemp1_String();
  getTemp2_String();
  getSoilMois_String();
  getHumi_String();
  blinkDebugLed(2, 150);
  String dataMess = "";
  dataMess = getWindSpeed_String() + getWindDirect_String() + getAirPressure_String() + getWaterPressure_String() + getSoilMois_String() + getHumi_String() + getTemp1_String() + getTemp2_String() + getBattery_String();
  if (enableDebugPort == true)
  {
    Serial.print("dataMess : ");
    Serial.println(dataMess);
  }
  turnOffSensorPower();
  blinkDebugLed(1, 150);
  return dataMess;
}
