//
//  RegisterViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/22/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleSignIn

class RegisterViewController: BaseUIViewController {
    
    @IBOutlet weak var parentNameTextField: UIView!
    @IBOutlet weak var parentEmailTextField: UIView!
    @IBOutlet weak var parentPasswordTextField: UIView!
    @IBOutlet weak var nameTextField: UITextField!
    @IBOutlet weak var emailTextField: UITextField!
    @IBOutlet weak var passwordTextField: UITextField!
    @IBOutlet weak var createAccountButton: UIButton!
    @IBOutlet weak var loginByGooleButton: UIButton!
    @IBOutlet var leadingCornerConstraints: [NSLayoutConstraint]!
    @IBOutlet weak var containEmptyView: UIView!
    @IBOutlet weak var tickReadedTermAndConditionButton: UIButton!
    @IBOutlet weak var nameErrorLabel: UILabel!
    @IBOutlet weak var emailErrorLabel: UILabel!
    @IBOutlet weak var passwordErrorLabel: UILabel!
    
    private var presenter: RegisterPresenter!
    
    private var isReadedTermAndCondition = false {
        didSet {
            tickReadedTermAndConditionButton.setImage(isReadedTermAndCondition ? #imageLiteral(resourceName: "ic_circle_tick") : #imageLiteral(resourceName: "ic_circle_untick"), for: .normal)
            createAccountButton.isEnabled = isReadedTermAndCondition
            createAccountButton.backgroundColor = UIColor.white.withAlphaComponent(isReadedTermAndCondition ? 1 : 0.5)
        }
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = RegisterPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared)
        setupView()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        setupPaddingView()
        if UIDevice().screenType == .iPhone5Or5sOrSE {
            containEmptyView.isHidden = true
        }
    }
    
    private func setupView() {
        isReadedTermAndCondition = false
    }
    
    private func setupPaddingView() {
        let cornerRadius = parentEmailTextField.bounds.height / 2
        parentNameTextField.cornerRadius = cornerRadius
        parentEmailTextField.cornerRadius = cornerRadius
        parentPasswordTextField.cornerRadius = cornerRadius
        createAccountButton.cornerRadius = cornerRadius
        loginByGooleButton.cornerRadius = cornerRadius
        for leadingConstraint in leadingCornerConstraints {
            leadingConstraint.constant = cornerRadius
        }
    }
}

// MARK: - Events did touch in view
extension RegisterViewController {
    
    @IBAction func didTouchMarkReadedTermAndCondition(_ sender: Any) {
        isReadedTermAndCondition = !isReadedTermAndCondition
    }
    
    @IBAction func didTouchLogin(_ sender: Any) {
        self.navigationController?.popViewController(animated: true)
    }
    
    @IBAction func didTouchCreateAccount(_ sender: Any) {
        resetBorderColorTextFields()
        removeTextInErrorLabels()
        guard let email = emailTextField.text, let password = passwordTextField.text, let name = nameTextField.text,
            presenter.isValidateToResiger(email: email, password: password, name: name) else { return }
        presenter.register(email: email, password: password, name: name)
    }
    
    @IBAction func didTouchLoginWithGoogle(_ sender: Any) {
        GIDSignIn.sharedInstance()?.presentingViewController = self
        GIDSignIn.sharedInstance()?.signIn()
    }
    
    private func resetBorderColorTextFields() {
        parentNameTextField.borderColor = UIColor.white.withAlphaComponent(0.5)
        parentEmailTextField.borderColor = UIColor.white.withAlphaComponent(0.5)
        parentPasswordTextField.borderColor = UIColor.white.withAlphaComponent(0.5)
    }
    
    private func removeTextInErrorLabels() {
        nameErrorLabel.text = ""
        emailErrorLabel.text = ""
        passwordErrorLabel.text = ""
    }
}

extension RegisterViewController: RegisterIView {
    
    func registerSuccess() {
        self.showSuccessAlert(Strings.Register.registerSuccess) {
            self.navigationController?.viewControllers.compactMap({ $0 as? LoginViewController }).first?.setEmailTextField(email: self.emailTextField.text ?? "")
            self.navigationController?.popViewController(animated: true)
        }
    }
    
    func nameInviladate(error: String) {
        parentNameTextField.borderColor = .red
        nameErrorLabel.text = error
    }
    
    func emailInviladate(error: String) {
        parentEmailTextField.borderColor = .red
        emailErrorLabel.text = error
    }
    
    func passwordInviladate(error: String) {
        parentPasswordTextField.borderColor = .red
        passwordErrorLabel.text = error
    }
    
    func showLoadingProgress() {
        showLoadingFullScreen()
    }
    
    func hideLoadingProgress() {
        hideLoadingFullScreen()
    }
    
    func showError(error: Error) {
        self.showErrorAlert(error.localizedDescription)
    }
}
