//
//  AddGatewayPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/18/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift
import GoogleMaps

class AddGatewayPresenterImpl: AddGatewayPresenter {
    private weak var view: AddGatewayIView!
    private let userRepository: UserRepository
    private let gatewayRepository: GatewayRepository
    private let disposeBag = DisposeBag()
    
    init(view: AddGatewayIView, userRepository: UserRepository, gatewayRepository: GatewayRepository) {
        self.view = view
        self.userRepository = userRepository
        self.gatewayRepository = gatewayRepository
    }
    
    func addNewGateway(name: String, serialKey: String, lat: String, long: String) {
        guard let userID = userRepository.getCurrentUserID(), checkValidate(name: name, serialKey: serialKey, lat: lat, long: long) else { return }
        var location: CLLocationCoordinate2D?
        if let latitudeDouble = Double(lat), let longitudeDouble = Double(long),
            let latitide = CLLocationDegrees(exactly: latitudeDouble), let longitude = CLLocationDegrees(exactly: longitudeDouble) {
            location = CLLocationCoordinate2D(latitude: latitide, longitude: longitude)
        }
        self.view.showLoadingProgress()
        gatewayRepository.getGatewayIDFromSerialKey(serialKey: serialKey)
            .flatMap { [weak self] (gatewayID) -> Single<Void> in
                guard let self = self else { return Single.never() }
                if let gatewayID = gatewayID {
                    return self.gatewayRepository.addNewGateway(owner: userID, name: name, serialKey: serialKey, gatewayID: gatewayID, location: location)
                } else {
                    self.view.hideLoadingProgress()
                    self.view.invalidate(error: Strings.Gateway.serialIDIncorrect)
                    return Single.never()
                }
            }.subscribe(onSuccess: { [weak self] (_) in
                self?.view.hideLoadingProgress()
                self?.view.addNewGatewaySuccess()
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    private func checkValidate(name: String, serialKey: String, lat: String, long: String) -> Bool {
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
