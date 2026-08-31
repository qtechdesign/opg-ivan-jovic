//
//  UITextFieldExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/22/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

@IBDesignable
extension UITextField {
    
    @IBInspectable var placeholderColor: UIColor? {
        set {
            self.attributedPlaceholder = NSAttributedString(string: self.placeholder ?? "", attributes: [NSAttributedString.Key.foregroundColor: newValue ?? UIColor.gray])
        }
        get {
            return self.placeholderColor
        }
    }
}
