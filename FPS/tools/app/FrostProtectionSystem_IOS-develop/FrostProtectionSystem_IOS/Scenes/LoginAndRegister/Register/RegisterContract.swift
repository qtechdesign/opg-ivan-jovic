//
//  RegisterContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/24/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol RegisterIView: class, BaseIView {
    func nameInviladate(error: String)
    func emailInviladate(error: String)
    func passwordInviladate(error: String)
    func registerSuccess()
}

protocol RegisterPresenter {
    func register(email: String, password: String, name: String)
    func isValidateToResiger(email: String, password: String, name: String) -> Bool
}
