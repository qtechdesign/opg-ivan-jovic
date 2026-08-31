//
//  DrawerNavigationView.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/1/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

enum OptionsDrawerType: CaseIterable {
    case home
    case scanQRCode
    case mapGatewaysAndDevices
    case setting
    case feedback
    case information
    
    func title() -> String {
        switch self {
        case .home:
            return Strings.Navigation.home
        case .scanQRCode:
            return Strings.Navigation.scanQRCode
        case .mapGatewaysAndDevices:
            return Strings.Navigation.mapGatewaysAndDevices
        case .setting:
            return Strings.Navigation.setting
        case .feedback:
            return Strings.Navigation.feedback
        case .information:
            return Strings.Navigation.information
        }
    }
    
    func icon() -> UIImage {
        switch self {
        case .home:
            return #imageLiteral(resourceName: "ic_home")
        case .scanQRCode:
            return #imageLiteral(resourceName: "ic_scan_qr")
        case .mapGatewaysAndDevices:
            return #imageLiteral(resourceName: "ic_map")
        case .setting:
            return #imageLiteral(resourceName: "ic_settings")
        case .feedback:
            return #imageLiteral(resourceName: "ic_feedback")
        case .information:
            return #imageLiteral(resourceName: "ic_information")
        }
    }
}

class DrawerNavigationView: BaseNibView {
    
    private struct LocalConstants {
        let heightForRow: CGFloat = 62.0
    }
    
    @IBOutlet private weak var trallingConstraint: NSLayoutConstraint!
    @IBOutlet private weak var nameLabel: UILabel!
    @IBOutlet private weak var emailLabel: UILabel!
    @IBOutlet private weak var sumGatewaysLabel: UILabel!
    @IBOutlet private weak var sumDevicesLabel: UILabel!
    @IBOutlet private weak var tableView: UITableView!
    
    private var optionsDrawerTypes: [OptionsDrawerType] = OptionsDrawerType.allCases
    private var presenter: DrawerNavigationPresenter!
    private var localConstants = LocalConstants()
    
    private var minPositionDrawer: CGFloat = 0.0
    private var maxPositionDrawer: CGFloat = UIScreen.main.bounds.width * 0.7
    private var originPointTouch: CGPoint?
    private var currentUser: User?
    private var gateways = [Gateway]()
    
    override func setupView() {
        self.isUserInteractionEnabled = false
        presenter = DrawerNavigationPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, gatewayRepository: GatewayRepositoryImpl.shared)
        setupUI()
        setupTableView()
        requestData()
        self.layoutIfNeeded()
    }
    
    @IBAction func didTouchLogout(_ sender: Any) {
        (UIApplication.shared.delegate as? AppDelegate)?.logout()
    }
    
    private func setupUI() {
        nameLabel.text = currentUser?.name ?? Strings.Main.unknow
        emailLabel.text = currentUser?.email ?? Strings.Main.unknow
        sumGatewaysLabel.text = Strings.Navigation.gateways(value: gateways.count)
        var sumDevices = 0
        gateways.forEach({ sumDevices += $0.deviceIDs.count })
        sumDevicesLabel.text = Strings.Navigation.devices(value: sumDevices)
    }
    
    private func requestData() {
        presenter.requestUserInfo()
        presenter.requestGateways()
    }
    
    private func setupTableView() {
        self.tableView.dataSource = self
        self.tableView.delegate = self
        self.tableView.registerCell(ofType: OptionDrawerTableViewCell.self)
    }
}

// MARK: - Handle open/close drawer navagition when move or request
extension DrawerNavigationView {
    
    func touchesBeganDrawerNavigation(_ touches: Set<UITouch>, with event: UIEvent?) {
        self.originPointTouch = touches.first?.location(in: self)
    }
    
    func touchesMovedDrawerNavigation(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let originPointTouch = self.originPointTouch, let touch = touches.first else { return }
        let currentPoint = touch.location(in: self)
        let offsetX = currentPoint.x - originPointTouch.x
        self.moveDrawerNavigation(offset: offsetX)
        self.originPointTouch = currentPoint
    }
    
    func touchesEndedDrawerNavigation(_ touches: Set<UITouch>, with event: UIEvent?) {
        if trallingConstraint.constant < maxPositionDrawer / 2 {
            closeDrawerNavigation()
        } else {
            openDrawerNavigation()
        }
    }
    
    func touchesCancelledDrawerNavigation(_ touches: Set<UITouch>, with event: UIEvent?) {
        if trallingConstraint.constant < maxPositionDrawer / 2 {
            closeDrawerNavigation()
        } else {
            openDrawerNavigation()
        }
    }
    
    func openDrawerNavigation() {
        trallingConstraint.constant = maxPositionDrawer
        self.isUserInteractionEnabled = true
        originPointTouch = nil
    }
    
    func closeDrawerNavigation() {
        self.isUserInteractionEnabled = false
        trallingConstraint.constant = minPositionDrawer
        originPointTouch = nil
    }
    
    private func moveDrawerNavigation(offset: CGFloat) {
        let trailling = trallingConstraint.constant + offset
        if trailling >= maxPositionDrawer {
            trallingConstraint.constant = maxPositionDrawer
        } else if trailling <= minPositionDrawer {
            trallingConstraint.constant = minPositionDrawer
        } else {
            trallingConstraint.constant = trailling
        }
    }
}

// MARK: - Datasource, delegate UITableView
extension DrawerNavigationView: UITableViewDataSource, UITableViewDelegate {
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return optionsDrawerTypes.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: OptionDrawerTableViewCell.identifier, for: indexPath) as? OptionDrawerTableViewCell else { return UITableViewCell() }
        cell.setup(type: optionsDrawerTypes[indexPath.row])
        cell.didTouchCell = { [weak self] type in
            self?.didTouchCell(type: type)
        }
        return cell
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return localConstants.heightForRow
    }
    
    private func didTouchCell(type: OptionsDrawerType) {
        closeDrawerNavigation()
        NotificationCenter.default.post(name: NSNotification.Name.didTouchOptionInDrawerNavigation, object: type)
    }
}

extension DrawerNavigationView: DrawerNavigationIView {
    
    func requestUserInfoSuccess(user: User) {
        self.currentUser = user
        setupUI()
    }
    
    func requestGatewaysSuccess(gateways: [Gateway]) {
        self.gateways = gateways
        setupUI()
    }
}
