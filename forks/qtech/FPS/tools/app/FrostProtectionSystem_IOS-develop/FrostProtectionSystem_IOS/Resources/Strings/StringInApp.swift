//
//  StringInApp.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import Foundation

enum Strings {
    enum Main {
        static let appName = "Frost Protection System"
        static var yes: String { return "Yes".localized() }
        static var no: String { return "No".localized() }
        static var done: String { return "Done".localized() }
        static var cancel: String { return "Cancel".localized() }
        static var home: String { return "Home".localized() }
        static var unknow: String { return "unknow".localized() }
        static var pleaseWait: String { return "Please wait...".localized() }
        static var somethingWrong: String { return "Something wrong!".localized() }
    }
    
    enum Navigation {
        static var home: String { return "Home".localized() }
        static var scanQRCode: String { return "Scan QR code".localized() }
        static var mapGatewaysAndDevices: String { return "Map of gateways/devices".localized() }
        static var setting: String { return "Settings".localized() }
        static var feedback: String { return "Feedback".localized() }
        static var information: String { return "Information".localized() }
        static func gateways(value: Int) -> String {
            return "%d Gateways".localizeWithFormat(arguments: value)
        }
        static func devices(value: Int) -> String {
            return "%d Devices".localizeWithFormat(arguments: value)
        }
    }
    
    enum Gateway {
        static var devives: String { return "%d devices".localized() }
        static var gatewayDeleted: String { return "This gateway has been deleted.".localized() }
        static var gatewayNotExists: String { return "This gateway not exists.".localized() }
        static var nameCannotEmpty: String { return "Name can not be empty".localized() }
        static var selectGateway: String { return "Select a gateway, please.".localized() }
        static var serialKeyCannotEmpty: String { return "Serial key not be empty".localized() }
        static var addNewGatewaySuccess: String { return "Add new gateway success.".localized() }
        static var serialIDIncorrect: String { return "Serial ID incorrect.".localized() }
        static var pleaseEnterCoordinates: String { return "Please enter latitude and longitude coordinates.".localized() }
        static var editGatewaySuccess: String { return "Edit gateway success.".localized() }
        static var confirmDeleteAllDataOfDevices: String { return "Do you want to delete all data of the device?".localized() }
        static func gatewayID(id: String) -> String {
            return "Gateway ID: %@".localizeWithFormat(arguments: id)
        }
    }
    
    enum Register {
        static var registerSuccess: String { return "Resiger success".localized() }
        static var emailCannotEmpty: String { return "Email can not be empty".localized() }
        static var wrongEmailFormat: String { return "Wrong email format".localized() }
        static var passwordCannotEmpty: String { return "Password can not be empty".localized() }
        static var lengthPasswordIncorrect: String { return "The length of the password must be 6 characters or more".localized() }
        static var nameCannotEmpty: String { return "Name can not be empty".localized() }
    }
    
    enum ForgotPassword {
        static var pleaseCheckMailResetPassword: String { return "Please check mail to reset password".localized() }
        static var doYouWantCheckMail: String { return "We sent a reset password link to your email. Do you want to check it?".localized() }
    }
    
    enum DateTimeDistance {
        static func minutesAgo(number: Int) -> String {
            return "MinutesAgo".localizePlural(number: number)
        }
        static func hoursAgo(number: Int) -> String {
            return "HoursAgo".localizePlural(number: number)
        }
        static func daysAgo(number: Int) -> String {
            return "DaysAgo".localizePlural(number: number)
        }
        static func monthsAgo(number: Int) -> String {
            return "MonthsAgo".localizePlural(number: number)
        }
        static func yearsAgo(number: Int) -> String {
            return "YearsAgo".localizePlural(number: number)
        }
        static var fewSecondAgo: String { return "A few seconds ago".localized() }
    }
    
    enum Device {
        static var windSpeed: String { return "Wind Speed".localized() }
        static var windDirection: String { return "Wind Direction".localized() }
        static var airPressure: String { return "Air Pressure".localized() }
        static var waterPressure: String { return "Water Pressure".localized() }
        static var temp1: String { return "Temp 1".localized() }
        static var temp2: String { return "Temp 2".localized() }
        static var humidity: String { return "Humidity".localized() }
        static var soilMoisture: String { return "Soil Moisture".localized() }
        static var battery: String { return "Battery".localized() }
        
        static var on: String { return "ON".localized() }
        static var off: String { return "OFF".localized() }
        static var addDevice: String { return "Add device".localized() }
        static var addNewDeviceSuccess: String { return "Add new device success.".localized() }
        static var deviceNotExists: String { return "This device not exists.".localized() }
        static var deviceDeleted: String { return "This device has been deleted.".localized() }
        static var editDeviceSuccess: String { return "Edit device success.".localized() }
        static var loraIDMustHave4CharactersAndCorrectFormat: String { return "Lora ID must have 4 characters, only contain 0-9, A-F, a-f".localized() }
        static func lastUpdate(time: String) -> String {
            return "Last update: %@".localizeWithFormat(arguments: time)
        }
        static func gatewayID(gatewayID: String) -> String {
            return "Gateway ID: %@".localizeWithFormat(arguments: gatewayID)
        }
        static func deviceID(deviceID: String) -> String {
            return "Device ID: %@".localizeWithFormat(arguments: deviceID)
        }
        static func historyData(time: String, isOne: Bool) -> String {
            let status = isOne ? "On".localized() : "Off".localized()
            return "\(status): %@".localizeWithFormat(arguments: time)
        }
    }
    
    enum AddGateway {
        static var addGateway: String { return "Add new gateway".localized() }
    }
    
    enum ScanQRCode {
        static var scanQRCode: String { return "Scan QR Code".localized() }
        static var notFoundGatewayOrDevice: String { return "Not found a gateway or device".localized() }
        static var afterScan: String { return "After scan".localized() }
        static var qrCodeIncorrect: String { return "QR Code incorrect".localized() }
    }
    
    enum Information {
        static var information: String { return "Information".localized() }
    }
    
    enum Map {
        static var map: String { return "Map".localized() }
        static var select: String { return "Select".localized() }
        static var selectCoodinates: String { return "Select coodinates".localized() }
    }
    
    enum Chart {
        static func start(date: String) -> String {
            return "Start: %@".localizeWithFormat(arguments: date)
        }
        static func end(date: String) -> String {
            return "End: %@".localizeWithFormat(arguments: date)
        }
    }
}
