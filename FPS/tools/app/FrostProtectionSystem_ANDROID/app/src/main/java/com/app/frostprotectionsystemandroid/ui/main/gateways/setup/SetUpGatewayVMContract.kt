package com.app.frostprotectionsystemandroid.ui.main.gateways.setup

import com.app.frostprotectionsystemandroid.data.model.Gateway
import io.reactivex.Observable
import io.reactivex.Single
import io.reactivex.subjects.BehaviorSubject

interface SetUpGatewayVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getGateway(gatewayId: String): Observable<Gateway>

    fun update(gateway: Gateway): Single<Boolean>

    fun getGatewayLocal(): Gateway

    fun deleteGateway(gateway: Gateway): Single<Boolean>
}