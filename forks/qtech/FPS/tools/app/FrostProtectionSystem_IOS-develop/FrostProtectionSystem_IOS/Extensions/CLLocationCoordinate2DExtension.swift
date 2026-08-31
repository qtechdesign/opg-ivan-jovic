//
//  CLLocationCoordinate2DExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/15/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

extension CLLocationCoordinate2D: Equatable {}

public func ==(lhs: CLLocationCoordinate2D, rhs: CLLocationCoordinate2D) -> Bool {
    return (lhs.latitude == rhs.latitude && lhs.longitude == rhs.longitude)
}
