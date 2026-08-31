//
//  SensorNodeDetailsNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/15/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol SensorNodeDetailsNavigator: BaseNavigation {
    func showEditDeviceScreen(device: Device)
    func backToListDeviceScreen()
    func showChartScreen(deviceID: String)
}

class SensorNodeDetailsNavigatorImpl: BaseNavigatorImpl, SensorNodeDetailsNavigator {
    
    func showEditDeviceScreen(device: Device) {
        let viewController = EditDeviceViewController.create(device: device)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func backToListDeviceScreen() {
        if let viewController = self.viewController?.navigationController?.viewControllers.last(where: { $0 is ListDeviceViewController }) {
            self.viewController?.navigationController?.popToViewController(viewController, animated: true)
        } else {
            backToRootScreen()
        }
    }
    
    func showChartScreen(deviceID: String) {
        let viewController = ChartViewController.create(deviceID: deviceID)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
}
