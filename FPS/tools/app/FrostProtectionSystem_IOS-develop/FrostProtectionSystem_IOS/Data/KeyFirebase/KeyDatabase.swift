//
//  KeyDatabase.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/24/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

enum KeyDatabase {
    
    enum Common {
        static let id = "id"
        static let name = "name"
        static let owner = "owner"
    }
    
    enum User {
        static let name = "user_name"
        static let email = "email"
    }
    
    enum Gateway {
        static let publicKey = "public_key"
        static let devices = "devices"
        static let gps = "GPS"
        static let lat = "lat"
        static let long = "long"
    }
    
    enum Device {
        static let publicKey = "public_key"
        static let ownerPublicKey = "owner_public_key"
        static let loraID = "lora_id"
        static let gps = "GPS"
        static let lat = "lat"
        static let long = "long"
        static let timestamp = "TS"
        static let isOn = "on"
        static let currentData = "current_data"
        static let data = "data"
        static let windSpeed = "wsp"
        static let windDirection = "wdr"
        static let airPressure = "prA"
        static let waterPressure = "prW"
        static let temp1 = "tp1"
        static let temp2 = "tp2"
        static let humidity = "hum"
        static let soilMoisture = "soi"
        static let battery = "bat"
    }
    enum QRCode {
        static let serial = "serial"
    }
}

enum PathDatabase {
    
    enum User {
        static func userPath(userID: String) -> String {
            return "users/\(userID)"
        }
        static func userName(userID: String) -> String {
            return "users/\(userID)/user_name"
        }
        static func gateways(userID: String) -> String {
            return "users/\(userID)/gateways"
        }
        static func email(userID: String) -> String {
            return "users/\(userID)/email"
        }
        static func gatewayDetail(userID: String, gatewayID: String) -> String {
            return "users/\(userID)/gateways/\(gatewayID)"
        }
        static func gatewayName(userID: String, gatewayID: String) -> String {
            return "users/\(userID)/gateways/\(gatewayID)/name"
        }
        static func deviceOfGateway(userID: String, gatewayID: String, deviceID: String) -> String {
            return "users/\(userID)/gateways/\(gatewayID)/devices/\(deviceID)"
        }
    }
    
    enum Device {
        static func deviceDetails(deviceID: String) -> String {
            return "devices/\(deviceID)"
        }
        static func name(deviceID: String) -> String {
            return "devices/\(deviceID)/name"
        }
        static func gps(deviceID: String) -> String {
            return "devices/\(deviceID)/GPS"
        }
        static func publicKey(deviceID: String) -> String {
            return "devices/\(deviceID)/public_key"
        }
        static func owner(deviceID: String) -> String {
            return "devices/\(deviceID)/owner"
        }
        static func ownerPublicKey(deviceID: String) -> String {
            return "devices/\(deviceID)/owner_public_key"
        }
    }
    
    enum Gateway {
        static func gatewayDetails(gatewayID: String) -> String {
            return "gateways/\(gatewayID)"
        }
        static func publicKey(gatewayID: String) -> String {
            return "gateways/\(gatewayID)/public_key"
        }
        static func owner(gatewayID: String) -> String {
            return "gateways/\(gatewayID)/owner"
        }
        static func name(gatewayID: String) -> String {
            return "gateways/\(gatewayID)/name"
        }
        static func gps(gatewayID: String) -> String {
            return "gateways/\(gatewayID)/GPS"
        }
        static func command(gatewayID: String) -> String {
            return "gateways/\(gatewayID)/command"
        }
        // devices
        static func devices(gatewayID: String) -> String {
            return "gateways/\(gatewayID)/devices"
        }
        static func deviceDetails(gatewayID: String, deviceID: String) -> String {
            return "gateways/\(gatewayID)/devices/\(deviceID)"
        }
        static func deviceName(gatewayID: String, deviceID: String) -> String {
            return "gateways/\(gatewayID)/devices/\(deviceID)/name"
        }
        static func deviceGPS(gatewayID: String, deviceID: String) -> String {
            return "gateways/\(gatewayID)/devices/\(deviceID)/GPS"
        }
    }
    
    enum QRCode {
        static func qrCode(qrCode: String) -> String {
            return "key/\(qrCode)"
        }
    }
    
    enum DeviceLog {
        static func deviceLog(deviceID: String) -> String {
            return "device_logs/\(deviceID)"
        }
    }
}
