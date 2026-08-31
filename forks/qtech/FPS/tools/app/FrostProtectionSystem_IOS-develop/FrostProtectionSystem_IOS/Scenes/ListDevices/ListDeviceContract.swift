//
//  ListSensorContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/4/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol ListDeviceIView: class, BaseIView {
    func deviceAdded(device: Device)
    func deviceChanged(device: Device)
    func deviceDeleted(device: Device)
}

protocol ListDevicePresenter {
    func observeDeviceAdd(gatewayID: String)
    func observeDeviceChange(gatewayID: String)
    func observeDeviceDelete(gatewayID: String)
}
