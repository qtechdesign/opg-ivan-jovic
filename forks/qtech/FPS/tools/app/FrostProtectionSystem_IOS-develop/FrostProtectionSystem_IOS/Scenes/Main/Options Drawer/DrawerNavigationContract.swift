//
//  DrawerContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/2/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol DrawerNavigationIView: class {
    func requestGatewaysSuccess(gateways: [Gateway])
    func requestUserInfoSuccess(user: User)
}

protocol DrawerNavigationPresenter {
    func requestGateways()
    func requestUserInfo()
}
