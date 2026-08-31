//
//  AddDeviceViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/13/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

class AddDeviceViewController: BaseUIViewController {
    
    @IBOutlet weak var gatewayNameLabel: UILabel!
    @IBOutlet weak var loraIDTextField: UITextField!
    @IBOutlet weak var nameTextField: UITextField!
    @IBOutlet weak var serialKeyTextField: UITextField!
    @IBOutlet weak var latitudeTextField: UITextField!
    @IBOutlet weak var longitudeTextField: UITextField!
    
    private var presenter: AddDevicePresenter!
    private var navigator: AddDeviceNavigator!
    
    private var defaultGatewayID: String?
    private var gatewaySeleted: Gateway?
    private var gateways = [Gateway]()
    private var location: CLLocationCoordinate2D?
    
    static func create(defaultGatewayID: String?) -> UIViewController {
        let viewController: AddDeviceViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.defaultGatewayID = defaultGatewayID
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = AddDevicePresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, deviceRepository: DeviceRepositoryImpl.shared, gatewayRepository: GatewayRepositoryImpl.shared)
        navigator = AddDeviceNavigatorImpl(viewController: self)
        setupUI()
        requestData()
    }
    
    private func setupUI() {
        self.title = Strings.Device.addDevice
    }
    
    private func requestData() {
        presenter.requestListGateway()
    }
    
    @IBAction func didTouchSelectGateway(_ sender: Any) {
        let alert = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
        for gateway in gateways {
            let action = UIAlertAction(title: gateway.name, style: .default) { [weak self] (_) in
                self?.didTouchGateway(gateway: gateway)
            }
            alert.addAction(action)
        }
        let cancelAction = UIAlertAction(title: Strings.Main.cancel, style: .cancel)
        alert.addAction(cancelAction)
        self.present(alert, animated: true, completion: nil)
    }
    
    private func didTouchGateway(gateway: Gateway) {
        gatewaySeleted = gateway
        gatewayNameLabel.text = gateway.name
    }
    
    @IBAction func didTouchScanQRCode(_ sender: Any) {
        navigator.showScanQRCodeScreen(delegate: self)
    }
    
    @IBAction func didTouchSelectLocation(_ sender: Any) {
        navigator.showMapSelectCoordinates(location: location, delegate: self)
    }
    
    @IBAction func didTouchSave(_ sender: Any) {
        guard let loraID = self.loraIDTextField.text,
            let name = self.nameTextField.text,
            let serialKey = serialKeyTextField.text,
            let lat = self.latitudeTextField.text,
            let long = self.longitudeTextField.text else {
                return
        }
        presenter.addNewDevice(gatewaySeleted: gatewaySeleted, loraID: loraID, name: name, serialKey: serialKey, lat: lat, long: long)
    }
    
    @IBAction func didTouchCancel(_ sender: Any) {
        navigator.backToPreviousScreen()
    }
}

extension AddDeviceViewController: MapSelectCoordinatesDelegate {
    
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

extension AddDeviceViewController: ScanQRCodeDelegate {
    
    func scanningQRSucceededWithCode(code: String) {
        navigator.backToPreviousScreen()
        serialKeyTextField.text = code
    }
}

extension AddDeviceViewController: AddDeviceIView {
    
    func requestListGatewaySuccess(gateways: [Gateway]) {
        self.gateways = gateways
        if let defaultGateway = gateways.first(where: { $0.id == defaultGatewayID }) {
            didTouchGateway(gateway: defaultGateway)
        }
    }
    
    func addNewDeviceSuccess() {
        self.showAlertWithMessage(message: Strings.Device.addNewDeviceSuccess) {
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
