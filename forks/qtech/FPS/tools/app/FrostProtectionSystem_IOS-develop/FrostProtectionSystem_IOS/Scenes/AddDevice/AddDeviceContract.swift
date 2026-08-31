//
//  AddDeviceContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/20/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
protocol AddDeviceIView: class, BaseIView {
    func invalidate(error: String)
    func requestListGatewaySuccess(gateways: [Gateway])
    func addNewDeviceSuccess()
}

protocol AddDevicePresenter {
    func requestListGateway()
    func addNewDevice(gatewaySeleted: Gateway?, loraID: String, name: String, serialKey: String, lat: String, long: String)
}
