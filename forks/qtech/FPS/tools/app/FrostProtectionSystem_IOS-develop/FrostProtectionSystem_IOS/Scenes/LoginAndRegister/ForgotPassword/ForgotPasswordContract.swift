//
//  ForgotPasswordContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/3/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol ForgotPasswordIView: class, BaseIView {
    func emailInviladate(error: String)
    func sendEmailForgotPasswordSuccess()
}

protocol ForgotPasswordPresenter {
    func sendEmailForgotPassword(email: String)
}
