//
//  GateWayTableViewCell.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/27/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class GateWayTableViewCell: UITableViewCell {

    @IBOutlet private weak var iconImageView: UIImageView!
    @IBOutlet private weak var dashLineView: UIView!
    @IBOutlet private weak var gatewayNameLabel: UILabel!
    @IBOutlet private weak var sumDevicesLabel: UILabel!
    @IBOutlet private weak var statusLabel: UILabel!
    
    private static let oneLine = 1
    private static let twoLine = 2
    
    override func awakeFromNib() {
        super.awakeFromNib()
        dashLineView.addDashedLineCenterVertical()
    }
    
    func setup(gateway: Gateway) {
        gatewayNameLabel.text = gateway.name
        sumDevicesLabel.text = Strings.Gateway.devives.localizeWithFormat(arguments: gateway.deviceIDs.count)
    }
    
    func setup(gateway: Gateway?, type: DeviceType) {
        self.gatewayNameLabel.text = type.title()
        self.iconImageView.image = type.image()
        var sumDevices = 0
        if let gateway = gateway {
            sumDevices = type == .sensor ? gateway.sumSensorDevice() : gateway.sumValvesDevice()
        }
        self.sumDevicesLabel.text = Strings.Gateway.devives.localizeWithFormat(arguments: sumDevices)
    }
    
    func setup(device: Device, type: DeviceType) {
        if type == .valve, let isOn = device.isOn {
            self.gatewayNameLabel.numberOfLines = GateWayTableViewCell.oneLine
            self.statusLabel.text = isOn ? Strings.Device.on : Strings.Device.off
            self.statusLabel.textColor = isOn ? .green : .red
            self.gatewayNameLabel.text = device.name + ":"
        } else {
            self.gatewayNameLabel.numberOfLines = GateWayTableViewCell.twoLine
            self.statusLabel.text = ""
            self.gatewayNameLabel.text = device.name
        }
        self.iconImageView.image = type.image()
        self.sumDevicesLabel.isHidden = false
        if let timestamp = device.timestamp {
            let date = Date(timeIntervalSince1970: timestamp)
            self.sumDevicesLabel.text = getDistanceDateChange(date: date)
        } else {
            self.sumDevicesLabel.text = Strings.Main.unknow
            self.sumDevicesLabel.isHidden = true
        }
    }
    
    private func getDistanceDateChange(date: Date) -> String {
        let minutesAgo = Date().minutesFrom(date: date)
        let hoursAgo = Date().hoursFrom(date: date)
        let daysAgo = Date().daysFrom(date: date)
        let yearsAgo = Date().yearsFrom(date: date)
        if yearsAgo != 0 {
            return Strings.DateTimeDistance.yearsAgo(number: yearsAgo)
        }
        if daysAgo != 0 {
            return Strings.DateTimeDistance.daysAgo(number: daysAgo)
        }
        if hoursAgo != 0 {
            return Strings.DateTimeDistance.hoursAgo(number: hoursAgo)
        }
        if minutesAgo != 0 {
            return Strings.DateTimeDistance.minutesAgo(number: minutesAgo)
        }
        return Strings.DateTimeDistance.fewSecondAgo
    }
}
