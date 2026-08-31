//
//  StringExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/24/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

extension String {
    
    func trim() -> String{
        return self.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    func isValidEmail() -> Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format:"SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: self)
    }
    
    func isLoraID() -> Bool {
        let emailRegex = "0x[0-9A-Fa-f]{4}"
        let emailPredicate = NSPredicate(format:"SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: self)
    }
    
    func convertLoraIDToHex() -> String {
        return "0x" + self
    }
}
