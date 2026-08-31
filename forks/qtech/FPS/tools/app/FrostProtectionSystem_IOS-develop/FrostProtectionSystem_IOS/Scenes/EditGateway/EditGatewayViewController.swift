//
//  EditGatewayViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/13/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

class EditGatewayViewController: BaseUIViewController {
    
    @IBOutlet weak var gatewayIDLabel: UILabel!
    @IBOutlet weak var nameTextField: UITextField!
    @IBOutlet weak var latitudeTextField: UITextField!
    @IBOutlet weak var longtitudeTextField: UITextField!
    
    private var navigator: EditGatewayNavigator!
    private var presenter: EditGatewayPresenter!
    
    private var gateway: Gateway!
    
    static func create(gateway: Gateway) -> UIViewController {
        let viewController: EditGatewayViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.gateway = gateway
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        navigator = EditGatewayNavigatorImpl(viewController: self)
        presenter = EditGatewayPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, gatewayRepository: GatewayRepositoryImpl.shared)
        setupUI()
        requestData()
    }
    
    private func setupUI() {
        title = gateway.name
        gatewayIDLabel.text = Strings.Gateway.gatewayID(id: gateway.publicKey ?? gateway.id)
        nameTextField.text = gateway.name
        if let location = gateway.location {
            latitudeTextField.text = "\(location.latitude)"
            longtitudeTextField.text = "\(location.longitude)"
        }
        latitudeTextField.delegate = self
        longtitudeTextField.delegate = self
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .trash, target: self, action: #selector(didTouchDeleteGateway))
    }
    
    private func requestData() {
        presenter.observeGatewayDelete(gatewayID: gateway.id)
    }
    
    @objc private func didTouchDeleteGateway() {
        self.showConfirmMessage(message: Strings.Gateway.confirmDeleteAllDataOfDevices, clickNoButton: {
            self.presenter.deleteGateway(gateway: self.gateway, isDeleteLog: false)
        }) {
            self.presenter.deleteGateway(gateway: self.gateway, isDeleteLog: true)
        }
    }
}

// MARK: - Actions
extension EditGatewayViewController {
    
    @IBAction func didTouchAutoFillLocation(_ sender: Any) {
        navigator.showMapSelectCoordinates(location: gateway.location, delegate: self)
    }
    
    @IBAction func didTouchSave(_ sender: Any) {
        guard let name = self.nameTextField.text,
            let lat = self.latitudeTextField.text,
            let long = self.longtitudeTextField.text else {
            return
        }
        presenter.editGateway(gateway: gateway, name: name, lat: lat, long: long)
    }
    
    @IBAction func didTouchCancel(_ sender: Any) {
        navigator.backToPreviousScreen()
    }
}

extension EditGatewayViewController: MapSelectCoordinatesDelegate {
    
    func mapSelectCoordinatesDelegate(didSelected location: CLLocationCoordinate2D?) {
        if let location = location {
            latitudeTextField.text = "\(location.latitude)"
            longtitudeTextField.text = "\(location.longitude)"
        } else {
            latitudeTextField.text = ""
            longtitudeTextField.text = ""
        }
    }
}

extension EditGatewayViewController: UITextFieldDelegate {
    
    func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
        guard let text = textField.text else { return true }
        let newText = text + string
        if textField == latitudeTextField, let latitude = Double(newText), latitude < -90 || latitude > 90 {
            return false
        } else if textField == longtitudeTextField, let longitude = Double(newText), longitude < -180 || longitude > 180 {
            return false
        }
        guard string == "." || string == "," else { return true }
        if text.contains(".") {
            return false
        }
        if text.isEmpty {
            return false
        }
        if string == "," {
            textField.text = textField.text! + "."
            return false
        }
        return true
    }
}

extension EditGatewayViewController: EditGatewayIView {
    
    func gatewayDeleted() {
        self.showAlertWithMessage(message: Strings.Gateway.gatewayDeleted) {
            self.navigator.backToRootScreen()
        }
    }
    
    func invalidate(error: String) {
        self.showAlertWithMessage(message: error)
    }
    
    func notChangeData() {
        navigator.backToPreviousScreen()
    }
    
    func editGatewaySuccess() {
        self.showAlertWithMessage(message: Strings.Gateway.editGatewaySuccess) {
            self.navigator.backToPreviousScreen()
        }
    }
    
    func showLoadingProgress() {
        self.showLoadingInsideView()
    }
    
    func hideLoadingProgress() {
        self.hideLoadingInsideView()
    }
    
    func showError(error: Error) {
        self.showErrorAlert(error.localizedDescription)
    }
}
