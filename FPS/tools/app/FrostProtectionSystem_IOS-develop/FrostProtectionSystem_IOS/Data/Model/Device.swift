//
//  Sensor.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/3/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import ObjectMapper
import GoogleMaps

enum Direction: String, CaseIterable {
    case n = "North"
    case ne = "Northeast"
    case e = "East"
    case se = "Southeast"
    case s = "South"
    case sw = "Southwest"
    case w = "West"
    case nw = "Northwest"
}

extension Direction: CustomStringConvertible  {
    
    init(_ direction: Double) {
        let index = Int((direction + 22.5).truncatingRemainder(dividingBy: 360) / 45.0)
        self = Direction.allCases[index]
    }
    
    var description: String {
        return rawValue.localized()
    }
}

class Device: Mappable {
    
    var id = ""
    var publicKey: String?
    var name = ""
    var location: CLLocationCoordinate2D?
    var loraID = ""
    var owner = ""
    var ownerPublicKey: String?
    var isOn: Bool?
    var timestamp: Double?
    var deviceData: DeviceData?
    
    required init?(map: Map) {
    }
    
    func mapping(map: Map) {
        id <- map[Device.firebaseIdKey]
        publicKey <- map[KeyDatabase.Device.publicKey]
        name <- map[KeyDatabase.Common.name]
        loraID <- map[KeyDatabase.Device.loraID]
        owner <- map[KeyDatabase.Common.owner]
        ownerPublicKey <- map[KeyDatabase.Device.ownerPublicKey]
        timestamp <- map[KeyDatabase.Device.timestamp]
        isOn <- map[KeyDatabase.Device.isOn]
        
        if let gpsDictionary = map.JSON[KeyDatabase.Device.gps] as? [String: Double], let lat = gpsDictionary[KeyDatabase.Device.lat], let long = gpsDictionary[KeyDatabase.Device.long] {
            location = CLLocationCoordinate2D(latitude: lat, longitude: long)
        }
        if let currentDataDictionary = map.JSON[KeyDatabase.Device.currentData] as? [String: Any] {
            deviceData = DeviceData(JSON: currentDataDictionary)
        }
    }
    
    func type() -> DeviceType {
        return self.id.lowercased().contains("vaco") ? .valve : .sensor
    }
}

extension Device {
    
    class func checkIdIsDeviceType(id: String) -> Bool {
        return id.lowercased().contains("vaco") || id.lowercased().contains("seno")
    }
    
    class func addNewDeviceDict(userID: String, gatewayID: String, serialKeyGateway: String, deviceID: String, name: String, serialKey: String, location: CLLocationCoordinate2D?) -> [String: Any] {
        let latitude: Any = location == nil ? [] : location!.latitude
        let longitude: Any = location == nil ? [] : location!.longitude
        return [
            PathDatabase.Gateway.deviceName(gatewayID: gatewayID, deviceID: deviceID): name,
            PathDatabase.Gateway.deviceGPS(gatewayID: gatewayID, deviceID: deviceID): [
                KeyDatabase.Gateway.lat: latitude,
                KeyDatabase.Gateway.long: longitude,
            ],
            PathDatabase.Device.name(deviceID: deviceID): name,
            PathDatabase.Device.gps(deviceID: deviceID): [
                KeyDatabase.Gateway.lat: latitude,
                KeyDatabase.Gateway.long: longitude,
            ],
            PathDatabase.Device.publicKey(deviceID: deviceID): serialKey,
            PathDatabase.Device.owner(deviceID: deviceID): gatewayID,
            PathDatabase.Device.ownerPublicKey(deviceID: deviceID): serialKeyGateway,
            PathDatabase.User.deviceOfGateway(userID: userID, gatewayID: gatewayID, deviceID: deviceID): "",
        ]
    }
    
    class func deleteDeviceDict(userID: String, gatewayID: String, deviceID: String, isDeleteLog: Bool) -> [String: Any] {
        var value: [String: Any] = [
            PathDatabase.Gateway.command(gatewayID: gatewayID): Constants.Command.deleteDevice(deviceID: deviceID),
            PathDatabase.Gateway.deviceDetails(gatewayID: gatewayID, deviceID: deviceID): [],
            PathDatabase.Device.deviceDetails(deviceID: deviceID): [],
            PathDatabase.User.deviceOfGateway(userID: userID, gatewayID: gatewayID, deviceID: deviceID): []
        ]
        if isDeleteLog {
            value[PathDatabase.DeviceLog.deviceLog(deviceID: deviceID)] = []
        }
        return value
    }
}
