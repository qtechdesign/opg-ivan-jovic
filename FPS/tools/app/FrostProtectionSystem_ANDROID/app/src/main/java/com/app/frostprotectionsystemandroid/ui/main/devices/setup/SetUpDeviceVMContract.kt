package com.app.frostprotectionsystemandroid.ui.main.devices.setup

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface SetUpDeviceVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getDevice(deviceId: String): Single<Device>

    fun getDeviceValves(deviceId: String): Single<DeviceVavles>

    fun getDeviceValvesLocal(): DeviceVavles

    fun getDeviceLocal(): Device

    fun updateDevice(device: Device): Single<Boolean>

    fun deleteDevice(device: Device): Single<Boolean>
}
