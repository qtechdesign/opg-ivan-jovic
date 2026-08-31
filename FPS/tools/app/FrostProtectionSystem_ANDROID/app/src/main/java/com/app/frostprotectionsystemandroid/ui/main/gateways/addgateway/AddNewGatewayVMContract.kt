package com.app.frostprotectionsystemandroid.ui.main.gateways.addgateway

import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.model.KeySerial
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

interface AddNewGatewayVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getSerialId(publicKey: String): Single<KeySerial>

    fun checkExitsOwner(key: String): Single<Boolean>

    fun saveGateway(gateway: Gateway): Single<Boolean>
}
