//
//  GatewayRepository.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/29/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift
import Firebase
import GoogleMaps
import ObjectMapper

protocol GatewayRepository {
    func requestGateways(userID: String) -> Single<[Gateway]>
    func observeGatewayAdd(userID: String) -> Observable<Gateway>
    func observeGatewayChange(userID: String, gatewayID: String) -> Observable<Gateway>
    func observeGatewayDelete(userID: String, gatewayID: String) -> Observable<Gateway>
    
    func requestGatewayDetails(gatewayID: String) -> Single<Gateway?>
    func observeGatewayDetailChange(gatewayID: String) -> Observable<Gateway?>
    func requestListGatewayDetail(gatewayIDs: [String]) -> Single<[Gateway]>
    func editInfoGateway(ownerID: String, gatewayID: String, name: String, location: CLLocationCoordinate2D?) -> Completable
    func getGatewayIDFromSerialKey(serialKey: String) -> Single<String?>
    func addNewGateway(owner userID: String, name: String, serialKey: String, gatewayID: String, location: CLLocationCoordinate2D?) -> Single<Void>
    func deleteGateway(ownerID: String, gateway: Gateway, isDeleteLog: Bool) -> Completable
}

class GatewayRepositoryImpl: GatewayRepository {
    
    static let shared = GatewayRepositoryImpl()
    
    private var disposeBag = DisposeBag()
    
    init() { }
    
