//
//  HomeViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/27/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class HomeViewController: BaseUIViewController {
    
    private struct LocalConstants {
        let heightForCell: CGFloat = 110.0
    }
    
    @IBOutlet private weak var searchTextField: UITextField!
    @IBOutlet private weak var tableView: UITableView!
    
    private var presenter: HomePresenter!
    private var navigator: HomeNavigator!
    private var localConstants = LocalConstants()
    
    private var gateways = [Gateway]() {
        didSet {
            if isSearch, let contentSearch = searchTextField.text {
                gatewaysFilter = gateways.filter({ $0.name.lowercased().contains(contentSearch.lowercased()) })
            }
        }
    }
    private var gatewaysFilter = [Gateway]()
    private var isSearch: Bool = false
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = HomePresenterImpl(view: self, gatewayRepository: GatewayRepositoryImpl(), userRepository: UserRepositoryImpl.shared)
        navigator = HomeNavigatorImpl(viewController: self)
        setupUI()
        observeDidTouchOptionDrawerNavigation()
        setupTableView()
        requestData()
    }
    
    @IBAction func didTouchMap(_ sender: Any) {
        let gatewayIDs = self.gateways.map({ $0.id })
        navigator.showMapScreen(gatewayIDs: gatewayIDs)
    }
    
    @IBAction func didTouchAdd(_ sender: Any) {
        navigationController?.pushViewController(AddGatewayViewController.create(), animated: true)
    }
    
    private func setupUI() {
        self.title = Strings.Main.home
        hideKeyboardWhenTappedAround()
        searchTextField.addTarget(self, action: #selector(textFieldDidChange), for: .editingChanged)
        navigationItem.leftBarButtonItem = UIBarButtonItem(image: #imageLiteral(resourceName: "ic_menu.pdf"), style: .plain, target: self, action: #selector(showMenu))
    }
    
    private func observeDidTouchOptionDrawerNavigation() {
        NotificationCenter.default.addObserver(self, selector: #selector(didTouchNavigation), name: NSNotification.Name.didTouchOptionInDrawerNavigation, object: nil)
    }
    
    @objc private func didTouchNavigation(notification: Notification) {
        guard notification.name == NSNotification.Name.didTouchOptionInDrawerNavigation, let type = notification.object as? OptionsDrawerType else { return }
        switch type {
        case .home:
            break
        case .scanQRCode:
            navigator.showScanQRCodeScreen(delegate: self)
        case .mapGatewaysAndDevices:
            let gatewayIDs = self.gateways.map({ $0.id })
            navigator.showMapScreen(gatewayIDs: gatewayIDs)
        case .setting:
            navigator.showSettingScreen()
        case .feedback:
            break
        case .information:
            navigator.showInformationScreen()
        }
    }
    
    @objc private func showMenu() {
        (UIApplication.shared.delegate as? AppDelegate)?.openDrawerNavigation()
    }
    
    private func setupTableView() {
        self.tableView.dataSource = self
        self.tableView.delegate = self
        self.tableView.registerCell(ofType: GateWayTableViewCell.self)
    }
    
    private func requestData() {
        self.presenter.requestGateways()
        self.presenter.observeGatewayAdd()
    }
    
    private func observeGatewayData(gatewayID: String) {
        presenter.observeGatewayChange(gatewayID: gatewayID)
        presenter.observeGatewayDelete(gatewayID: gatewayID)
    }
    
    @objc func textFieldDidChange(_ textField: UITextField) {
        guard let text = textField.text else {
            self.isSearch = false
            return
        }
        let contentSearch = text.trim()
        self.isSearch = !contentSearch.isEmpty
        gatewaysFilter = gateways.filter({ $0.name.lowercased().contains(contentSearch.lowercased()) })
        self.tableView.reloadData()
    }
}

extension HomeViewController: UITableViewDataSource, UITableViewDelegate {
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return isSearch ? gatewaysFilter.count : gateways.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: GateWayTableViewCell.identifier) as? GateWayTableViewCell else { return UITableViewCell() }
        let gateway = isSearch ? gatewaysFilter[indexPath.row] : gateways[indexPath.row]
        cell.setup(gateway: gateway)
        return cell
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return localConstants.heightForCell
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let gateway = isSearch ? gatewaysFilter[indexPath.row] : gateways[indexPath.row]
        self.navigator.showListDeviceInGatewayScreen(gateway: gateway)
    }
}

extension HomeViewController: ScanQRCodeDelegate {
    
    func scanningQRSucceededWithCode(code: String) {
        navigator.showFoundGatewayOrDeviceScreen(qrCode: code)
    }
}

extension HomeViewController: HomeIView {
    
    func requestGatewaysSuccess(gateways: [Gateway]) {
        self.gateways = gateways
        for gateway in gateways {
            observeGatewayData(gatewayID: gateway.id)
        }
        self.tableView.reloadData()
    }
    
    func gatewayAdded(gateway: Gateway) {
        guard !self.gateways.contains(where: { $0.id == gateway.id }) else {
            return
        }
        self.gateways.append(gateway)
        observeGatewayData(gatewayID: gateway.id)
        self.tableView.reloadData()
    }
    
    func gatewayChanged(gateway: Gateway) {
        guard let indexChanged = self.gateways.firstIndex(where: { $0.id == gateway.id }) else { return }
        self.gateways[indexChanged] = gateway
        self.tableView.reloadData()
     }
    
    func gatewayDeleted(gateway: Gateway) {
        guard let indexDeleted = self.gateways.firstIndex(where: { $0.id == gateway.id }) else { return }
        self.gateways.remove(at: indexDeleted)
        self.tableView.reloadData()
    }
    
    func showLoadingProgress() {
        showLoadingInsideView()
    }
    
    func hideLoadingProgress() {
        hideLoadingInsideView()
    }
    
    func showError(error: Error) {
        self.showErrorAlert(error.localizedDescription)
    }
}
