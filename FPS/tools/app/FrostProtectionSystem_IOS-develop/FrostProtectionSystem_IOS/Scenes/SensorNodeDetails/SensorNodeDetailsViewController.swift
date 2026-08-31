//
//  SensorNodeDetailsViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/7/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

class SensorNodeDetailsViewController: BaseUIViewController {
    
    private struct LocalConstants {
        let sectionInsets = UIEdgeInsets(top: 0.0, left: 0.0, bottom: 0.0, right: 0.0)
        let itemsPerRow: CGFloat = 2
        let heightPerItem: CGFloat = 80.0
        let contentSize = "contentSize"
    }
    
    @IBOutlet weak var collectionView: UICollectionView!
    @IBOutlet weak var lastUpdateLabel: UILabel!
    @IBOutlet weak var tableViewHeightConstraint: NSLayoutConstraint!
    
    private var presenter: SensorNodeDetailsPresenter!
    private var navigator: SensorNodeDetailsNavigator!
    private let localConstants = LocalConstants()
    
    private var deviceID: String!
    private var deviceName: String!
    private var device: Device?
    private var datas = [DeviceData.Data]()
    
    static func create(deviceID: String, deviceName: String) -> UIViewController {
        let viewController: SensorNodeDetailsViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.deviceID = deviceID
        viewController.deviceName = deviceName
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        navigator = SensorNodeDetailsNavigatorImpl(viewController: self)
        presenter = SensorNodeDetailsPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, deviceRepository: DeviceRepositoryImpl.shared)
        setupUI()
        self.datas = defaultDatas()
        setupCollectionView()
        requestData()
    }
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        guard let collectionView = object as? UICollectionView,
            collectionView == self.collectionView && keyPath == localConstants.contentSize else { return }
        self.tableViewHeightConstraint.constant = collectionView.contentSize.height
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        self.collectionView.addObserver(self, forKeyPath: localConstants.contentSize, options: .new, context: nil)
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        collectionView.removeObserver(self, forKeyPath: localConstants.contentSize)
    }
    
    @IBAction func didTouchRefresh(_ sender: Any) {
        guard let device = self.device else { return }
        presenter.requestRefreshData(gatewayID: device.owner, deviceID: device.id)
    }
    
    @IBAction func didTouchHistory(_ sender: Any) {
        navigator.showChartScreen(deviceID: deviceID)
    }
    
    private func setupUI() {
        self.title = device?.name ?? deviceName
        let editBarButtonItem = UIBarButtonItem(image: #imageLiteral(resourceName: "ic_more_options.pdf"), style: .plain, target: self, action: #selector(didTouchEdit))
        navigationItem.rightBarButtonItem = editBarButtonItem
    }
    
    @objc private func didTouchEdit() {
        guard let device = self.device else { return }
        navigator.showEditDeviceScreen(device: device)
    }
    
    private func setupCollectionView() {
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.registerCell(ofType: ValueSensorCollectionViewCell.self)
    }
    
    private func requestData() {
        presenter.requestDeviceDetails(deviceID: deviceID)
    }
    
    private func observeDeviceData() {
        presenter.observeDeviceDetails(deviceID: deviceID)
    }
    
    private func defaultDatas() -> [DeviceData.Data] {
        let datas = DeviceData.DeviceDataType.allCases.map({ DeviceData.Data(value: "", type: $0) })
        return datas
    }
}

extension SensorNodeDetailsViewController: UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {
    
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return datas.count
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: ValueSensorCollectionViewCell.identifier, for: indexPath) as! ValueSensorCollectionViewCell
        let data = datas[indexPath.row]
        let isLastIndexAndNumberEven = indexPath.row == datas.count - 1 && indexPath.row % 2 == 0
        cell.setup(data: data, isCenter: isLastIndexAndNumberEven)
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        let paddingSpace: CGFloat = localConstants.sectionInsets.left * (localConstants.itemsPerRow + 1)
        let availableWidth = collectionView.bounds.width - paddingSpace
        let widthPerItem = availableWidth / localConstants.itemsPerRow
        let isLastIndexAndNumberEven = indexPath.row == datas.count - 1 && indexPath.row % 2 == 0
        if isLastIndexAndNumberEven {
            return CGSize(width: collectionView.bounds.width - localConstants.sectionInsets.left * 2, height: localConstants.heightPerItem)
        } else {
            return CGSize(width: widthPerItem, height: localConstants.heightPerItem)
        }
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, insetForSectionAt section: Int) -> UIEdgeInsets {
        return localConstants.sectionInsets
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, minimumInteritemSpacingForSectionAt section: Int) -> CGFloat {
        return 0
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, minimumLineSpacingForSectionAt section: Int) -> CGFloat {
        return localConstants.sectionInsets.left
    }
}

extension SensorNodeDetailsViewController: SensorNodeDetailsIView {
    
    func requestDeviceDetailsSuccess(device: Device) {
        self.device = device
        self.datas = device.deviceData?.datas ?? defaultDatas()
        if let timestamp = device.deviceData?.timestamp {
            let date = Date(timeIntervalSince1970: timestamp)
            self.lastUpdateLabel.text = Strings.Device.lastUpdate(time: date.toDateTimeString())
        }
        setupUI()
        self.collectionView.reloadData()
        observeDeviceData()
    }
    
    func deviceDetailsChanged(device: Device) {
        self.device = device
        self.datas = device.deviceData?.datas ?? defaultDatas()
        if let timestamp = device.deviceData?.timestamp {
            let date = Date(timeIntervalSince1970: timestamp)
            self.lastUpdateLabel.text = Strings.Device.lastUpdate(time: date.toDateTimeString())
        } else {
            self.lastUpdateLabel.text = Strings.Device.lastUpdate(time: "")
        }
        setupUI()
        self.collectionView.reloadData()
    }
    
    func deviceDetailsNotExists() {
        self.showAlertWithMessage(message: Strings.Device.deviceNotExists) { [weak self] in
            self?.navigator.backToPreviousScreen()
        }
    }
    
    func deviceDetailsDeleted() {
        self.showAlertWithMessage(message: Strings.Device.deviceDeleted) { [weak self] in
            self?.navigator.backToListDeviceScreen()
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
