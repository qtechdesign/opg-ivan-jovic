package com.app.frostprotectionsystemandroid.ui.main.scan

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.DeviceVavles
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.model.KeySerial
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface AfterScanVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getSerialId(publicKey: String): Single<KeySerial>

    fun getDataOfGateway(gatewayId: String): Single<Gateway>

    fun getDevice(deviceId: String): Single<Device>

    fun getDeviceValves(deviceId: String): Single<DeviceVavles>
}