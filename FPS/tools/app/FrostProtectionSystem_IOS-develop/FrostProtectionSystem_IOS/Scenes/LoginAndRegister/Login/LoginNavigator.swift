//
//  LoginNavigator.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

protocol LoginNavigator {
    func showMainScreen()
}

final class LoginNavigatorImpl: BaseNavigatorImpl, LoginNavigator {
    
    func showMainScreen() {
        let appdelegate = UIApplication.shared.delegate as? AppDelegate
        appdelegate?.setMainView()
    }
}
