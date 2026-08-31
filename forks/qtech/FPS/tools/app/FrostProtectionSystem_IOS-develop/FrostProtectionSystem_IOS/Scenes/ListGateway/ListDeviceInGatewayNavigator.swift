//
//  ListGatewayNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/3/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

protocol ListDeviceInGatewayNavigator: BaseNavigation {
    func showListSensorScreen(gateway: Gateway, type: DeviceType)
    func showAddDeviceScreen(defaultGatewayID: String)
    func showEditGatewayScreen(gateway: Gateway)
    func showMapGatewayScreen(gatewayID: String)
}

final class ListDeviceInGatewayNavigatorImpl: BaseNavigatorImpl, ListDeviceInGatewayNavigator {
    
    func showListSensorScreen(gateway: Gateway, type: DeviceType) {
        let viewController = ListDeviceViewController.create(gateway: gateway, type: type)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showAddDeviceScreen(defaultGatewayID: String) {
        let viewController = AddDeviceViewController.create(defaultGatewayID: defaultGatewayID)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showEditGatewayScreen(gateway: Gateway) {
        let viewController = EditGatewayViewController.create(gateway: gateway)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showMapGatewayScreen(gatewayID: String) {
        let viewController = MapViewController.create(gatewayIDs: [gatewayID], isOnlyFollowInListGateway: true)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
}
