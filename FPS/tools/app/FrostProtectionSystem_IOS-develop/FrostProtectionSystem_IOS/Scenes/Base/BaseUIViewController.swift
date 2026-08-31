//
//  BaseUIViewController.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

protocol KeyboardDelegate: class {
    func keyboardWillShow(height: CGFloat)
    func keyboardWillHide()
}

class BaseUIViewController: UIViewController {
    
    weak var keyboardDelegate: KeyboardDelegate? {
        didSet {
            if keyboardDelegate != nil {
                addNotificationWhenKeyboardShowHide(window: self.view.window)
            }
        }
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        guard self.isViewLoaded else { return }
        hideKeyboardWhenTappedAround()
        removeBackButtonTitle()
    }
    
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
    
    private func addNotificationWhenKeyboardShowHide(window: UIWindow?) {
        NotificationCenter.default.addObserver(self, selector: #selector(handleKeyboardWillShow), name: UIResponder.keyboardWillShowNotification, object: window)
        NotificationCenter.default.addObserver(self, selector: #selector(handleKeyboardWillHide), name: UIResponder.keyboardWillHideNotification, object: window)
    }
    
    @objc private func handleKeyboardWillShow(notification: Notification) {
        let heightKeyboard = getHeightKeyboard(notification: notification)
        keyboardDelegate?.keyboardWillShow(height: heightKeyboard)
    }
    
    @objc private func handleKeyboardWillHide(notification: Notification) {
        keyboardDelegate?.keyboardWillHide()
    }
    
    private func getHeightKeyboard(notification: Notification) -> CGFloat {
        var bottomInset: CGFloat = 0
        if #available(iOS 11.0, *) {
            bottomInset = UIApplication.shared.keyWindow?.safeAreaInsets.bottom ?? 0
        }
        var heightKeyboard = (notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue.height ?? 0
        heightKeyboard -= bottomInset
        return heightKeyboard
    }
    
    deinit {
        print("Deinit: " + String(describing: type(of: self)))
    }
}
