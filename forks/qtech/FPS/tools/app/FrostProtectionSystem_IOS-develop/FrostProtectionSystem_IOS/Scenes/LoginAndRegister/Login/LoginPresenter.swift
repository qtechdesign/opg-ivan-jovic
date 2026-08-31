//
//  LoginPresenter.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit
import RxSwift

class LoginPresenterImpl: LoginPresenter {
    
    private weak var view: LoginIView!
    private var userRepository: UserRepository
    
    private let disposeBag = DisposeBag()
    
    init(view: LoginIView, userRepository: UserRepository) {
        self.view = view
        self.userRepository = userRepository
    }
    
    func login(email: String, password: String, isRememberMe: Bool) {
        guard isValidateToResiger(email: email, password: password) else { return }
        self.view.showLoadingProgress()
        userRepository.login(email: email, password: password)
            .subscribe(onCompleted: { [weak self] in
                UserDefaultManager.shared.emailLastLogin = isRememberMe ? email : nil
                self?.view.hideLoadingProgress()
                self?.view.loginSuccess()
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    private func isValidateToResiger(email: String, password: String) -> Bool {
        var isValidate = true
        if email.trim().isEmpty {
            self.view.emailInviladate(error: Strings.Register.emailCannotEmpty)
            isValidate = false
        } else if !email.isValidEmail() {
            self.view.emailInviladate(error: Strings.Register.wrongEmailFormat)
            isValidate = false
        }
        if password.trim().isEmpty {
            self.view.passwordInviladate(error: Strings.Register.passwordCannotEmpty)
            isValidate = false
        } else if password.trim().count < Constants.Validate.minLengthPassword {
            self.view.passwordInviladate(error: Strings.Register.lengthPasswordIncorrect)
            isValidate = false
        }
        return isValidate
    }
}
