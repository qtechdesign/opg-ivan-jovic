//
//  LoginViewController.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit
import GoogleSignIn

class LoginViewController: BaseUIViewController {
    
    @IBOutlet private weak var parentEmailTextField: UIView!
    @IBOutlet private weak var parentPasswordTextField: UIView!
    @IBOutlet private weak var emailTextField: UITextField!
    @IBOutlet private weak var passwordTextField: UITextField!
    @IBOutlet private weak var loginButton: UIButton!
    @IBOutlet private weak var loginByGooleButton: UIButton!
    @IBOutlet private weak var emailErrorLabel: UILabel!
    @IBOutlet private weak var passwordErrorLabel: UILabel!
    @IBOutlet private weak var rememberMeButton: UIButton!
    @IBOutlet private var leadingCornerConstraints: [NSLayoutConstraint]!
    
    private var presenter: LoginPresenter!
    private var navigator: LoginNavigator!
    
    private var isRememberMe = false {
        didSet {
            rememberMeButton.setImage(isRememberMe ? #imageLiteral(resourceName: "ic_circle_tick") : #imageLiteral(resourceName: "ic_circle_untick"), for: .normal)
        }
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = LoginPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared)
        navigator = LoginNavigatorImpl(viewController: self)
        setupUI()
    }
    
    private func setupUI() {
        let emailLastLogin = UserDefaultManager.shared.emailLastLogin
        isRememberMe = emailLastLogin != nil
        emailTextField.text = emailLastLogin
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        setupPaddingView()
    }
    
    private func setupPaddingView() {
        let cornerRadius = parentEmailTextField.bounds.height / 2
        parentEmailTextField.cornerRadius = cornerRadius
        parentPasswordTextField.cornerRadius = cornerRadius
        loginButton.cornerRadius = cornerRadius
        loginByGooleButton.cornerRadius = cornerRadius
        for leadingConstraint in leadingCornerConstraints {
            leadingConstraint.constant = cornerRadius
        }
    }
    
    func setEmailTextField(email: String) {
        emailTextField.text = email
    }
    
    @IBAction private func didTapLoginButton(_ sender: Any) {
        resetBorderColorTextFields()
        removeTextInErrorLabels()
        guard let email = emailTextField.text, let password = passwordTextField.text else { return }
        presenter.login(email: email, password: password, isRememberMe: isRememberMe)
    }
    
    @IBAction func didTouchRememberMe(_ sender: Any) {
        isRememberMe = !isRememberMe
    }
    
    @IBAction private func didTouchLoginWithGoogle(_ sender: Any) {
        GIDSignIn.sharedInstance()?.presentingViewController = self
        GIDSignIn.sharedInstance()?.signIn()
    }
    
    private func resetBorderColorTextFields() {
        parentEmailTextField.borderColor = UIColor.white.withAlphaComponent(0.5)
        parentPasswordTextField.borderColor = UIColor.white.withAlphaComponent(0.5)
    }
    
    private func removeTextInErrorLabels() {
        emailErrorLabel.text = ""
        passwordErrorLabel.text = ""
    }
}

extension LoginViewController: LoginIView {
    
    func emailInviladate(error: String) {
        parentEmailTextField.borderColor = .red
        emailErrorLabel.text = error
    }
    
    func passwordInviladate(error: String) {
        parentPasswordTextField.borderColor = .red
        passwordErrorLabel.text = error
    }
    
    func loginSuccess() {
        navigator.showMainScreen()
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
