//
//  UIApplicationExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/31/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

extension UINavigationBar {
    
    class func navigationBarAndStatusBarColor(backgroundColor: UIColor, barStyle: UIBarStyle) {
        let navigationBarAppearace = UINavigationBar.appearance()
        navigationBarAppearace.tintColor = UIColor.colorFromHex(rgbValue: 0xffffff)
        navigationBarAppearace.barTintColor = backgroundColor
        navigationBarAppearace.barStyle = barStyle
        navigationBarAppearace.isTranslucent = false
    }
}
