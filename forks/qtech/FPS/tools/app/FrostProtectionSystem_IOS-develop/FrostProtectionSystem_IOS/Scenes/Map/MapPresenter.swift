//
//  MapPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/14/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class MapPresenterImpl: MapPresenter {
    
    private weak var view: MapIView!
    private let userRepository: UserRepository
    private let gatewayRepository: GatewayRepository
    private let disposeBag = DisposeBag()
    
    init(view: MapIView, userRepository: UserRepository, gatewayRepository: GatewayRepository) {
        self.view = view
        self.userRepository = userRepository
        self.gatewayRepository = gatewayRepository
    }
    
    func observeGatewayAdd() {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.observeGatewayAdd(userID: userID)
            .subscribe(onNext: { [weak self] (gateway) in
                self?.view.gatewayAdded(gatewayID: gateway.id)
            }).disposed(by: disposeBag)
    }
    
    func observeGatewayData(gatewayID: String) {
        gatewayRepository.observeGatewayDetailChange(gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (gateway) in
                if let gateway = gateway {
                    self?.view.gatewayDataChanged(gateway: gateway)
                } else {
                    self?.view.gatewayDeleted(gatewayID: gatewayID)
                }
            }).disposed(by: disposeBag)
    }
    
    func observeGatewayDelete(gatewayID: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.observeGatewayDelete(userID: userID, gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (gateway) in
                self?.view.gatewayDeleted(gatewayID: gateway.id)
            }).disposed(by: disposeBag)
    }
}
