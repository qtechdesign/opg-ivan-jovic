package com.app.frostprotectionsystemandroid.ui.main.devices.setup

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.source.repository.DevicesRepository
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
class SetUpDeviceViewModel(private val devicesRepository: DevicesRepository) : SetUpDeviceVMContract {

    private var progressSubject = BehaviorSubject.create<Boolean>()
    private var device: Device? = null
    private var deviceValves: DeviceVavles? = null

    override fun getDevice(deviceId: String): Single<Device> {
        return devicesRepository.getDeviceSingle(deviceId)
            .doOnSuccess { device = it }
                .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }
    }

    override fun getDeviceValves(deviceId: String): Single<DeviceVavles> {
        return devicesRepository.getDeviceValvesSingle(deviceId)
            .doOnSuccess { deviceValves = it }
                .doOnSubscribe { progressSubject.onNext(true) }
            .doFinally { progressSubject.onNext(false) }
    }

    override fun getDeviceValvesLocal() = deviceValves ?: DeviceVavles()

    override fun progressSubject() = progressSubject

    override fun updateDevice(device: Device) = devicesRepository.updateDevice(device)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }.doFinally {
                progressSubject.onNext(false)
            }

    override fun getDeviceLocal() = device ?: Device()

    override fun deleteDevice(device: Device) = devicesRepository.deleteDevice(device)
            .doOnSubscribe {
                progressSubject.onNext(true)
            }.doFinally {
                progressSubject.onNext(false)
            }
}
