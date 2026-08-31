#include <OneWire.h>
#include <DallasTemperature.h>

/**************************
 * config 
**************************/
int timesReadSensor = 25;

#define DS18B20_1_DATAPIN 5
#define DS18B20_2_DATAPIN 11
OneWire Temperature_1(DS18B20_1_DATAPIN);
OneWire Temperature_2(DS18B20_2_DATAPIN);
DallasTemperature Temperature_Sensor_1(&Temperature_1);
DallasTemperature Temperature_Sensor_2(&Temperature_2);

#define battery_Value_Pin A0
#define air_pressure_Data_pin A1
#define water_pressure_Data_pin A2

//static String dataMess = "";
  
/**************************
 * setup sensor
**************************/
void setupSensors()
{
  Temperature_Sensor_1.begin();
  Temperature_Sensor_2.begin();
}


/**************************
 * getdata (nunber)
**************************/
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
    Serial.print("T1: ");
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
    Serial.print("T2: ");
    Serial.println(temp);
  }
  return temp;
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
    Serial.print("batt: ");
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
    Serial.print("air : ");
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
  delay(150);
  getTemp1_String();
  getTemp2_String();
  delay(150);
  String output = "";
  output = getAirPressure_String() + getWaterPressure_String() + getTemp1_String() + getTemp2_String() + getBattery_String();
  if (enableDebugPort == true)
  {
    Serial.print("getAllSensorData_String output: ");
    Serial.println(output);
  }
  return output;
}