    func requestGateways(userID: String) -> Single<[Gateway]> {
        return Single<[Gateway]>.create(subscribe: { (single) -> Disposable in
            let gatewayOfUserPath = PathDatabase.User.gateways(userID: userID)
            Database.database().reference(withPath: gatewayOfUserPath)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    let gateways = Mapper<Gateway>().mapArray(snapshot: snapshot)
                    single(.success(gateways))
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
    
    func observeGatewayAdd(userID: String) -> Observable<Gateway> {
        return Observable<Gateway>.create({ (observable) -> Disposable in
            let gatewayOfUserPath = PathDatabase.User.gateways(userID: userID)
            Database.database().reference(withPath: gatewayOfUserPath)
                .observe(.childAdded, with: { (snapshot) in
                    if let gateway = Gateway(snapshot: snapshot) {
                        observable.onNext(gateway)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                })
            return Disposables.create()
        })
    }
    
    func observeGatewayChange(userID: String, gatewayID: String) -> Observable<Gateway> {
        return Observable<Gateway>.create({ (observable) -> Disposable in
            let gatewayOfUserPath = PathDatabase.User.gateways(userID: userID)
            Database.database().reference(withPath: gatewayOfUserPath)
                .observe(.childChanged, with: { (snapshot) in
                    if let gateway = Gateway(snapshot: snapshot) {
                        observable.onNext(gateway)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                })
            return Disposables.create()
        })
    }
    
    func observeGatewayDelete(userID: String, gatewayID: String) -> Observable<Gateway> {
        return Observable<Gateway>.create({ (observable) -> Disposable in
            let gatewayOfUserPath = PathDatabase.User.gateways(userID: userID)
            Database.database().reference(withPath: gatewayOfUserPath)
                .observe(.childRemoved, with: { (snapshot) in
                    if let gateway = Gateway(snapshot: snapshot) {
                        observable.onNext(gateway)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                })
            return Disposables.create()
        })
    }
    
    func requestGatewayDetails(gatewayID: String) -> Single<Gateway?> {
        return Single<Gateway?>.create(subscribe: { (single) -> Disposable in
            let gatewayDetailsPath = PathDatabase.Gateway.gatewayDetails(gatewayID: gatewayID)
            Database.database().reference(withPath: gatewayDetailsPath)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    let gateway = Gateway(snapshot: snapshot)
                    single(.success(gateway))
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
    
    func observeGatewayDetailChange(gatewayID: String) -> Observable<Gateway?> {
        return Observable<Gateway?>.create({ (observable) -> Disposable in
            let gatewayDetailsPath = PathDatabase.Gateway.gatewayDetails(gatewayID: gatewayID)
            Database.database().reference(withPath: gatewayDetailsPath)
                .observe(.value, with: { (snapshot) in
                    if !snapshot.hasChildren() {
                        observable.onNext(nil)
                        observable.onCompleted()
                        Database.database().reference(withPath: gatewayDetailsPath).removeAllObservers()
                    } else if let gateway = Gateway(snapshot: snapshot) {
                        observable.onNext(gateway)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                    Database.database().reference(withPath: gatewayDetailsPath).removeAllObservers()
                })
            return Disposables.create()
        })
    }
    
    func requestListGatewayDetail(gatewayIDs: [String]) -> Single<[Gateway]> {
        return Single<[Gateway]>.create(subscribe: { [weak self] (single) -> Disposable in
            guard let `self` = self, !gatewayIDs.isEmpty else {
                single(.success([]))
                return Disposables.create()
            }
            var sumRequestCompleted = 0
            var gateways = [Gateway]()
            
            for gatewayID in gatewayIDs {
                self.requestGatewayDetails(gatewayID: gatewayID)
                    .subscribe(onSuccess: { (gateway) in
                        sumRequestCompleted += 1
                        if let gateway = gateway {
                            gateways.append(gateway)
                        }
                        if sumRequestCompleted == gatewayIDs.count {
                            single(.success(gateways))
                        }
                    }, onError: { (error) in
                        sumRequestCompleted += 1
                        if sumRequestCompleted == gatewayIDs.count {
                            single(.success(gateways))
                        }
                    }).disposed(by: self.disposeBag)
            }
            return Disposables.create()
        })
    }
    
    func editInfoGateway(ownerID: String, gatewayID: String, name: String, location: CLLocationCoordinate2D?) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            var value: [String: Any] = [
                PathDatabase.Gateway.name(gatewayID: gatewayID) : name,
                PathDatabase.User.gatewayName(userID: ownerID, gatewayID: gatewayID) : name
            ]
            if let location = location {
                value[PathDatabase.Gateway.gps(gatewayID: gatewayID)] = [
                    KeyDatabase.Gateway.lat: location.latitude as Double,
                    KeyDatabase.Gateway.long: location.longitude as Double,
                ]
            } else {
                value[PathDatabase.Gateway.gps(gatewayID: gatewayID)] = [
                    KeyDatabase.Gateway.lat: [],
                    KeyDatabase.Gateway.long: [],
                ]
            }
            Database.database().reference()
                .updateChildValues(value, withCompletionBlock: { (error, reference) in
                    if let error = error {
                        completable(.error(error))
                    } else {
                        completable(.completed)
                    }
                })
            return Disposables.create()
        })
    }
    
    func getGatewayIDFromSerialKey(serialKey: String) -> Single<String?> {
        return Single<String?>.create(subscribe: { (single) -> Disposable in
            let qrCodePath = PathDatabase.QRCode.qrCode(qrCode: serialKey)
            Database.database().reference(withPath: qrCodePath)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    guard let valueDict = snapshot.value as? [String: Any] else { return single(.success(nil)) }
                    let gatewayID = valueDict[KeyDatabase.QRCode.serial] as? String
                    if let gatewayID = gatewayID {
                        single(.success(gatewayID))
                    } else {
                        single(.success(nil))
                    }
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
    
    func addNewGateway(owner userID: String, name: String, serialKey: String, gatewayID: String, location: CLLocationCoordinate2D?) -> Single<Void> {
        return Single<Void>.create(subscribe: { (single) -> Disposable in
            let value = Gateway.addNewGatewayDict(gatewayID: gatewayID, name: name, location: location, owner: userID, publicKey: serialKey)
            Database.database().reference().updateChildValues(value, withCompletionBlock: { (error, reference) in
                if let error = error {
                    single(.error(error))
                } else {
                    single(.success(()))
                }
            })
            return Disposables.create()
        })
    }
    
    func deleteGateway(ownerID: String, gateway: Gateway, isDeleteLog: Bool) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            let value = Gateway.deleteGatewayDict(gateway: gateway, ownerID: ownerID, isDeleteLog: isDeleteLog)
            Database.database().reference().updateChildValues(value, withCompletionBlock: { (error, reference) in
                if let error = error {
                    completable(.error(error))
                } else {
                    completable(.completed)
                }
            })
            return Disposables.create()
        })
    }
}
