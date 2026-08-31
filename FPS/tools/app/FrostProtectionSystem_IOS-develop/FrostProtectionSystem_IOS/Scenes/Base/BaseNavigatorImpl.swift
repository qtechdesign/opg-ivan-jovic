//
//  BaseNavigator.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

protocol BaseNavigation {
    func backToPreviousScreen()
    func backToRootScreen()
}

class BaseNavigatorImpl: BaseNavigation {
    weak var viewController: UIViewController?
    
    required init(viewController: UIViewController) {
        self.viewController = viewController
    }
    
    func backToPreviousScreen() {
        if let navigation = self.viewController?.navigationController {
            navigation.popViewController(animated: true)
        } else {
            self.viewController?.dismiss(animated: true, completion: nil)
        }
    }
    func backToRootScreen() {
        if let navigation = self.viewController?.navigationController {
            navigation.popToRootViewController(animated: true)
        } else {
            self.viewController?.dismiss(animated: true, completion: nil)
        }
    }
}
