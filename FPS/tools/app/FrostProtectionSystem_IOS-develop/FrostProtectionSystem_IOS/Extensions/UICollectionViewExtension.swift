//
//  UICollectionViewExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/7/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

extension UICollectionView {
    func registerCell<T>(ofType type: T.Type) {
        let typeName = String(describing: type)
        self.register(UINib(nibName: typeName, bundle: nil), forCellWithReuseIdentifier: typeName)
    }
}

extension UICollectionViewCell {
    static var identifier: String {
        return String(describing: self)
    }
}
