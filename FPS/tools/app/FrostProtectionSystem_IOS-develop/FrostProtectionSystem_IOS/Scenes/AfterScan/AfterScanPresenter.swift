//
//  AfterScanPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/21/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class AfterScanPresenterImpl: AfterScanPresenter {
    
    private weak var view: AfterScanIView!
    private let userRepository: UserRepository
    private let deviceRepository: DeviceRepository
    private let gatewayRepository: GatewayRepository
    
    private let disposeBag = DisposeBag()
    
    init(view: AfterScanIView, userRepository: UserRepository, deviceRepository: DeviceRepository, gatewayRepository: GatewayRepository) {
        self.view = view
        self.userRepository = userRepository
        self.deviceRepository = deviceRepository
        self.gatewayRepository = gatewayRepository
    }
    
    func requestGatewayOrDevice(qrCode: String) {
        guard let currentUserID = userRepository.getCurrentUserID() else { return }
        self.view.showLoadingProgress()
        userRepository.requestGatewayOrDeviceIDFromSerialKey(serialKey: qrCode)
            .flatMap { [weak self] (id, isGateway) -> Single<Any?> in
                guard let self = self else { return Single.never() }
                guard let id = id else {
                    self.view.notFoundGatewayOrDevice()
                    self.view.hideLoadingProgress()
                    return Single.never()
                }
                guard let isGateway = isGateway else {
                    self.view.invalidate(error: Strings.Main.somethingWrong)
                    self.view.hideLoadingProgress()
                    return Single.never()
                }
                if isGateway {
                    return self.gatewayRepository.requestGatewayDetails(gatewayID: id).map({ $0 as Any? })
                } else {
                    return self.deviceRepository.requestDeviceDetails(userID: currentUserID, deviceID: id).map({ $0 as Any? })
                }
            }.subscribe(onSuccess: { [weak self] (object) in
                self?.view.hideLoadingProgress()
                switch object {
                case let gateway as Gateway:
                    self?.view.foundedGateway(gateway: gateway)
                case let device as Device:
                    self?.view.foundedDevice(device: device)
                default:
                    self?.view.invalidate(error: Strings.Main.somethingWrong)
                }
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.notFoundGatewayOrDevice()
            }.disposed(by: disposeBag)
    }
}
