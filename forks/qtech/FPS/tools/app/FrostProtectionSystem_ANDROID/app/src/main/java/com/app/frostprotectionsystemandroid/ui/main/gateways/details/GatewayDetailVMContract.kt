package com.app.frostprotectionsystemandroid.ui.main.gateways.details

import com.app.frostprotectionsystemandroid.data.model.Gateway
import io.reactivex.Observable
import io.reactivex.subjects.BehaviorSubject

/**
 *
 * @author at-tienhuynh3
 */
interface GatewayDetailVMContract {

    fun progressSubject(): BehaviorSubject<Boolean>

    fun getGateway(gatewayId: String): Observable<Gateway>

    fun getValvesNum(): Int

    fun getSensorNodeNum(): Int
}
