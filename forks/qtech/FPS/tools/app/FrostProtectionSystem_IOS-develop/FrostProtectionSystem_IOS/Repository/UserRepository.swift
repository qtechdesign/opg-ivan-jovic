//
//  LoginRepository.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit
import RxSwift
import Firebase

protocol UserRepository {
    func getCurrentUserID() -> String?
    func login(email: String, password: String) -> Completable
    func login(credential: AuthCredential, displayName: String, email: String) -> Completable
    func register(email: String, password: String, name: String) -> Completable
    func sendEmailForgotPassword(email: String) -> Completable
    func requestUserInfo(userID: String) -> Single<User?>
    func requestGatewayOrDeviceIDFromSerialKey(serialKey: String) -> Single<(id: String?, isGateway: Bool?)>
}

class UserRepositoryImpl: UserRepository {
    
    static let shared: UserRepository = UserRepositoryImpl()
    private init() { }
    
    func getCurrentUserID() -> String? {
        return Auth.auth().currentUser?.uid
    }
    
    func login(email: String, password: String) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            Auth.auth().signIn(withEmail: email, password: password, completion: { (result, error) in
                if let error = error {
                    completable(.error(error))
                } else {
                    completable(.completed)
                }
            })
            return Disposables.create()
        })
    }
    
    func login(credential: AuthCredential, displayName: String, email: String) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            Auth.auth().signInAndRetrieveData(with: credential) { (result, error) in
                if let error = error {
                    completable(.error(error))
                    return
                }
                guard result != nil, let uid = Auth.auth().currentUser?.uid else { return }
                let userNamePath = PathDatabase.User.userName(userID: uid)
                let emailPath = PathDatabase.User.email(userID: uid)
                let value: [String: String] = [
                    userNamePath: displayName,
                    emailPath: email
                ]
                
                Database.database().reference().child(userNamePath)
                    .observeSingleEvent(of: .value, with: { (snapshot) in
                        guard snapshot.value as? String == nil else { return completable(.completed) }
                        Database.database().reference()
                            .updateChildValues(value, withCompletionBlock: { (error, reference) in
                                if let error = error {
                                    completable(.error(error))
                                } else {
                                    completable(.completed)
                                }
                            })
                    })
            }
            return Disposables.create()
        })
    }
    
    func register(email: String, password: String, name: String) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            Auth.auth().createUser(withEmail: email, password: password) { (result, error) in
                if let error = error {
                    completable(.error(error))
                }
                guard let result = result else { return }
                let userNamePath = PathDatabase.User.userName(userID: result.user.uid)
                let emailPath = PathDatabase.User.email(userID: result.user.uid)
                let value: [String: String] = [
                    userNamePath: name,
                    emailPath: email
                ]
                Database.database().reference()
                    .updateChildValues(value, withCompletionBlock: { (error, reference) in
                        if let error = error {
                            completable(.error(error))
                        } else {
                            completable(.completed)
                        }
                    })
            }
            return Disposables.create()
        })
    }
    
    func sendEmailForgotPassword(email: String) -> Completable {
        return Completable.create(subscribe: { (completable) -> Disposable in
            Auth.auth().sendPasswordReset(withEmail: email, completion: { (error) in
                if let error = error {
                    completable(.error(error))
                } else {
                    completable(.completed)
                }
            })
            return Disposables.create()
        })
    }
    
    func requestUserInfo(userID: String) -> Single<User?> {
        return Single<User?>.create(subscribe: { (single) -> Disposable in
            let userPath = PathDatabase.User.userPath(userID: userID)
            Database.database().reference(withPath: userPath)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    let user = User(snapshot: snapshot)
                    single(.success(user))
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        })
    }
    
    func requestGatewayOrDeviceIDFromSerialKey(serialKey: String) -> Single<(id: String?, isGateway: Bool?)> {
        return Single<(id: String?, isGateway: Bool?)>.create { (single) -> Disposable in
            let qrCodePath = PathDatabase.QRCode.qrCode(qrCode: serialKey)
            Database.database().reference(withPath: qrCodePath)
                .observeSingleEvent(of: .value, with: { (snapshot) in
                    guard let valueDict = snapshot.value as? [String: Any] else { return single(.success((nil, nil))) }
                    let id = valueDict[KeyDatabase.QRCode.serial] as? String
                    if let id = id {
                        let isDevice = Device.checkIdIsDeviceType(id: id)
                        single(.success((id, !isDevice)))
                    } else {
                        single(.success((nil, nil)))
                    }
                }, withCancel: { (error) in
                    single(.error(error))
                })
            return Disposables.create()
        }
    }
}
