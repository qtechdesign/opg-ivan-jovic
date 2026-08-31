//
//  MainNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/31/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

protocol HomeNavigator {
    func showListDeviceInGatewayScreen(gateway: Gateway)
    func showScanQRCodeScreen(delegate: ScanQRCodeDelegate)
    func showSettingScreen()
    func showInformationScreen()
    func showMapScreen(gatewayIDs: [String])
    func showFoundGatewayOrDeviceScreen(qrCode: String)
}

final class HomeNavigatorImpl: BaseNavigatorImpl, HomeNavigator {
    
    func showListDeviceInGatewayScreen(gateway: Gateway) {
        let viewController = ListDeviceInGatewayViewController.create(gatewayID: gateway.id)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showScanQRCodeScreen(delegate: ScanQRCodeDelegate) {
        let viewController = ScanQRCodeViewController.create()
        viewController.delegate = delegate
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showSettingScreen() {
        let viewController = SettingViewController.create()
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showInformationScreen() {
        let viewController = InformationViewController.create()
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showMapScreen(gatewayIDs: [String]) {
        let viewController = MapViewController.create(gatewayIDs: gatewayIDs)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
    
    func showFoundGatewayOrDeviceScreen(qrCode: String) {
        let viewController = AfterScanViewController.create(qrCode: qrCode)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
}
