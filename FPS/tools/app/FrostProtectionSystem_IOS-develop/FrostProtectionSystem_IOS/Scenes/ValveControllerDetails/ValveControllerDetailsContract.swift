//
//  ValveControllerDetailsContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/15/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol ValveControllerDetailsIView: class, BaseIView {
    func requestDeviceDetailsSuccess(device: Device)
    func deviceDetailsChanged(device: Device)
    func deviceDetailsNotExists()
    func deviceDetailsDeleted()
    func requestHistoryDeviceDataSuccess(datas: [DeviceData])
    func historyDeviceDataAdded(data: DeviceData)
}

protocol ValveControllerDetailsPresenter {
    func requestDeviceDetails(deviceID: String)
    func observeDeviceDetails(deviceID: String)
    func requestHistoryDeviceData(deviceID: String)
    func observeHistoryDeviceDataAdd(deviceID: String)
    func requestRefreshData(gatewayID: String, deviceID: String)
    func requestChangeStatusDevice(gatewayID: String, deviceID: String, isOn: Bool)
}
