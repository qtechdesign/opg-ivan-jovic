//
//  SensorNodeDetailsContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/8/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol SensorNodeDetailsIView: class, BaseIView {
    func requestDeviceDetailsSuccess(device: Device)
    func deviceDetailsChanged(device: Device)
    func deviceDetailsNotExists()
    func deviceDetailsDeleted()
}

protocol SensorNodeDetailsPresenter {
    func requestDeviceDetails(deviceID: String)
    func observeDeviceDetails(deviceID: String)
    func requestRefreshData(gatewayID: String, deviceID: String)
}
