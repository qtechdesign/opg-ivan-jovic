//
//  ListSensorNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/8/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

protocol ListDeviceNavigator {
    func showSensorNodeDetailsScreen(device: Device)
    func showValveControllerDetailsScreen(device: Device)
    func showAddDeviceScreen(defaultGatewayID: String)
    func showMapDevicesScreen(gatewayID: String, type: DeviceType)
}

final class ListDeviceNavigatorImpl: BaseNavigatorImpl, ListDeviceNavigator {
    
    func showSensorNodeDetailsScreen(device: Device) {
        let sensorDetailsViewController = SensorNodeDetailsViewController.create(deviceID: device.id, deviceName: device.name)
        self.viewController?.navigationController?.pushViewController(sensorDetailsViewController, animated: true)
    }
    
    func showValveControllerDetailsScreen(device: Device) {
        let viewController = ValveControllerDetailsViewController.create(device: device)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showAddDeviceScreen(defaultGatewayID: String) {
        let viewController = AddDeviceViewController.create(defaultGatewayID: defaultGatewayID)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showMapDevicesScreen(gatewayID: String, type: DeviceType) {
        let viewController = MapViewController.create(gatewayIDs: [gatewayID], isOnlyFollowInListGateway: true, isOnlyShowDevices: true, deviceType: type)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
}
