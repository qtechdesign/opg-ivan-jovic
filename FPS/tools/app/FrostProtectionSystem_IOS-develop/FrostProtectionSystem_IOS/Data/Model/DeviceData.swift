//
//  DeviceData.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/20/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import ObjectMapper
import GoogleMaps

class DeviceData: Mappable {
    
    enum DeviceDataType: Int, CaseIterable {
        case windSpeed
        case windDirection
        case airPressure
        case waterPressure
        case temp1
        case temp2
        case humidity
        case soilMoisture
        case battery
        
        func icon() -> UIImage {
            switch self {
            case .windSpeed:
                return #imageLiteral(resourceName: "ic_wind_speed.pdf")
            case .windDirection:
                return #imageLiteral(resourceName: "ic_wind_direction.pdf")
            case .airPressure:
                return #imageLiteral(resourceName: "ic_meter.pdf")
            case .waterPressure:
                return #imageLiteral(resourceName: "ic_meter.pdf")
            case .temp1:
                return #imageLiteral(resourceName: "ic_temperature.pdf")
            case .temp2:
                return #imageLiteral(resourceName: "ic_temperature.pdf")
            case .humidity:
                return #imageLiteral(resourceName: "ic_humidity.pdf")
            case .soilMoisture:
                return #imageLiteral(resourceName: "ic_farming.pdf")
            case .battery:
                return #imageLiteral(resourceName: "ic_battery.pdf")
            }
        }
        
        func title() -> String {
            switch self {
            case .windSpeed:
                return Strings.Device.windSpeed + ":"
            case .windDirection:
                return Strings.Device.windDirection + ":"
            case .airPressure:
                return Strings.Device.airPressure + ":"
            case .waterPressure:
                return Strings.Device.waterPressure + ":"
            case .temp1:
                return Strings.Device.temp1 + ":"
            case .temp2:
                return Strings.Device.temp2 + ":"
            case .humidity:
                return Strings.Device.humidity + ":"
            case .soilMoisture:
                return Strings.Device.soilMoisture + ":"
            case .battery:
                return Strings.Device.battery + ":"
            }
        }
        
        func localize() -> String {
            switch self {
            case .windSpeed:
                return Strings.Device.windSpeed
            case .windDirection:
                return Strings.Device.windDirection
            case .airPressure:
                return Strings.Device.airPressure
            case .waterPressure:
                return Strings.Device.waterPressure
            case .temp1:
                return Strings.Device.temp1
            case .temp2:
                return Strings.Device.temp2
            case .humidity:
                return Strings.Device.humidity
            case .soilMoisture:
                return Strings.Device.soilMoisture
            case .battery:
                return Strings.Device.battery
            }
        }
    }
    
    class Data {
        var value: String
        var type: DeviceDataType
        
        init(value: String, type: DeviceDataType) {
            self.value = value
            self.type = type
        }
    }
    
    var timestamp: Double?
    var id: String?
    var isOn: Bool?
    var datas: [Data] {
        get {
            var datas = [Data]()
            if let windSpeed = windSpeed {
                let value = String(format: "%.2f", windSpeed) + " m/s"
                let data = Data(value: value, type: .windSpeed)
                datas.append(data)
            }
            if let windDirection = windDirection {
                let value = "\(Direction(Double(windDirection)).description)"
                let data = Data(value: value, type: .windDirection)
                datas.append(data)
            }
            if let airPressure = airPressure {
                let value = String(format: "%.2f", airPressure) + " Bar"
                let data = Data(value: value, type: .airPressure)
                datas.append(data)
            }
            if let waterPressure = waterPressure {
                let value = String(format: "%.2f", waterPressure) + " Bar"
                let data = Data(value: value, type: .waterPressure)
                datas.append(data)
            }
            if let temp1 = temp1 {
                let value = String(format: "%.1f", temp1) + " *C"
                let data = Data(value: value, type: .temp1)
                datas.append(data)
            }
            if let temp2 = temp2 {
                let value = String(format: "%.1f", temp2) + " *C"
                let data = Data(value: value, type: .temp2)
                datas.append(data)
            }
            if let humidity = humidity {
                let value = "\(humidity)" + "%"
                let data = Data(value: value, type: .humidity)
                datas.append(data)
            }
            if let soilMoisture = soilMoisture {
                let value = "\(soilMoisture)" + "%"
                let data = Data(value: value, type: .soilMoisture)
                datas.append(data)
            }
            if let battery = battery {
                let value = String(format: "%.1f", battery) + "V"
                let data = Data(value: value, type: .battery)
                datas.append(data)
            }
            return datas
        }
    }
    var windSpeed: CGFloat?
    var windDirection: Int?
    var airPressure: CGFloat?
    var waterPressure: CGFloat?
    var temp1: CGFloat?
    var temp2: CGFloat?
    var humidity: Int?
    var soilMoisture: Int?
    var battery: CGFloat?
    
    required init?(map: Map) {
    }
    
    func mapping(map: Map) {
        id <- map[DeviceData.firebaseIdKey]
        timestamp <- map[KeyDatabase.Device.timestamp]
        var dataValue = ""
        dataValue <- map[KeyDatabase.Device.data]
        dataValue = dataValue.lowercased()
        if dataValue == "on" {
            isOn = true
        } else if dataValue == "off" {
            isOn = false
        }
        guard let dataDict = map.JSON[KeyDatabase.Device.data] as? [String: Any] else { return }
        windSpeed = dataDict[KeyDatabase.Device.windSpeed] as? CGFloat
        windDirection = dataDict[KeyDatabase.Device.windDirection] as? Int
        airPressure = dataDict[KeyDatabase.Device.airPressure] as? CGFloat
        waterPressure = dataDict[KeyDatabase.Device.waterPressure] as? CGFloat
        temp1 = dataDict[KeyDatabase.Device.temp1] as? CGFloat
        temp2 = dataDict[KeyDatabase.Device.temp2] as? CGFloat
        humidity = dataDict[KeyDatabase.Device.humidity] as? Int
        soilMoisture = dataDict[KeyDatabase.Device.soilMoisture] as? Int
        battery = dataDict[KeyDatabase.Device.battery] as? CGFloat
    }
}
