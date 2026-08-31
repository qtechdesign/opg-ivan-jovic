package com.app.frostprotectionsystemandroid.ui.main.devices.adddevice

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.model.User
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import com.app.frostprotectionsystemandroid.data.source.repository.GatewayRepository
import com.app.frostprotectionsystemandroid.data.source.repository.KeySerialRepository
import com.app.frostprotectionsystemandroid.data.source.repository.UserRepository
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class AddNewDeviceViewModel(private val userRepository: UserRepository, private val devicesRepository: DevicesRepository,
                            private val keySerialRepository: KeySerialRepository, private val gatewayRepository: GatewayRepository) : AddNewDeviceVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()
    private var user: User? = null

    override fun getUser(userId: String): Observable<User> {
        return userRepository.getUser(userId)
                .doOnNext {
                    user = it
                }
                .doOnSubscribe {
                    progressSubject.onNext(true)
                }.doAfterNext {
                    progressSubject.onNext(false)
                }
    }

    override fun getUserLocal(): User? = user

    override fun addNewDevice(userId: String, device: Device) = devicesRepository.addNewDevice(userId, device)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }.doFinally {
                progressSubject.onNext(false)
            }
            .doOnError { progressSubject.onNext(false) }

    override fun progressSubject() = progressSubject

    override fun getSerialId(publicKey: String) = keySerialRepository
            .getSerialId(publicKey)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }

    override fun getGateway(gatewayId: String): Single<Gateway> = gatewayRepository
            .getGatewaySingle(gatewayId)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }.doFinally {
                progressSubject.onNext(false)
            }


}
