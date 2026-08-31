//
//  DrawerNavigationPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/2/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class DrawerNavigationPresenterImpl: DrawerNavigationPresenter {
    
    private weak var view: DrawerNavigationIView!
    private var userRepository: UserRepository
    private var gatewayRepository: GatewayRepository
    private var disposeBag = DisposeBag()
    
    init(view: DrawerNavigationIView, userRepository: UserRepository, gatewayRepository: GatewayRepository) {
        self.view = view
        self.userRepository = userRepository
        self.gatewayRepository = gatewayRepository
    }
    
    func requestUserInfo() {
        guard let currentUserID = userRepository.getCurrentUserID() else { return }
        userRepository.requestUserInfo(userID: currentUserID)
            .subscribe(onSuccess: { [weak self] (user) in
                guard let user = user else { return }
                self?.view.requestUserInfoSuccess(user: user)
            }).disposed(by: disposeBag)
    }
    
    func requestGateways() {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.requestGateways(userID: userID)
            .subscribe(onSuccess: { [weak self] (gateways) in
                self?.view.requestGatewaysSuccess(gateways: gateways)
            }).disposed(by: disposeBag)
    }
}
