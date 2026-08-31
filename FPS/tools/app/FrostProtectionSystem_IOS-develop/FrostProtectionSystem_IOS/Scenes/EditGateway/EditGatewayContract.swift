//
//  EditGatewayContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/16/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol EditGatewayIView: class, BaseIView {
    func invalidate(error: String)
    func notChangeData()
    func editGatewaySuccess()
    func gatewayDeleted()
}

protocol EditGatewayPresenter {
    func editGateway(gateway: Gateway, name: String, lat: String, long: String)
    func deleteGateway(gateway: Gateway, isDeleteLog: Bool)
    func observeGatewayDelete(gatewayID: String)
}
