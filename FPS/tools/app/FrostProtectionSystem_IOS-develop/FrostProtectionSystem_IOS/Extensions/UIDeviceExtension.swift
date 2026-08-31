//
//  UIDeviceExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/23/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

extension UIDevice {
    
    enum ScreenType: String {
        case iPhone5Or5sOrSE
        case iPhone6Or6sOr7Or8
        case iPhone6PlusOr6sPlusOr7PlusOr8Plus
        case iPhoneX
        case unknow
    }
    
    var screenType: ScreenType {
        switch UIScreen.main.nativeBounds.height {
        case 1136:
            return .iPhone5Or5sOrSE
        case 1334:
            return .iPhone6Or6sOr7Or8
        case 1920:
            return .iPhone6PlusOr6sPlusOr7PlusOr8Plus
        case 2436:
            return .iPhoneX
        default:
            return .unknow
        }
    }
}
