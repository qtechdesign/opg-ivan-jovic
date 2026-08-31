//
//  SensorNodeDetailsPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/8/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class SensorNodeDetailsPresenterImpl: SensorNodeDetailsPresenter {
    
    private weak var view: SensorNodeDetailsIView!
    private let userRepository: UserRepository
    private let deviceRepository: DeviceRepository
    private let disposeBag = DisposeBag()
    
    init(view: SensorNodeDetailsIView, userRepository: UserRepository, deviceRepository: DeviceRepository) {
        self.view = view
        self.userRepository = userRepository
        self.deviceRepository = deviceRepository
    }
    
    func requestDeviceDetails(deviceID: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        self.view.showLoadingProgress()
        deviceRepository.requestDeviceDetails(userID: userID, deviceID: deviceID)
            .subscribe(onSuccess: { [weak self] (device) in
                self?.view.hideLoadingProgress()
                if let device = device {
                    self?.view.requestDeviceDetailsSuccess(device: device)
                } else {
                    self?.view.deviceDetailsNotExists()
                }
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.deviceDetailsNotExists()
            }.disposed(by: disposeBag)
    }
    
    func observeDeviceDetails(deviceID: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        deviceRepository.observeDeviceDetailsChange(userID: userID, deviceID: deviceID)
            .subscribe(onNext: { [weak self] (device) in
                if let device = device {
                    self?.view.deviceDetailsChanged(device: device)
                } else {
                    self?.view.deviceDetailsDeleted()
                }
            }, onError: { [weak self] (error) in
                self?.view.deviceDetailsDeleted()
            }).disposed(by: disposeBag)
    }
    
    func requestRefreshData(gatewayID: String, deviceID: String) {
        self.view.showLoadingProgress()
        deviceRepository.requestRefreshData(gatewayID: gatewayID, deviceID: deviceID)
            .subscribe(onCompleted: { [weak self] in
                self?.view.hideLoadingProgress()
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
}
