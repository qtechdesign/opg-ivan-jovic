//
//  AfterScanNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/21/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

protocol AfterScanNavigator: BaseNavigation {
    func showListDeviceInGatewayScreen(gateway: Gateway)
    func showDeviceDetailsScreen(device: Device)
}

class AfterScanNavigatorImpl: BaseNavigatorImpl, AfterScanNavigator {
    
    func showListDeviceInGatewayScreen(gateway: Gateway) {
        let viewController = ListDeviceInGatewayViewController.create(gatewayID: gateway.id)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showDeviceDetailsScreen(device: Device) {
        var viewController: UIViewController
        if device.type() == .sensor {
            viewController = SensorNodeDetailsViewController.create(deviceID: device.id, deviceName: device.name)
        } else {
            viewController = ValveControllerDetailsViewController.create(device: device)
        }
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
}
