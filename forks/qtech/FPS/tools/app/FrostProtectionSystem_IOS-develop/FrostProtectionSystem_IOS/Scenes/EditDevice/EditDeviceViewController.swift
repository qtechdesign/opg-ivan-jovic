//
//  EditDeviceViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/13/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import GoogleMaps

class EditDeviceViewController: BaseUIViewController {
    
    @IBOutlet weak var gatewayIDLabel: UILabel!
    @IBOutlet weak var deviceIDLabel: UILabel!
    @IBOutlet weak var loraIDTextField: UITextField!
    @IBOutlet weak var nameTextField: UITextField!
    @IBOutlet weak var latitudeTextField: UITextField!
    @IBOutlet weak var longitudeTextField: UITextField!
    
    private var presenter: EditDevicePresenter!
    private var navigator: EditDeviceNavigator!
    
    private var device: Device!
    private var newLocation: CLLocationCoordinate2D?
    
    static func create(device: Device) -> UIViewController {
        let viewController: EditDeviceViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.device = device
        viewController.newLocation = device.location
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = EditDevicePresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, deviceRepository: DeviceRepositoryImpl.shared)
        navigator = EditDeviceNavigatorImpl(viewController: self)
        setupUI()
    }
    
    private func setupUI() {
        title = device.name
        gatewayIDLabel.text = Strings.Device.gatewayID(gatewayID: device.ownerPublicKey ?? device.owner)
        deviceIDLabel.text = Strings.Device.deviceID(deviceID: device.publicKey ?? device.id)
        nameTextField.text = device.name
        loraIDTextField.text = device.loraID
        if let location = device.location {
            latitudeTextField.text = "\(location.latitude)"
            longitudeTextField.text = "\(location.longitude)"
        }
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .trash, target: self, action: #selector(didTouchDeleteGateway))
    }
    
    @objc private func didTouchDeleteGateway() {
        self.showConfirmMessage(message: Strings.Gateway.confirmDeleteAllDataOfDevices, clickNoButton: {
            self.presenter.deleteDevice(gatewayID: self.device.owner, deviceID: self.device.id, isDeleteLog: false)
        }) {
            self.presenter.deleteDevice(gatewayID: self.device.owner, deviceID: self.device.id, isDeleteLog: true)
        }
    }
    @IBAction func didTouchAutoFillCoordinate(_ sender: Any) {
        navigator.showMapSelectCoordinates(location: device.location, delegate: self)
    }
    
    @IBAction func didTouchSave(_ sender: Any) {
        guard let loraID = self.loraIDTextField.text?.convertLoraIDToHex(), let name = self.nameTextField.text, let lat = latitudeTextField.text, let long = longitudeTextField.text else { return }
        if !loraID.isLoraID() {
            self.showErrorAlert(Strings.Device.loraIDMustHave4CharactersAndCorrectFormat)
            return
        }
        guard lat.isEmpty && long.isEmpty || !lat.isEmpty && !long.isEmpty else {
            self.showErrorAlert(Strings.Gateway.pleaseEnterCoordinates)
            return
        }
        guard !name.trim().isEmpty else {
            self.showErrorAlert(Strings.Gateway.nameCannotEmpty)
            return
        }
        var location: CLLocationCoordinate2D?
        if let latitudeDouble = Double(lat), let longitudeDouble = Double(long),
            let latitide = CLLocationDegrees(exactly: latitudeDouble), let longitude = CLLocationDegrees(exactly: longitudeDouble) {
            location = CLLocationCoordinate2D(latitude: latitide, longitude: longitude)
        }
        presenter.editDevice(device: device, loraID: loraID, name: name, location: location)
    }
    
    @IBAction func didTouchCancel(_ sender: Any) {
        navigator.backToPreviousScreen()
    }
}
extension EditDeviceViewController: MapSelectCoordinatesDelegate {
    
    func mapSelectCoordinatesDelegate(didSelected location: CLLocationCoordinate2D?) {
        newLocation = location
        if let location = location {
            latitudeTextField.text = "\(location.latitude)"
            longitudeTextField.text = "\(location.longitude)"
        } else {
            latitudeTextField.text = ""
            longitudeTextField.text = ""
        }
    }
}

extension EditDeviceViewController: EditDeviceIView {
    
    func notChangeData() {
        navigator.backToPreviousScreen()
    }
    
    func editDeviceSuccess() {
        self.showAlertWithMessage(message: Strings.Device.editDeviceSuccess) {
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
