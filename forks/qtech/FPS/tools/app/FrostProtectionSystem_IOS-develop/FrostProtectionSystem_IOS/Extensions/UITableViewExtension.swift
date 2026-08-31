//
//  UITableViewExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/27/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

extension UITableView {
    
    func registerCell<T>(ofType type: T.Type) {
        let nibName = String(describing: type)
        register(UINib(nibName: nibName, bundle: nil), forCellReuseIdentifier: nibName)
    }
    
    func registerHeaderFooter<T>(ofType type: T.Type) {
        let typeName = String(describing: type)
        self.register(UINib(nibName: typeName, bundle: nil), forHeaderFooterViewReuseIdentifier: typeName)
    }
}

extension UITableViewCell {
    
    static var identifier: String {
        return String(describing: self)
    }
}
