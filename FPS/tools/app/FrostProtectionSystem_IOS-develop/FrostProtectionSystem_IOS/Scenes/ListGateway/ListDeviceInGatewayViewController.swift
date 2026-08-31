//
//  GatewayDetailsViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/31/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

enum DeviceType: String, CaseIterable {
    case sensor = "SensorNodes"
    case valve = "ValveControllers"
    
    func title() -> String {
        return self.rawValue
    }
    
    func image() -> UIImage {
        switch self {
        case .sensor:
            return #imageLiteral(resourceName: "ic_sensor_node.pdf")
        case .valve:
            return #imageLiteral(resourceName: "ic_valves_node.pdf")
        }
    }
}

class ListDeviceInGatewayViewController: BaseUIViewController {
    
    private struct LocalConstants {
        let heightForCell: CGFloat = 110.0
    }
    
    @IBOutlet private weak var tableView: UITableView!
    
    private var navigator: ListDeviceInGatewayNavigator!
    private var presenter: ListDeviceInGatewayPresenter!
    private var localConstants = LocalConstants()
    
    private var gatewayID: String!
    private var gateway: Gateway?
    private var deviceTypes = DeviceType.allCases
    
    static func create(gatewayID: String) -> UIViewController {
        let viewController: ListDeviceInGatewayViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.gatewayID = gatewayID
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        navigator = ListDeviceInGatewayNavigatorImpl(viewController: self)
        presenter = ListDeviceInGatewayPresenterImpl(view: self, userRepostory: UserRepositoryImpl.shared, gatewayRepository: GatewayRepositoryImpl.shared)
        setupUI()
        setupTableView()
        requestData()
    }
    
    @IBAction func didTouchMap(_ sender: Any) {
        navigator.showMapGatewayScreen(gatewayID: gatewayID)
    }
    
    @IBAction func didTouchAdd(_ sender: Any) {
        navigator.showAddDeviceScreen(defaultGatewayID: gatewayID)
    }
    
    private func setupUI() {
        self.title = gateway?.name
        let editBarButtonItem = UIBarButtonItem(image: #imageLiteral(resourceName: "ic_more_options.pdf"), style: .plain, target: self, action: #selector(didTouchEdit))
        navigationItem.rightBarButtonItem = editBarButtonItem
    }
    
    @objc private func didTouchEdit() {
        guard let gateway = self.gateway else { return }
        navigator.showEditGatewayScreen(gateway: gateway)
    }
    
    private func setupTableView() {
        tableView.dataSource = self
        tableView.delegate = self
        tableView.registerCell(ofType: GateWayTableViewCell.self)
    }
    
    private func requestData() {
        presenter.requestGatewayDetail(gatewayID: gatewayID)
    }
    
    private func obseveGatewayData() {
        presenter.observeGatewayDetailChange(gatewayID: gatewayID)
        presenter.observeGatewayDelete(gatewayID: gatewayID)
    }
}

extension ListDeviceInGatewayViewController: UITableViewDataSource, UITableViewDelegate {
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return deviceTypes.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: GateWayTableViewCell.identifier) as? GateWayTableViewCell else { return UITableViewCell() }
        let type = deviceTypes[indexPath.row]
        cell.setup(gateway: gateway, type: type)
        return cell
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return localConstants.heightForCell
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let type = deviceTypes[indexPath.row]
        guard let gateway = self.gateway else { return }
        self.navigator.showListSensorScreen(gateway: gateway, type: type)
    }
}

extension ListDeviceInGatewayViewController: ListDeviceInGatewayIView {
    
    func requestGatewayDetailSuccess(gateway: Gateway?) {
        guard let gateway = gateway else {
            self.showAlertWithMessage(message: Strings.Gateway.gatewayNotExists) { [weak self] in
                self?.navigator.backToPreviousScreen()
            }
            return
        }
        self.gateway = gateway
        self.setupUI()
        self.tableView.reloadData()
        obseveGatewayData()
    }
    
    func gatewayDetailChanged(gateway: Gateway) {
        self.gateway = gateway
        self.setupUI()
        self.tableView.reloadData()
    }
    
    func gatewayDetailDeleted() {
        self.showAlertWithMessage(message: Strings.Gateway.gatewayDeleted) { [weak self] in
            self?.navigator.backToRootScreen()
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
