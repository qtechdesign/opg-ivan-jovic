//
//  Constants.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

enum Constants {
    
    enum App {
        static func openMail() {
            guard let mailURL = URL(string: "message://"), UIApplication.shared.canOpenURL(mailURL) else { return }
            UIApplication.shared.open(mailURL, options: [:], completionHandler: nil)
        }
    }
    
    enum Validate {
        static let minLengthPassword: Int = 6
    }
    
    enum KeyInfo {
        static let googleMapApiKey = "GoogleMapApiKey"
    }
    
    enum Command {
        static func refresh(deviceID: String) -> String {
            return "F5_Data: {'key':'\(deviceID)'}"
        }
        static func status(deviceID: String, isOn: Bool) -> String {
            let status = isOn ? "ON" : "OFF"
            return "controlDevice: {'key':'\(deviceID)', 'status':'\(status)'}"
        }
        static func addDevice(deviceID: String, loraID: String) -> String {
            return "UPDevice: {'key':'\(deviceID)','lora_ID':'\(loraID)'}"
        }
        static func editDevice(deviceID: String, loraID: String) -> String {
            return "UPDevice: {'key':'\(deviceID)','lora_ID':'\(loraID)'}"
        }
        static func deleteDevice(deviceID: String) -> String {
            return "removeDevice: {'key':'\(deviceID)'}"
        }
    }
}
