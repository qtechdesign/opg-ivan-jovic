//
//  EditDevicePresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/17/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import GoogleMaps
import RxSwift

class EditDevicePresenterImpl: EditDevicePresenter {
    
    private weak var view: EditDeviceIView!
    private let userRepository: UserRepository
    private let deviceRepository: DeviceRepository
    private let disposeBag = DisposeBag()
    
    init(view: EditDeviceIView, userRepository: UserRepository, deviceRepository: DeviceRepository) {
        self.view = view
        self.userRepository = userRepository
        self.deviceRepository = deviceRepository
    }
    
    func editDevice(device: Device, loraID: String, name: String, location: CLLocationCoordinate2D?) {
        guard isHaveChanged(device: device, loraID: loraID, name: name, location: location) else {
            self.view.notChangeData()
            return
        }
        deviceRepository.editInfoDevice(gatewayID: device.owner, deviceID: device.id, loraID: loraID, name: name, location: location)
            .subscribe(onCompleted: { [weak self] in
                self?.view.editDeviceSuccess()
            }) { [weak self] (error) in
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    func deleteDevice(gatewayID: String, deviceID: String, isDeleteLog: Bool) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        self.view.showLoadingProgress()
        deviceRepository.deleteDevice(userID: userID, gatewayID: gatewayID, deviceID: deviceID, isDeleteLog: isDeleteLog)
            .subscribe(onCompleted: { [weak self] in
                self?.view.hideLoadingProgress()
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    private func isHaveChanged(device: Device, loraID: String, name: String, location: CLLocationCoordinate2D?) -> Bool {
        if name != device.name || device.location != location || device.loraID != loraID {
            return true
        }
        return false
    }
}
