//
//  DeviceRepository.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/8/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift
import Firebase
import ObjectMapper
import GoogleMaps

protocol DeviceRepository {
    func observeDeviceAdd(gatewayID: String) -> Observable<Device>
    func observeDeviceChange(gatewayID: String) -> Observable<Device>
    func observeDeviceDelete(gatewayID: String) -> Observable<Device>
    
    func requestDeviceDetails(userID: String, deviceID: String) -> Single<Device?>
    func observeDeviceDetailsChange(userID: String, deviceID: String) -> Observable<Device?>
    
    func editInfoDevice(gatewayID: String, deviceID: String, loraID: String, name: String, location: CLLocationCoordinate2D?) -> Completable
    
    func getDeviceIDFromSerialKey(serialKey: String) -> Single<String?>
    func addNewDevice(userID: String, gatewayID: String, serialKeyGateway: String, deviceID: String, loraID: String, name: String, serialKey: String, location: CLLocationCoordinate2D?) -> Single<Void>
    func requestHistoryDeviceData(deviceID: String, limitToLast: UInt) -> Single<[DeviceData]>
    func observeHistoryDeviceAdd(deviceID: String) -> Observable<DeviceData>
    func requestRefreshData(gatewayID: String, deviceID: String) -> Completable
    func requestChangeStatusDevice(gatewayID: String, deviceID: String, isOn: Bool) -> Completable
    func deleteDevice(userID: String, gatewayID: String, deviceID: String, isDeleteLog: Bool) -> Completable
    func requestListData(deviceID: String, startDate: Date, endDate: Date) -> Single<[DeviceData]>
}

class DeviceRepositoryImpl: DeviceRepository {
    
    static let shared = DeviceRepositoryImpl()
    
    init() { }
    
