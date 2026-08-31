//
//  EditGatewayPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/16/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import GoogleMaps
import RxSwift

class EditGatewayPresenterImpl: EditGatewayPresenter {
    
    private weak var view: EditGatewayIView!
    private let userRepository: UserRepository
    private let gatewayRepository: GatewayRepository
    private var disposeBag = DisposeBag()
    
    init(view: EditGatewayIView, userRepository: UserRepository, gatewayRepository: GatewayRepository) {
        self.view = view
        self.userRepository = userRepository
        self.gatewayRepository = gatewayRepository
    }
    
    func editGateway(gateway: Gateway, name: String, lat: String, long: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        guard checkValidate(gateway: gateway, name: name, lat: lat, long: long) else { return }
        self.view.showLoadingProgress()
        
        var location: CLLocationCoordinate2D?
        if let latitudeDouble = Double(lat), let longitudeDouble = Double(long),
            let latitide = CLLocationDegrees(exactly: latitudeDouble), let longitude = CLLocationDegrees(exactly: longitudeDouble) {
            location = CLLocationCoordinate2D(latitude: latitide, longitude: longitude)
        }
        gatewayRepository.editInfoGateway(ownerID: userID, gatewayID: gateway.id, name: name, location: location)
            .subscribe(onCompleted: { [weak self] in
                self?.view.hideLoadingProgress()
                self?.view.editGatewaySuccess()
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    func checkValidate(gateway: Gateway, name: String, lat: String, long: String) -> Bool {
        if name.trim().isEmpty {
            self.view.invalidate(error: Strings.Gateway.nameCannotEmpty)
            return false
        }
        if (lat.isEmpty && !long.isEmpty) || (!lat.isEmpty && long.isEmpty) {
            self.view.invalidate(error: Strings.Gateway.pleaseEnterCoordinates)
            return false
        }
        var location: CLLocationCoordinate2D?
        if let latitudeDouble = Double(lat), let longitudeDouble = Double(long),
            let latitide = CLLocationDegrees(exactly: latitudeDouble), let longitude = CLLocationDegrees(exactly: longitudeDouble) {
            location = CLLocationCoordinate2D(latitude: latitide, longitude: longitude)
        }
        if gateway.name == name, gateway.location == location {
            self.view.notChangeData()
            return false
        }
        return true
    }
    
    func deleteGateway(gateway: Gateway, isDeleteLog: Bool) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.deleteGateway(ownerID: userID, gateway: gateway, isDeleteLog: isDeleteLog)
            .subscribe(onCompleted: {
            }) { [weak self] (error) in
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    func observeGatewayDelete(gatewayID: String) {
        guard let userID = userRepository.getCurrentUserID() else { return }
        gatewayRepository.observeGatewayDelete(userID: userID, gatewayID: gatewayID)
            .subscribe(onNext: { [weak self] (gateway) in
                self?.view.gatewayDeleted()
            }).disposed(by: disposeBag)
    }
}
