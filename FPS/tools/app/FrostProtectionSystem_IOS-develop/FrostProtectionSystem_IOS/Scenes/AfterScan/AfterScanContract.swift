//
//  AfterScanContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/21/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol AfterScanIView: class, BaseIView {
    func invalidate(error: String)
    func notFoundGatewayOrDevice()
    func foundedGateway(gateway: Gateway)
    func foundedDevice(device: Device)
}

protocol AfterScanPresenter {
    func requestGatewayOrDevice(qrCode: String)
}
