//
//  HomeContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/29/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol HomeIView: class, BaseIView {
    func requestGatewaysSuccess(gateways: [Gateway])
    func gatewayAdded(gateway: Gateway)
    func gatewayChanged(gateway: Gateway)
    func gatewayDeleted(gateway: Gateway)
}

protocol HomePresenter {
    func requestGateways()
    func observeGatewayAdd()
    func observeGatewayChange(gatewayID: String)
    func observeGatewayDelete(gatewayID: String)
}
