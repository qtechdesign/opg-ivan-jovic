//
//  RegisterPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/24/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class RegisterPresenterImpl: RegisterPresenter {
    
    private weak var view: RegisterIView!
    private var userRepository: UserRepository
    private var disposeBag = DisposeBag()
    
    init(view: RegisterIView, userRepository: UserRepository) {
        self.view = view
        self.userRepository = userRepository
    }
    
    func register(email: String, password: String, name: String) {
        self.view.showLoadingProgress()
        userRepository.register(email: email, password: password, name: name)
            .subscribe(onCompleted: { [weak self] in
                (UIApplication.shared.delegate as? AppDelegate)?.logoutAccount()
                self?.view.hideLoadingProgress()
                self?.view.registerSuccess()
            }) { [weak self] (error) in
                (UIApplication.shared.delegate as? AppDelegate)?.logoutAccount()
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    func isValidateToResiger(email: String, password: String, name: String) -> Bool {
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
        if name.trim().isEmpty {
            self.view.nameInviladate(error: Strings.Register.nameCannotEmpty)
            isValidate = false
        }
        return isValidate
    }
}
