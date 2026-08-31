package com.app.frostprotectionsystemandroid.data.source.repository

import com.app.frostprotectionsystemandroid.data.model.Gateway
import com.app.frostprotectionsystemandroid.data.source.datasource.GatewayDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource.GatewayRemoteDataSource

/**
 *
 * @author at-tienhuynh3
 */
class GatewayRepository : GatewayDataSource {

    private val gatewaysRemoteDataSource = GatewayRemoteDataSource()

    override fun getGateway(gatewayId: String) = gatewaysRemoteDataSource.getGateway(gatewayId)

    override fun getGatewaySingle(gatewayId: String) = gatewaysRemoteDataSource.getGatewaySingle(gatewayId)

    override fun saveGateway(gateway: Gateway) = gatewaysRemoteDataSource.saveGateway(gateway)

    override fun deleteGateway(gateway: Gateway) = gatewaysRemoteDataSource.deleteGateway(gateway)

    override fun update(gateway: Gateway) = gatewaysRemoteDataSource.update(gateway)
}
