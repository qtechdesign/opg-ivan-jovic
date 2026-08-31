//
//  AddGatewayViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/12/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

class AddGatewayViewController: BaseUIViewController {
    
    @IBOutlet weak var nameTextField: UITextField!
    @IBOutlet weak var gatewayIDTextField: UITextField!
    @IBOutlet weak var latitudeTextField: UITextField!
    @IBOutlet weak var longitudeTextField: UITextField!
    
    private var navigator: AddGatewayNavigator!
    private var presenter: AddGatewayPresenter!
    
    private var location: CLLocationCoordinate2D?
    
    static func create() -> UIViewController {
        let viewController: AddGatewayViewController = UIViewController.createViewControllerFromMainStoryboard()
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        navigator = AddGatewayNavigatorImpl(viewController: self)
        presenter = AddGatewayPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, gatewayRepository: GatewayRepositoryImpl.shared)
        setupUI()
    }
    
    private func setupUI() {
        self.title = Strings.AddGateway.addGateway
    }
}

// MARK: - Actions
extension AddGatewayViewController {
    
    @IBAction func didTouchAutoFillLocation(_ sender: Any) {
        navigator.showMapSelectCoordinates(location: location, delegate: self)
    }
    
    @IBAction func didTouchSave(_ sender: Any) {
        guard let name = self.nameTextField.text,
            let serialKey = gatewayIDTextField.text,
            let lat = self.latitudeTextField.text,
            let long = self.longitudeTextField.text else {
                return
        }
        presenter.addNewGateway(name: name, serialKey: serialKey, lat: lat, long: long)
    }
    
    @IBAction func didTouchCancel(_ sender: Any) {
        navigator.backToPreviousScreen()
    }
    
    @IBAction func didTouchQRCode(_ sender: Any) {
        navigator.showScanQRCodeScreen(delegate: self)
    }
}

extension AddGatewayViewController: MapSelectCoordinatesDelegate {
    
    func mapSelectCoordinatesDelegate(didSelected location: CLLocationCoordinate2D?) {
        self.location = location
        if let location = location {
            latitudeTextField.text = "\(location.latitude)"
            longitudeTextField.text = "\(location.longitude)"
        } else {
            latitudeTextField.text = ""
            longitudeTextField.text = ""
        }
    }
}

extension AddGatewayViewController: ScanQRCodeDelegate {
    
    func scanningQRSucceededWithCode(code: String) {
        navigator.backToPreviousScreen()
        gatewayIDTextField.text = code
    }
}

extension AddGatewayViewController: AddGatewayIView {
    
    func addNewGatewaySuccess() {
        self.showAlertWithMessage(message: Strings.Gateway.addNewGatewaySuccess) {
            self.navigator.backToPreviousScreen()
        }
    }
    
    func invalidate(error: String) {
        self.showAlertWithMessage(message: error)
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
