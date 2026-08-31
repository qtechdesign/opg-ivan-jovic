//
//  ValveControllerDetailsViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/9/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class ValveControllerDetailsViewController: BaseUIViewController {
    
    @IBOutlet weak var statusLabel: UILabel!
    @IBOutlet weak var imageView: UIImageView!
    @IBOutlet weak var lastUpdateLabel: UILabel!
    @IBOutlet weak var tableView: UITableView!

    private var presenter: ValveControllerDetailsPresenter!
    private var navigator: ValveControllerDetailsNavigator!
    
    private var device: Device!
    private var datas = [DeviceData]()
    
    static func create(device: Device) -> UIViewController {
        let viewController: ValveControllerDetailsViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.device = device
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        navigator = ValveControllerDetailsNavigatorImpl(viewController: self)
        presenter = ValveControllerDetailsPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, deviceRepository: DeviceRepositoryImpl.shared)
        setupUI()
        requestData()
        setupTableView()
    }
    
    private func setupUI() {
        self.title = device.name
        self.statusLabel.text = (device.deviceData?.isOn ?? false) ? Strings.Device.on : Strings.Device.off
        self.statusLabel.textColor = (device.deviceData?.isOn ?? false) ? .green : .red
        self.imageView.image = (device.deviceData?.isOn ?? false) ? #imageLiteral(resourceName: "ic_valve_open.pdf") : #imageLiteral(resourceName: "ic_valve_close.pdf")
        if let timestamp = device.timestamp {
            let date = Date(timeIntervalSince1970: timestamp)
            self.lastUpdateLabel.text = Strings.Device.lastUpdate(time: date.toDateTimeString())
        }
        let editBarButtonItem = UIBarButtonItem(image: #imageLiteral(resourceName: "ic_more_options.pdf"), style: .plain, target: self, action: #selector(didTouchEdit))
        navigationItem.rightBarButtonItem = editBarButtonItem
    }
    
    private func setupTableView() {
        tableView.dataSource = self
    }
    
    private func requestData() {
        presenter.requestDeviceDetails(deviceID: device.id)
        presenter.requestHistoryDeviceData(deviceID: device.id)
    }
    
    private func observeDeviceData() {
        presenter.observeDeviceDetails(deviceID: device.id)
    }

    
    @objc private func didTouchEdit() {
        guard let device = self.device else { return }
        navigator.showEditDeviceScreen(device: device)
    }
    
    @IBAction func didTouchStatus(_ sender: Any) {
        let isOn = device.deviceData?.isOn ?? false
        presenter.requestChangeStatusDevice(gatewayID: device.owner, deviceID: device.id, isOn: !isOn)
    }
    
    @IBAction func didTouchHistory(_ sender: Any) {
    }
    
    @IBAction func didTouchRefresh(_ sender: Any) {
        presenter.requestRefreshData(gatewayID: device.owner, deviceID: device.id)
    }
}

extension ValveControllerDetailsViewController: UITableViewDataSource {
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return datas.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .default, reuseIdentifier: "cell")
        cell.backgroundColor = .clear
        if let isOne = datas[indexPath.row].isOn, let timestamp = datas[indexPath.row].timestamp {
            let date = Date(timeIntervalSince1970: timestamp)
            cell.textLabel?.text = Strings.Device.historyData(time: date.toDateTimeString(), isOne: isOne)
        }
        cell.textLabel?.font = UIFont.boldSystemFont(ofSize: 17.0)
        cell.textLabel?.textColor = ColorUtils.colorPrimaryStatusBar
        cell.textLabel?.textAlignment = .center
        return cell
    }
}

extension ValveControllerDetailsViewController: ValveControllerDetailsIView {
    
    func requestDeviceDetailsSuccess(device: Device) {
        self.device = device
        setupUI()
        observeDeviceData()
    }
    
    func deviceDetailsChanged(device: Device) {
        self.device = device
        setupUI()
    }
    
    func deviceDetailsNotExists() {
        self.showAlertWithMessage(message: Strings.Device.deviceNotExists) { [weak self] in
            self?.navigator.backToPreviousScreen()
        }
    }
    
    func deviceDetailsDeleted() {
        self.showAlertWithMessage(message: Strings.Device.deviceDeleted) { [weak self] in
            self?.navigator.backToPreviousScreen()
        }
    }
    func requestHistoryDeviceDataSuccess(datas: [DeviceData]) {
        self.datas = datas
        self.tableView.reloadData()
        presenter.observeHistoryDeviceDataAdd(deviceID: device.id)
    }
    
    func historyDeviceDataAdded(data: DeviceData) {
        guard !self.datas.contains(where: { $0.id == data.id }) else { return }
        self.datas.insert(data, at: 0)
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
