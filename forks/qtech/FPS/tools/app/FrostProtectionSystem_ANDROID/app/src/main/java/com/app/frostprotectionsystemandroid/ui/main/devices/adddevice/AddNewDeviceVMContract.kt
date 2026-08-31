package com.app.frostprotectionsystemandroid.ui.main.devices.adddevice

import com.app.frostprotectionsystemandroid.data.model.Device
import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.model.KeySerial
import com.app.frostprotectionsystemandroid.data.model.User
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface AddNewDeviceVMContract {

    fun getUser(userId: String): Observable<User>

    fun getUserLocal(): User?

    fun progressSubject(): BehaviorSubject<Boolean>

    fun addNewDevice(userId: String, device: Device): Single<Boolean>

    fun getSerialId(publicKey: String): Single<KeySerial>

    fun getGateway(gatewayId: String): Single<Gateway>
}