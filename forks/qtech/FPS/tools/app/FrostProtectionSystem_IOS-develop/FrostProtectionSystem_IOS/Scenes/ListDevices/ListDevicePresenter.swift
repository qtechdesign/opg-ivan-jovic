//
//  ListSensorPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/4/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class ListDevicePresenterImpl: ListDevicePresenter {
    
    private weak var view: ListDeviceIView!
    private let userRepository: UserRepository
    private let deviceRepository: DeviceRepository
    private let disposeBag = DisposeBag()
    
    init(view: ListDeviceIView, userRepository: UserRepository, deviceRepository: DeviceRepository) {
        self.view = view
        self.userRepository = userRepository
        self.deviceRepository = deviceRepository
    }
    
    func observeDeviceAdd(gatewayID: String) {
        deviceRepository.observeDeviceAdd(gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (device) in
                self?.view.deviceAdded(device: device)
            }).disposed(by: disposeBag)
    }
    
    func observeDeviceChange(gatewayID: String) {
        deviceRepository.observeDeviceChange(gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (device) in
                self?.view.deviceChanged(device: device)
            }).disposed(by: disposeBag)
    }
    
    func observeDeviceDelete(gatewayID: String) {
        deviceRepository.observeDeviceDelete(gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (device) in
                self?.view.deviceDeleted(device: device)
            }).disposed(by: disposeBag)
    }
}