    func observeDeviceAdd(gatewayID: String) -> Observable<Device> {
        return Observable<Device>.create({ (observable) -> Disposable in
            let devicesOfGatewayPath = PathDatabase.Gateway.devices(gatewayID: gatewayID)
            Database.database().reference(withPath: devicesOfGatewayPath)
                .observe(.childAdded, with: { (snapshot) in
                    if let device = Device(snapshot: snapshot) {
                        observable.onNext(device)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                    Database.database().reference(withPath: devicesOfGatewayPath).removeAllObservers()
                })
            return Disposables.create()
        })
    }
    
    func observeDeviceChange(gatewayID: String) -> Observable<Device> {
        return Observable<Device>.create({ (observable) -> Disposable in
            let devicesOfGatewayPath = PathDatabase.Gateway.devices(gatewayID: gatewayID)
            Database.database().reference(withPath: devicesOfGatewayPath)
                .observe(.childChanged, with: { (snapshot) in
                    if let device = Device(snapshot: snapshot) {
                        observable.onNext(device)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                    Database.database().reference(withPath: devicesOfGatewayPath).removeAllObservers()
                })
            return Disposables.create()
        })
    }
    
    func observeDeviceDelete(gatewayID: String) -> Observable<Device> {
        return Observable<Device>.create({ (observable) -> Disposable in
            let devicesOfGatewayPath = PathDatabase.Gateway.devices(gatewayID: gatewayID)
            Database.database().reference(withPath: devicesOfGatewayPath)
                .observe(.childRemoved, with: { (snapshot) in
                    if let device = Device(snapshot: snapshot) {
                        observable.onNext(device)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                    Database.database().reference(withPath: devicesOfGatewayPath).removeAllObservers()
                })
            return Disposables.create()
        })
    }
    
    func requestDeviceDetails(userID: String, deviceID: String) -> Single<Device?> {
        return Single<Device?>.create(subscribe: { (single) -> Disposable in
            let deviceDetailsPath = PathDatabase.Device.deviceDetails(deviceID: deviceID)
            Database.database().reference(withPath: deviceDetailsPath)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    let device = Device(snapshot: snapshot)
                    single(.success(device))
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
    
    func observeDeviceDetailsChange(userID: String, deviceID: String) -> Observable<Device?> {
        return Observable<Device?>.create({ (observable) -> Disposable in
            let deviceDetailsPath = PathDatabase.Device.deviceDetails(deviceID: deviceID)
            Database.database().reference(withPath: deviceDetailsPath)
                .observe(.value, with: { (snapshot) in
                    if snapshot.hasChildren(), let device = Device(snapshot: snapshot) {
                        observable.onNext(device)
                    } else {
                        observable.onNext(nil)
                        observable.onCompleted()
                        Database.database().reference(withPath: deviceDetailsPath).removeAllObservers()
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                    Database.database().reference(withPath: deviceDetailsPath).removeAllObservers()
                })
            return Disposables.create()
        })
    }
    
    func editInfoDevice(gatewayID: String, deviceID: String, loraID: String, name: String, location: CLLocationCoordinate2D?) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            var value: [String: Any] = [
                PathDatabase.Gateway.command(gatewayID: gatewayID): Constants.Command.editDevice(deviceID: deviceID, loraID: loraID),
                PathDatabase.Device.name(deviceID: deviceID) : name,
                PathDatabase.Gateway.deviceName(gatewayID: gatewayID, deviceID: deviceID) : name
            ]
            if let location = location {
                value[PathDatabase.Device.gps(deviceID: deviceID)] = [
                    KeyDatabase.Gateway.lat: location.latitude as Double,
                    KeyDatabase.Gateway.long: location.longitude as Double,
                ]
                value[PathDatabase.Gateway.deviceGPS(gatewayID: gatewayID, deviceID: deviceID)] = [
                    KeyDatabase.Gateway.lat: location.latitude as Double,
                    KeyDatabase.Gateway.long: location.longitude as Double,
                ]
            } else {
                value[PathDatabase.Device.gps(deviceID: deviceID)] = [
                    KeyDatabase.Gateway.lat: [],
                    KeyDatabase.Gateway.long: [],
                ]
                value[PathDatabase.Gateway.deviceGPS(gatewayID: gatewayID, deviceID: deviceID)] = [
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
    
    func getDeviceIDFromSerialKey(serialKey: String) -> Single<String?> {
        return Single<String?>.create(subscribe: { (single) -> Disposable in
            let qrCodePath = PathDatabase.QRCode.qrCode(qrCode: serialKey)
            Database.database().reference(withPath: qrCodePath)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    guard let valueDict = snapshot.value as? [String: Any] else { return single(.success(nil)) }
                    let deviceID = valueDict[KeyDatabase.QRCode.serial] as? String
                    if let deviceID = deviceID, Device.checkIdIsDeviceType(id: deviceID) {
                        single(.success(deviceID))
                    } else {
                        single(.success(nil))
                    }
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
    
    func addNewDevice(userID: String, gatewayID: String, serialKeyGateway: String, deviceID: String, loraID: String, name: String, serialKey: String, location: CLLocationCoordinate2D?) -> Single<Void> {
        return Single<Void>.create(subscribe: { (single) -> Disposable in
            let value = Device.addNewDeviceDict(userID: userID, gatewayID: gatewayID, serialKeyGateway: serialKeyGateway, deviceID: deviceID, name: name, serialKey: serialKey, location: location)
            Database.database().reference().updateChildValues(value, withCompletionBlock: { (error, reference) in
                if let error = error {
                    single(.error(error))
                } else {
                    let commandValue = [PathDatabase.Gateway.command(gatewayID: gatewayID): Constants.Command.addDevice(deviceID: deviceID, loraID: loraID)]
                    Database.database().reference().updateChildValues(commandValue, withCompletionBlock: { _,_ in single(.success(())) })
                }
            })
            return Disposables.create()
        })
    }
    
    func requestHistoryDeviceData(deviceID: String, limitToLast: UInt) -> Single<[DeviceData]> {
        return Single<[DeviceData]>.create(subscribe: { (single) -> Disposable in
            let deviceLogsPath = PathDatabase.DeviceLog.deviceLog(deviceID: deviceID)
            Database.database().reference(withPath: deviceLogsPath)
                .queryLimited(toLast: limitToLast)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    let deviceDatas = Mapper<DeviceData>().mapArray(snapshot: snapshot)
                    single(.success(deviceDatas))
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
    
    func observeHistoryDeviceAdd(deviceID: String) -> Observable<DeviceData> {
        return Observable<DeviceData>.create({ (observable) -> Disposable in
            let deviceLogsPath = PathDatabase.DeviceLog.deviceLog(deviceID: deviceID)
            Database.database().reference(withPath: deviceLogsPath)
                .queryLimited(toLast: 1)
                .observe(.childAdded, with: { (snapshot) in
                    if let deviceData = DeviceData(snapshot: snapshot) {
                        observable.onNext(deviceData)
                    }
                }, withCancel: { (error) in
                    observable.onError(error)
                })
            return Disposables.create()
        })
    }
    
    func requestRefreshData(gatewayID: String, deviceID: String) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            let commandPath = PathDatabase.Gateway.command(gatewayID: gatewayID)
            let value = Constants.Command.refresh(deviceID: deviceID)
            Database.database().reference(withPath: commandPath).setValue(value, withCompletionBlock: { (error, reference) in
                if let error = error {
                    completable(.error(error))
                } else {
                    completable(.completed)
                }
            })
            return Disposables.create()
        })
    }
    
    func requestChangeStatusDevice(gatewayID: String, deviceID: String, isOn: Bool) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            let commandPath = PathDatabase.Gateway.command(gatewayID: gatewayID)
            let value = Constants.Command.status(deviceID: deviceID, isOn: isOn)
            Database.database().reference(withPath: commandPath).setValue(value, withCompletionBlock: { (error, reference) in
                if let error = error {
                    completable(.error(error))
                } else {
                    completable(.completed)
                }
            })
            return Disposables.create()
        })
    }
    
    func deleteDevice(userID: String, gatewayID: String, deviceID: String, isDeleteLog: Bool) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            let value = Device.deleteDeviceDict(userID: userID, gatewayID: gatewayID, deviceID: deviceID, isDeleteLog: isDeleteLog)
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
    
    func requestListData(deviceID: String, startDate: Date, endDate: Date) -> Single<[DeviceData]> {
        return Single<[DeviceData]>.create(subscribe: { (single) -> Disposable in
            let deviceLogPath = PathDatabase.DeviceLog.deviceLog(deviceID: deviceID)
            Database.database().reference(withPath: deviceLogPath)
                .queryOrdered(byChild: KeyDatabase.Device.timestamp)
                .queryStarting(atValue: startDate.toTimestampSecond())
                .queryEnding(atValue: endDate.toTimestampSecond())
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    let deviceDatas = Mapper<DeviceData>().mapArray(snapshot: snapshot).sorted(by: { $0.timestamp ?? 0 < $1.timestamp ?? 0 })
                    single(.success(deviceDatas))
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
}
