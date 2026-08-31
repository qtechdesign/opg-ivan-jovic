//
//  LoginContract.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

protocol LoginIView: class, BaseIView {
    func emailInviladate(error: String)
    func passwordInviladate(error: String)
    func loginSuccess()
}

protocol LoginPresenter: class {
    func login(email: String, password: String, isRememberMe: Bool)
}
