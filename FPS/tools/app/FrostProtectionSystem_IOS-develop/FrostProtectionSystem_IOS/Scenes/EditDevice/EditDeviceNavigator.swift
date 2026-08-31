//
//  EditDeviceNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/17/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import GoogleMaps

protocol EditDeviceNavigator: BaseNavigation {
    func showMapSelectCoordinates(location: CLLocationCoordinate2D?, delegate: MapSelectCoordinatesDelegate)
}

class EditDeviceNavigatorImpl: BaseNavigatorImpl, EditDeviceNavigator {
    
    func showMapSelectCoordinates(location: CLLocationCoordinate2D?, delegate: MapSelectCoordinatesDelegate) {
        let viewController = MapSelectCoordinatesViewController.create(location: location, delegate: delegate)
        self.viewController?.navigationController?.pushViewController(viewController, animated: true)
    }
}
