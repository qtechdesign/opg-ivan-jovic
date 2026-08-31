//
//  RoundedButtonWithShadow.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/10/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class RoundedButtonWithShadow: UIButton {
    
    override func awakeFromNib() {
        super.awakeFromNib()
        self.layer.masksToBounds = false
        self.layer.cornerRadius = self.frame.height/2
        self.layer.shadowColor = UIColor.black.withAlphaComponent(0.25).cgColor
        self.layer.shadowPath = UIBezierPath(roundedRect: self.bounds, cornerRadius: self.layer.cornerRadius).cgPath
        self.layer.shadowOffset = .zero
        self.layer.shadowOpacity = 1
        self.layer.shadowRadius = 5.0
    }
}
