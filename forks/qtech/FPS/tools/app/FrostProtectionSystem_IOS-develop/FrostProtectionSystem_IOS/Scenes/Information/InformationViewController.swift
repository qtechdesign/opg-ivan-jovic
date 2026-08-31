//
//  InformationViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/14/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class InformationViewController: BaseUIViewController {
    
    static func create() -> UIViewController {
        let viewController: InformationViewController = UIViewController.createViewControllerFromMainStoryboard()
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        self.title = Strings.Information.information
    }
}
