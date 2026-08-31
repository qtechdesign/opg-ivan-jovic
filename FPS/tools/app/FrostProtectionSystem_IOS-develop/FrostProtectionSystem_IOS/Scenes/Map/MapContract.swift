//
//  MapContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/14/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol MapIView: class, BaseIView {
    func gatewayAdded(gatewayID: String)
    func gatewayDataChanged(gateway: Gateway)
    func gatewayDeleted(gatewayID: String)
}

protocol MapPresenter {
    func observeGatewayAdd()
    func observeGatewayData(gatewayID: String)
    func observeGatewayDelete(gatewayID: String)
}
