//
//  EditNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/16/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import GoogleMaps

protocol EditGatewayNavigator: BaseNavigation {
    func showMapSelectCoordinates(location: CLLocationCoordinate2D?, delegate: MapSelectCoordinatesDelegate)
}

class EditGatewayNavigatorImpl: BaseNavigatorImpl, EditGatewayNavigator {
    
    func showMapSelectCoordinates(location: CLLocationCoordinate2D?, delegate: MapSelectCoordinatesDelegate) {
        self.viewController?.navigationController?.pushViewController(MapSelectCoordinatesViewController.create(location: location, delegate: delegate), animated: true)
    }
}
