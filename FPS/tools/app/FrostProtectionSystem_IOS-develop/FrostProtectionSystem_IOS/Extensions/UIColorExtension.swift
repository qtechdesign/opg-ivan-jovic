//
//  UIColorExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/31/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

extension UIColor {
    
    class func colorFromHex(rgbValue: UInt32) -> UIColor {
        return UIColor(
            red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
            alpha: CGFloat(1.0)
        )
    }
}
