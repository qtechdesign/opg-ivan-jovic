//
//  ForgotPasswordViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/23/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class ForgotPasswordViewController: BaseUIViewController {
    
    @IBOutlet private weak var emailErrorLabel: UILabel!
    @IBOutlet weak var emailTextField: UITextField!
    @IBOutlet private weak var parentEmailTextField: UIView!
    @IBOutlet private weak var sendMailForgotPasswordButton: UIButton!
    @IBOutlet private var leadingCornerConstraints: [NSLayoutConstraint]!
    
    private var presenter: ForgotPasswordPresenter!
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        setupPaddingView()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = ForgotPasswordPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared)
    }
    
    @IBAction func didTouchSendEmailForgotPassword(_ sender: Any) {
        resetBorderColorTextFields()
        removeTextInErrorLabels()
        guard let email = emailTextField.text else { return }
        presenter.sendEmailForgotPassword(email: email)
    }
    
    @IBAction func didTouchLogin(_ sender: Any) {
        self.navigationController?.popViewController(animated: true)
    }
    
    private func setupPaddingView() {
        let cornerRadius = parentEmailTextField.bounds.height / 2
        parentEmailTextField.cornerRadius = cornerRadius
        sendMailForgotPasswordButton.cornerRadius = cornerRadius
        for leadingConstraint in leadingCornerConstraints {
            leadingConstraint.constant = cornerRadius
        }
    }
    
    private func resetBorderColorTextFields() {
        parentEmailTextField.borderColor = UIColor.white.withAlphaComponent(0.5)
    }
    
    private func removeTextInErrorLabels() {
        emailErrorLabel.text = ""
    }
}

extension ForgotPasswordViewController: ForgotPasswordIView {
    
    func emailInviladate(error: String) {
        parentEmailTextField.borderColor = .red
        emailErrorLabel.text = error
    }
    
    func sendEmailForgotPasswordSuccess() {
        self.showConfirmMessage(message: Strings.ForgotPassword.doYouWantCheckMail) {
            Constants.App.openMail()
        }
    }
    
    func showLoadingProgress() {
        self.showLoadingFullScreen()
    }
    
    func hideLoadingProgress() {
        self.hideLoadingFullScreen()
    }
    
    func showError(error: Error) {
        self.showErrorAlert(error.localizedDescription)
    }
}
