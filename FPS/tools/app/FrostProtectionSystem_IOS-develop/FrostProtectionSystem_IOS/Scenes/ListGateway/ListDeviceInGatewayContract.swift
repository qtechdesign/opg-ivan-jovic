//
//  GatewayContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/6/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol ListDeviceInGatewayIView: class, BaseIView {
    func requestGatewayDetailSuccess(gateway: Gateway?)
    func gatewayDetailChanged(gateway: Gateway)
    func gatewayDetailDeleted()
}

protocol ListDeviceInGatewayPresenter {
    func requestGatewayDetail(gatewayID: String)
    func observeGatewayDetailChange(gatewayID: String)
    func observeGatewayDelete(gatewayID: String)
}
