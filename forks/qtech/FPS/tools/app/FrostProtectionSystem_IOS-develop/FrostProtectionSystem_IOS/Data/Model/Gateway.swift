//
//  Gateway.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/29/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps
import ObjectMapper

class Gateway: Mappable {
    
    var id: String = ""
    var publicKey: String?
    var name: String = ""
    var location: CLLocationCoordinate2D?
    var owner: String?
    var deviceIDs = [String]()
    var devices = [Device]()
    
    required init?(map: Map) {
    }
    
    func mapping(map: Map) {
        id <- map[Gateway.firebaseIdKey]
        publicKey <- map[KeyDatabase.Gateway.publicKey]
        name <- map[KeyDatabase.Common.name]
        owner <- map[KeyDatabase.Common.owner]
        var deviceIDsDict: [String: String] = [:]
        deviceIDsDict <- map[KeyDatabase.Gateway.devices]
        deviceIDs = deviceIDsDict.keys.map({ $0 })
        if let devicesDict = map.JSON[KeyDatabase.Gateway.devices] as? [String: Any] {
            devices = Mapper<Device>().mapArray(firebaseDict: devicesDict)
        }
        if let gpsDictionary = map.JSON[KeyDatabase.Gateway.gps] as? [String: Double], let lat = gpsDictionary[KeyDatabase.Gateway.lat], let long = gpsDictionary[KeyDatabase.Gateway.long] {
            location = CLLocationCoordinate2D(latitude: lat, longitude: long)
        }
    }
    
    func sumSensorDevice() -> Int {
        if deviceIDs.filter({ $0.lowercased().contains("seno") }).isEmpty {
            return devices.filter({ $0.id.lowercased().contains("seno") }).count
        } else {
            return deviceIDs.filter({ $0.lowercased().contains("seno") }).count
        }
    }
    
    func sumValvesDevice() -> Int {
        if deviceIDs.filter({ $0.lowercased().contains("vaco") }).isEmpty {
            return devices.filter({ $0.id.lowercased().contains("vaco") }).count
        } else {
            return deviceIDs.filter({ $0.lowercased().contains("vaco") }).count
        }
    }
    
    func getDeviceIDs(type: DeviceType) -> [String] {
        switch type {
        case .sensor:
            if deviceIDs.filter({ $0.lowercased().contains("seno") }).isEmpty {
                return devices.filter({ $0.id.lowercased().contains("seno") }).map({ $0.id })
            } else {
                return deviceIDs.filter({ $0.lowercased().contains("seno") })
            }
        case .valve:
            if deviceIDs.filter({ $0.lowercased().contains("vaco") }).isEmpty {
                return devices.filter({ $0.id.lowercased().contains("vaco") }).map({ $0.id })
            } else {
                return deviceIDs.filter({ $0.lowercased().contains("vaco") })
            }
        }
    }
    
    func getDevice(type: DeviceType) -> [Device] {
        switch type {
        case .sensor:
            return devices.filter({ $0.id.lowercased().contains("seno") })
        case .valve:
            return devices.filter({ $0.id.lowercased().contains("vaco") })
        }
    }
}

// MARK: - Dictionary to CRUD in server
extension Gateway {
    
    class func addNewGatewayDict(gatewayID: String, name: String, location: CLLocationCoordinate2D?, owner: String, publicKey: String) -> [String: Any] {
        let latitude: Any = location == nil ? [] : location!.latitude
        let longitude: Any = location == nil ? [] : location!.longitude
        return [
            PathDatabase.Gateway.publicKey(gatewayID: gatewayID): publicKey,
            PathDatabase.Gateway.name(gatewayID: gatewayID): name,
            PathDatabase.Gateway.owner(gatewayID: gatewayID): owner,
            PathDatabase.Gateway.gps(gatewayID: gatewayID): [
                KeyDatabase.Gateway.lat: latitude,
                KeyDatabase.Gateway.long: longitude,
            ],
            PathDatabase.User.gatewayName(userID: owner, gatewayID: gatewayID): name
        ]
    }
    
    class func deleteGatewayDict(gateway: Gateway, ownerID: String, isDeleteLog: Bool) -> [String: Any] {
        var value: [String: Any] = [
            PathDatabase.Gateway.gatewayDetails(gatewayID: gateway.id): [] ,
            PathDatabase.User.gatewayDetail(userID: ownerID, gatewayID: gateway.id): []
        ]
        for deviceID in gateway.devices.map({ $0.id }) {
            value[PathDatabase.Device.deviceDetails(deviceID: deviceID)] = []
            value[PathDatabase.DeviceLog.deviceLog(deviceID: deviceID)] = []
            if isDeleteLog {
                value[PathDatabase.DeviceLog.deviceLog(deviceID: deviceID)] = []
            }
        }
        return value
    }
}
