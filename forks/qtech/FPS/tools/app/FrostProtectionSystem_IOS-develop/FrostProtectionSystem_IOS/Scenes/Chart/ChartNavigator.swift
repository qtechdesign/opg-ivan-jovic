//
//  ChartNavigator.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/25/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

protocol ChartNavigator {
    func showDatePickerScreen(chooseDate: Date, delegate: DatePickerDelegate)
}

final class ChartNavigatorImpl: BaseNavigatorImpl, ChartNavigator {
    
    func showDatePickerScreen(chooseDate: Date, delegate: DatePickerDelegate) {
        let viewController = DatePickerViewController.create(maximumDate: Date(), chooseDate: chooseDate, delegate: delegate)
        self.viewController?.presentWithFade(viewController: viewController, backgroundColorWithAlpha: UIColor.black.withAlphaComponent(0.3))
    }
}
