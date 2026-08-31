package com.app.frostprotectionsystemandroid.ui.main.scan

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.model.KeySerial
import com.app.frostprotectionsystemandroid.data.source.repository.AfterScanRepository
import com.app.frostprotectionsystemandroid.data.source.repository.KeySerialRepository
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class AfterScanViewModel(private val keySerialRepository: KeySerialRepository, private val afterScanRepository: AfterScanRepository)
    : AfterScanVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()

    override fun progressSubject() = progressSubject

    override fun getSerialId(publicKey: String): Single<KeySerial> =
            keySerialRepository.getSerialId(publicKey)
                    .doOnSubscribe { progressSubject.onNext(true) }
                    .doFinally { progressSubject.onNext(false) }

    override fun getDataOfGateway(gatewayId: String) =
            afterScanRepository.getDataOfGateway(gatewayId)
                    .doOnSubscribe { progressSubject.onNext(true) }
                    .doFinally { progressSubject.onNext(false) }

    override fun getDevice(deviceId: String): Single<Device> = afterScanRepository
            .getDevice(deviceId)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }

    override fun getDeviceValves(deviceId: String): Single<DeviceVavles> = afterScanRepository
            .getDeviceValves(deviceId)
            .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }

}
