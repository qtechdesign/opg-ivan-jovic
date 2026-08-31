//
//  ValveControllerDetailsNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/15/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol ValveControllerDetailsNavigator: BaseNavigation {
    func showEditDeviceScreen(device: Device)
}

class ValveControllerDetailsNavigatorImpl: BaseNavigatorImpl, ValveControllerDetailsNavigator {
    
    func showEditDeviceScreen(device: Device) {
        let viewController = EditDeviceViewController.create(device: device)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
}
