//
//  ListSensorViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/3/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class ListDeviceViewController: BaseUIViewController {
    
    private struct LocalConstants {
        let heightForCell: CGFloat = 110.0
    }
    
    @IBOutlet private weak var searchTextField: UITextField!
    @IBOutlet private weak var tableView: UITableView!
    
    private var presenter: ListDevicePresenter!
    private var navigator: ListDeviceNavigator!
    private var localConstants = LocalConstants()
    
    private var gateway: Gateway!
    private var type: DeviceType!
    private var devices = [Device]()
    private var devicesFilter = [Device]()
    private var isSearch: Bool = false
    
    static func create(gateway: Gateway, type: DeviceType) -> UIViewController {
        let viewController: ListDeviceViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.gateway = gateway
        viewController.devices = gateway.getDevice(type: type)
        viewController.type = type
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = ListDevicePresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, deviceRepository: DeviceRepositoryImpl.shared)
        navigator = ListDeviceNavigatorImpl(viewController: self)
        setupView()
        setupTableView()
        requestData()
    }
    
    @IBAction func didTouchMap(_ sender: Any) {
        navigator.showMapDevicesScreen(gatewayID: gateway.id, type: type)
    }
    
    @IBAction func didTouchAdd(_ sender: Any) {
        navigator.showAddDeviceScreen(defaultGatewayID: gateway.id)
    }
    
    private func setupView() {
        self.title = type.title()
        searchTextField.addTarget(self, action: #selector(textFieldDidChange), for: .editingChanged)
    }
    
    private func setupTableView() {
        self.tableView.dataSource = self
        self.tableView.delegate = self
        self.tableView.registerCell(ofType: GateWayTableViewCell.self)
    }
    
    private func requestData() {
        presenter.observeDeviceAdd(gatewayID: gateway.id)
        presenter.observeDeviceChange(gatewayID: gateway.id)
        presenter.observeDeviceDelete(gatewayID: gateway.id)
    }
    
    @objc func textFieldDidChange(_ textField: UITextField) {
        guard let text = textField.text else {
            self.isSearch = false
            return
        }
        let contentSearch = text.trim()
        self.isSearch = !contentSearch.isEmpty
        devicesFilter = devices.filter({ $0.name.lowercased().contains(contentSearch.lowercased()) })
        self.tableView.reloadData()
    }
}

extension ListDeviceViewController: UITableViewDataSource, UITableViewDelegate {
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return isSearch ? devicesFilter.count : devices.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: GateWayTableViewCell.identifier) as? GateWayTableViewCell else { return UITableViewCell() }
        let device = isSearch ? devicesFilter[indexPath.row] : devices[indexPath.row]
        cell.setup(device: device, type: type)
        return cell
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return localConstants.heightForCell
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let device = isSearch ? devicesFilter[indexPath.row] : devices[indexPath.row]
        if device.type() == .sensor {
            navigator.showSensorNodeDetailsScreen(device: device)
        } else {
            navigator.showValveControllerDetailsScreen(device: device)
        }
    }
}

extension ListDeviceViewController: ListDeviceIView {
    
    func deviceAdded(device: Device) {
        guard type == device.type(), !self.devices.contains(where: { $0.id == device.id }) else { return }
        self.devices.append(device)
        self.tableView.reloadData()
    }
    
    func deviceChanged(device: Device) {
        guard type == device.type(), let indexChange = self.devices.firstIndex(where: { $0.id == device.id }) else { return }
        self.devices[indexChange] = device
        self.tableView.reloadData()
    }
    
    func deviceDeleted(device: Device) {
        guard type == device.type(), let indexDelete = self.devices.firstIndex(where: { $0.id == device.id }) else { return }
        self.devices.remove(at: indexDelete)
        self.tableView.reloadData()
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
