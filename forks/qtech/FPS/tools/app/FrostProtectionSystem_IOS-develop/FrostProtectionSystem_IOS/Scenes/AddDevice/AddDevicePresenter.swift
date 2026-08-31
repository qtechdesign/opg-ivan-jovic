//
//  AddDevicePresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/20/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift
import GoogleMaps

class AddDevicePresenterImpl: AddDevicePresenter {
    private weak var view: AddDeviceIView!
    private let userRepository: UserRepository
    private let deviceRepository: DeviceRepository
    private let gatewayRepository: GatewayRepository
    private let disposeBag = DisposeBag()
    
    init(view: AddDeviceIView, userRepository: UserRepository, deviceRepository: DeviceRepository, gatewayRepository: GatewayRepository) {
        self.view = view
        self.userRepository = userRepository
        self.deviceRepository = deviceRepository
        self.gatewayRepository = gatewayRepository
    }
    
    func requestListGateway() {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.requestGateways(userID: userID)
            .subscribe(onSuccess: { [weak self] (gateways) in
                self?.view.requestListGatewaySuccess(gateways: gateways)
            }) { [weak self] (error) in
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    func addNewDevice(gatewaySeleted: Gateway?, loraID: String, name: String, serialKey: String, lat: String, long: String) {
        let loraID = loraID.convertLoraIDToHex()
        guard let gatewayID = gatewaySeleted?.id else { return self.view.invalidate(error: Strings.Gateway.selectGateway) }
        guard let currentUserID = userRepository.getCurrentUserID(), checkValidate(loraID: loraID, name: name, serialKey: serialKey, lat: lat, long: long) else { return }
        var location: CLLocationCoordinate2D?
        if let latitudeDouble = Double(lat), let longitudeDouble = Double(long),
            let latitide = CLLocationDegrees(exactly: latitudeDouble), let longitude = CLLocationDegrees(exactly: longitudeDouble) {
            location = CLLocationCoordinate2D(latitude: latitide, longitude: longitude)
        }
        self.view.showLoadingProgress()
        var serialKeyGateway: String = ""
        gatewayRepository.requestGatewayDetails(gatewayID: gatewayID)
            .flatMap { [weak self] (gateway) -> Single<String?> in
                guard let self = self else { return Single.never() }
                if let gateway = gateway, let publicKeyGateway = gateway.publicKey {
                    serialKeyGateway = publicKeyGateway
                    return self.deviceRepository.getDeviceIDFromSerialKey(serialKey: serialKey)
                } else {
                    self.view.invalidate(error: Strings.Main.somethingWrong)
                    self.view.hideLoadingProgress()
                    return Single.never()
                }
            }.flatMap { [weak self] (deviceID) -> Single<Void> in
                guard let self = self else { return Single.never() }
                if let deviceID = deviceID {
                    return self.deviceRepository.addNewDevice(userID: currentUserID, gatewayID: gatewayID, serialKeyGateway: serialKeyGateway, deviceID: deviceID, loraID: loraID, name: name, serialKey: serialKey, location: location)
                } else {
                    self.view.hideLoadingProgress()
                    self.view.invalidate(error: Strings.Gateway.serialIDIncorrect)
                    return Single.never()
                }
            }.subscribe(onSuccess: { [weak self] (_) in
                self?.view.hideLoadingProgress()
                self?.view.addNewDeviceSuccess()
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    private func checkValidate(loraID: String, name: String, serialKey: String, lat: String, long: String) -> Bool {
        if !loraID.isLoraID() {
            self.view.invalidate(error: Strings.Device.loraIDMustHave4CharactersAndCorrectFormat)
            return false
        }
        if name.trim().isEmpty {
            self.view.invalidate(error: Strings.Gateway.nameCannotEmpty)
            return false
        }
        if serialKey.trim().isEmpty {
            self.view.invalidate(error: Strings.Gateway.serialKeyCannotEmpty)
            return false
        }
        if (lat.isEmpty && !long.isEmpty) || (!lat.isEmpty && long.isEmpty) {
            self.view.invalidate(error: Strings.Gateway.pleaseEnterCoordinates)
            return false
        }
        return true
    }
}
