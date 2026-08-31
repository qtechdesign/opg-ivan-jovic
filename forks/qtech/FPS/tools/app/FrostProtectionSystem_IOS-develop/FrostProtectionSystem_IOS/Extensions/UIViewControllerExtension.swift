//
//  UIViewControllerExtension.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

typealias ActionHandler = () -> Void

extension UIViewController {
    
    class func create<T:UIViewController>(storyboardName: String) -> T {
        let identifier = String(describing: T.self)
        let storyboard = UIStoryboard(name: storyboardName, bundle: nil)
        guard let viewController = storyboard.instantiateViewController(withIdentifier: identifier) as? T else {
            fatalError("Not cast view controller with identifier \(identifier)")
        }
        return viewController
    }
    
    class func createViewControllerFromMainStoryboard<T:UIViewController>() -> T {
        let identifier = String(describing: T.self)
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        guard let viewController = storyboard.instantiateViewController(withIdentifier: identifier) as? T else {
            fatalError("Not cast view controller with identifier \(identifier)")
        }
        return viewController
    }
    
    func hideKeyboardWhenTappedAround() {
        let tapGestureRecognizer = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
        tapGestureRecognizer.cancelsTouchesInView = false
        view.addGestureRecognizer(tapGestureRecognizer)
    }
    
    @objc func dismissKeyboard() {
        view.endEditing(true)
    }
    
    func removeBackButtonTitle() {
        navigationItem.backBarButtonItem = UIBarButtonItem(title: "", style: .plain, target: nil, action: nil)
    }
    
    func showErrorAlert(_ message: String, dissmiss: ActionHandler? = nil) {
        showAlertWithMessage(message: message, completion: dissmiss)
    }
    
    func showSuccessAlert(_ message: String, dismiss: ActionHandler? = nil) {
        self.showAlertWithMessage(message: message, completion: dismiss)
    }
    
    func showConfirmMessage(message: String, titleNoButton: String? = nil, titleYesButton: String? = nil, clickNoButton: ActionHandler? = nil, clickYesButton: @escaping ActionHandler) {
        let alert = UIAlertController(title: Strings.Main.appName, message: message, preferredStyle: .alert)
        let no = UIAlertAction(title: titleNoButton ?? Strings.Main.no, style: .cancel) { (action) in
            clickNoButton?()
        }
        let yes = UIAlertAction(title: titleYesButton ?? Strings.Main.yes, style: .default) { (action) in
            clickYesButton()
        }
        alert.addAction(no)
        alert.addAction(yes)
        self.present(alert, animated: true, completion: nil)
    }
    
    func showAlertWithMessage(message: String, completion: ActionHandler? = nil) {
        let alert = UIAlertController(title: Strings.Main.appName, message: message, preferredStyle: .alert)
        let action = UIAlertAction(title: Strings.Main.done, style: .cancel) { (action) in
            completion?()
        }
        alert.addAction(action)
        self.present(alert, animated: true, completion: nil)
    }
    
    func showLoadingFullScreen() {
        let alert = UIAlertController(title: nil, message: Strings.Main.pleaseWait, preferredStyle: .alert)
        let loadingIndicator = UIActivityIndicatorView(frame: CGRect(x: 10, y: 5, width: 50, height: 50))
        loadingIndicator.hidesWhenStopped = true
        loadingIndicator.style = .gray
        loadingIndicator.startAnimating()
        alert.view.addSubview(loadingIndicator)
        present(alert, animated: true, completion: nil)
    }
    
    func hideLoadingFullScreen() {
        if let alert = self.presentedViewController as? UIAlertController, alert.message == Strings.Main.pleaseWait {
            alert.dismiss(animated: true, completion: nil)
        }
    }
    
    func showLoadingInsideView() {
        let activityIndicator = UIActivityIndicatorView(style: .white)
        view.addSubview(activityIndicator)
        activityIndicator.frame = view.bounds
        activityIndicator.backgroundColor = UIColor.black.withAlphaComponent(0.25)
        activityIndicator.startAnimating()
    }
    
    func hideLoadingInsideView() {
        let activityIndicators = view.subviews.compactMap({ $0 as? UIActivityIndicatorView })
        for activityIndicator in activityIndicators {
            activityIndicator.removeFromSuperview()
        }
    }
    
    func dismissWithFade() {
        let transition = CATransition()
        transition.duration = 0.3
        transition.type = CATransitionType.fade
        transition.subtype = CATransitionSubtype.fromRight
        transition.timingFunction = CAMediaTimingFunction(name: CAMediaTimingFunctionName.easeInEaseOut)
        if let window = self.view.window {
            window.layer.add(transition, forKey: kCATransition)
        }
        self.dismiss(animated: false, completion: nil)
    }
    
    func presentWithFade(viewController: UIViewController, backgroundColorWithAlpha: UIColor? = UIColor.black.withAlphaComponent(0.3)) {
        self.definesPresentationContext = true
        if let background = backgroundColorWithAlpha {
            viewController.view.backgroundColor = background
        }
        viewController.modalPresentationStyle = .overFullScreen
        let transition = CATransition()
        transition.duration = 0.5
        transition.type = CATransitionType.fade
        transition.subtype = CATransitionSubtype.fromRight
        transition.timingFunction = CAMediaTimingFunction(name: CAMediaTimingFunctionName.easeInEaseOut)
        if let window = self.view.window {
            window.layer.add(transition, forKey: kCATransition)
        }
        present(viewController, animated: false, completion: nil)
    }
}
