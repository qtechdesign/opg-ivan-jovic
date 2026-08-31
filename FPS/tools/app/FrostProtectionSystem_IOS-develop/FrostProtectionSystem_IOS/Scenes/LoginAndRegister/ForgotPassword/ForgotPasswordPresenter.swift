//
//  ForgotPasswordPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/3/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class ForgotPasswordPresenterImpl: ForgotPasswordPresenter {
    
    private weak var view: ForgotPasswordIView!
    private let userRepository: UserRepository
    private let disposeBag = DisposeBag()
    
    init(view: ForgotPasswordIView, userRepository: UserRepository) {
        self.view = view
        self.userRepository = userRepository
    }
    
    func sendEmailForgotPassword(email: String) {
        guard isValidateToResiger(email: email) else { return }
        self.view.showLoadingProgress()
        userRepository.sendEmailForgotPassword(email: email)
            .subscribe(onCompleted: { [weak self] in
                self?.view.hideLoadingProgress()
                self?.view.sendEmailForgotPasswordSuccess()
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    private func isValidateToResiger(email: String) -> Bool {
        var isValidate = true
        if email.trim().isEmpty {
            self.view.emailInviladate(error: Strings.Register.emailCannotEmpty)
            isValidate = false
        } else if !email.isValidEmail() {
            self.view.emailInviladate(error: Strings.Register.wrongEmailFormat)
            isValidate = false
        }
        return isValidate
    }
}
