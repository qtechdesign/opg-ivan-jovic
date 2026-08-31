//
//  HomPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/29/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class HomePresenterImpl: HomePresenter {
    
    private weak var view: HomeIView!
    private let userRepository: UserRepository
    private let gatewayRepository: GatewayRepository
    
    private var disposeBag = DisposeBag()
    
    init(view: HomeIView, gatewayRepository: GatewayRepository, userRepository: UserRepository) {
        self.view = view
        self.gatewayRepository = gatewayRepository
        self.userRepository = userRepository
    }
    
    func requestGateways() {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.requestGateways(userID: userID)
            .subscribe(onSuccess: { [weak self] (gateways) in
                self?.view.requestGatewaysSuccess(gateways: gateways)
            }) { [weak self] (error) in
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    func observeGatewayAdd() {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.observeGatewayAdd(userID: userID)
            .subscribe(onNext: { [weak self] (gateway) in
                self?.view.gatewayAdded(gateway: gateway)
            }).disposed(by: disposeBag)
    }
    
    func observeGatewayChange(gatewayID: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.observeGatewayChange(userID: userID, gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (gateway) in
                self?.view.gatewayChanged(gateway: gateway)
            }).disposed(by: disposeBag)
    }
    
    func observeGatewayDelete(gatewayID: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.observeGatewayDelete(userID: userID, gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (gateway) in
                self?.view.gatewayDeleted(gateway: gateway)
            }).disposed(by: disposeBag)
    }
}
