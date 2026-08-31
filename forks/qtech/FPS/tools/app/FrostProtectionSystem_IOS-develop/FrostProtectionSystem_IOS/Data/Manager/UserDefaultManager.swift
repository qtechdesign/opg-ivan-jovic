//
//  UserDefaultManager.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/3/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

private enum UserDefaultsKey {
    static let emailLastLogin = "EMAIL_LAST_LOGIN"
}

class UserDefaultManager {
    
    static let shared = UserDefaultManager()
    private let userDefaults = UserDefaults.standard
    
    var emailLastLogin: String? {
        set {
            userDefaults.set(newValue, forKey: UserDefaultsKey.emailLastLogin)
        }
        get {
            return userDefaults.string(forKey: UserDefaultsKey.emailLastLogin)
        }
    }
}
