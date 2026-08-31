//
//  ListGatewayPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/6/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class ListDeviceInGatewayPresenterImpl: ListDeviceInGatewayPresenter {
    
    private weak var view: ListDeviceInGatewayIView!
    private let userRepository: UserRepository
    private let gatewayRepository: GatewayRepository
    private let disposeBag = DisposeBag()
    
    init(view: ListDeviceInGatewayIView, userRepostory: UserRepository, gatewayRepository: GatewayRepository) {
        self.view = view
        self.userRepository = userRepostory
        self.gatewayRepository = gatewayRepository
    }
    
    func requestGatewayDetail(gatewayID: String) {
        self.view.showLoadingProgress()
        gatewayRepository.requestGatewayDetails(gatewayID: gatewayID)
            .subscribe(onSuccess: { [weak self] (gateway) in
                self?.view.hideLoadingProgress()
                self?.view.requestGatewayDetailSuccess(gateway: gateway)
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.requestGatewayDetailSuccess(gateway: nil)
            }.disposed(by: disposeBag)
    }
    
    func observeGatewayDetailChange(gatewayID: String) {
        gatewayRepository.observeGatewayDetailChange(gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (gateway) in
                if let gateway = gateway {
                    self?.view.gatewayDetailChanged(gateway: gateway)
                } else {
                    self?.view.gatewayDetailDeleted()
                }
            }).disposed(by: disposeBag)
    }
    
    func observeGatewayDelete(gatewayID: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.observeGatewayDelete(userID: userID, gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (gateway) in
                self?.view.gatewayDetailDeleted()
            }).disposed(by: disposeBag)
    }
}
