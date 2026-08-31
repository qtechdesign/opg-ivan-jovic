//
//  EditDeviceContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/17/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import GoogleMaps

protocol EditDeviceIView: class, BaseIView {
    func notChangeData()
    func editDeviceSuccess()
}

protocol EditDevicePresenter {
    func editDevice(device: Device, loraID: String, name: String, location: CLLocationCoordinate2D?)
    func deleteDevice(gatewayID: String, deviceID: String, isDeleteLog: Bool)
}
