package com.app.frostprotectionsystemandroid.data.source.datasource

import com.app.frostprotectionsystemandroid.data.model.Gateway
import io.reactivex.Observable
import io.reactivex.Single

/**
 *
 * @author at-tienhuynh3
 */
interface GatewayDataSource {

    fun getGateway(gatewayId: String): Observable<Gateway>

    fun getGatewaySingle(gatewayId: String): Single<Gateway>

    fun saveGateway(gateway: Gateway): Single<Boolean>

    fun update(gateway: Gateway): Single<Boolean>

    fun deleteGateway(gateway: Gateway): Single<Boolean>
}